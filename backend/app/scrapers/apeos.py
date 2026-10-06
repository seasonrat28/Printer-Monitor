"""
HTTP Scraper for FUJIFILM Apeos series (tested on Apeos 4620 SZ)
ดึงข้อมูลจากหน้าเว็บของเครื่องปริ้นโดยตรง ไม่ต้องใช้ SNMP

Endpoints used:
  Status    : http://{ip}/home/monitor.html   (no auth needed)
  Location  : http://{ip}/home/status.html    (no auth needed)
  Supplies  : https://{ip}/general/information.html?kind=item  (requires login)
  System Info (model/serial/pages): same as Supplies page

Login flow (HTTPS POST):
  POST https://{ip}/home/status.html
  body: B1859={password}&loginurl=/general/information.html?kind=item
  → sets AuthCookie session cookie
  → follow redirect to information page
"""

import asyncio
import re
import ssl
import logging
import html as html_lib
import urllib.parse
from typing import Dict, Any, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

# ── Status class → (our status, label) ────────────────────────────────────
STATUS_CLASS_MAP = {
    "moniOk":      ("ONLINE",  "Ready"),
    "moniSleep":   ("ONLINE",  "Sleep Mode"),
    "moniWarm":    ("ONLINE",  "Warming Up"),
    "moniPrint":   ("ONLINE",  "Printing"),
    "moniWarning": ("WARNING", "Warning"),
    "moniWr":      ("WARNING", "Warning"),
    "moniError":   ("ERROR",   "Error"),
    "moniFa":      ("ERROR",   "Fatal"),
    "moniOffline": ("OFFLINE", "Offline"),
    "moniNoPower": ("OFFLINE", "Power Off"),
}

# Toner image bar: height 0–50 px = 0–100 %
TONER_MAX_HEIGHT = 50


class ApeosHTTPScraper:
    """
    HTTP/HTTPS scraper for FUJIFILM Apeos series printers.
    Maintains a per-instance AuthCookie so login happens at most once
    per scraper lifecycle (one per monitoring cycle).
    """

    def __init__(self, ip: str, password: str = "", timeout: int = 8):
        self.ip       = ip
        self.password = password
        self.timeout  = timeout
        self._http    = f"http://{ip}"
        self._https   = f"https://{ip}"
        self._cookie  = None   # AuthCookie value cached after login
        self._info_html = None # Cached HTML response of the info page

        # Shared SSL context – ignore self-signed cert on printer
        self._ssl_ctx = ssl.create_default_context()
        self._ssl_ctx.check_hostname = False
        self._ssl_ctx.verify_mode    = ssl.CERT_NONE

    # ── Public API (same interface as StandardSNMPAdapter) ────────────────

    async def get_status(self) -> Tuple[str, Optional[str]]:
        """Device status from /home/monitor.html (no auth needed)."""
        try:
            html = await self._fetch_http("/home/monitor.html")
            if html is None:
                return "OFFLINE", "Unreachable"

            m = re.search(
                r'name="monitor_start"\s*/>\s*<span\s+class="([^"]+)">([^<]*)</span>',
                html
            )
            if m:
                css_class = m.group(1).strip()
                text      = m.group(2).strip()
                
                # Determine base status based on css class
                base_status = "ONLINE"
                for cls_key, (status, default_msg) in STATUS_CLASS_MAP.items():
                    if cls_key in css_class:
                        base_status = status
                        text = text or default_msg
                        break
                        
                # Text-based overrides for cases where the printer uses moniOk but text is a warning
                text_lower = text.lower()
                if base_status == "ONLINE" or base_status == "WARNING":
                    if any(w in text_lower for w in ["low", "empty", "please order"]):
                        base_status = "WARNING"
                    if any(w in text_lower for w in ["jam", "error", "replace", "open", "offline", "cannot print", "paper out"]):
                        base_status = "ERROR"
                    elif "ready" in text_lower or text == "":
                        # Try to get the real status from status.html (e.g. "Sleep")
                        try:
                            status_html = await self._fetch_http("/home/status.html")
                            if status_html:
                                m = re.search(r'>\s*Device(?:\s|&#32;)*Status\s*<.*?<(?:dd|span)[^>]*>(.*?)</(?:dd|span)>', status_html, re.IGNORECASE | re.DOTALL)
                                if m:
                                    real_status = re.sub(r'<[^>]+>', '', m.group(1)).strip()
                                    if real_status:
                                        text = re.sub(r'\s+', ' ', real_status)
                        except Exception as e:
                            logger.warning(f"[Apeos {self.ip}] failed to parse status.html for real status: {e}")

                return base_status, text
            return "UNKNOWN", None
        except Exception as e:
            logger.error(f"[Apeos {self.ip}] get_status error: {e}")
            return "OFFLINE", "Unreachable"

    async def get_system_info(self) -> Dict[str, Any]:
        """
        Model, serial, location from authenticated information page +
        location from status.html (no auth).
        """
        info: Dict[str, Any] = {}

        def clean_field(value: str) -> str:
            value = html_lib.unescape(value)
            value = re.sub(r"<[^>]+>", " ", value)
            return re.sub(r"\s+", " ", value).strip()

        # Location and Node Name from status.html (no auth)
        try:
            status_html = await self._fetch_http("/home/status.html")
            if status_html:
                m = re.search(
                    r'class="location"[^>]*>Location<span[^>]*>[^<]*</span>(.*?)</li>',
                    status_html
                )
                if m:
                    info["sysLocation"] = clean_field(m.group(1))
                    
                # Try to find Node Name or Machine Name on status page
                m_name = re.search(
                    r'(?:Node|Machine|Host)\s*Name.*?<span[^>]*>[^<]*</span>(.*?)(?:</li>|</div>)',
                    status_html, re.IGNORECASE | re.DOTALL
                )
                if m_name:
                    info["sysName"] = clean_field(m_name.group(1))
        except Exception as e:
            logger.warning(f"[Apeos {self.ip}] get_system_info (status page) error: {e}")

        # Model, serial from authenticated info page
        try:
            info_html = await self._fetch_info_page()
            if info_html:
                # Model Name
                m = re.search(r'<dt[^>]*>\s*Model(?:&#32;|\s)+Name\s*</dt>\s*<dd[^>]*>(.*?)</dd>', info_html, re.IGNORECASE | re.DOTALL)
                if m:
                    info["model"] = clean_field(m.group(1))

                # Serial no.
                m = re.search(r'<dt[^>]*>\s*Serial(?:&#32;|\s)+no\.?\s*</dt>\s*<dd[^>]*>(.*?)</dd>', info_html, re.IGNORECASE | re.DOTALL)
                if m:
                    info["serialNumber"] = clean_field(m.group(1))

                # Machine Name / Host Name / Node Name from info page
                m = re.search(r'<dt[^>]*>\s*(?:Machine|Host|Node)(?:&#32;|\s)+Name\s*</dt>\s*<dd[^>]*>(.*?)</dd>', info_html, re.IGNORECASE | re.DOTALL)
                if m:
                    info["sysName"] = clean_field(m.group(1))
                else:
                    info["sysName"] = None
        except Exception as e:
            logger.warning(f"[Apeos {self.ip}] get_system_info (info page) error: {e}")

        # If sysName is still missing, try nodename.html page as specified
        if not info.get("sysName"):
            try:
                nodename_html = await self._fetch_https("/net/wired/nodename.html", cookie=self._cookie)
                if nodename_html:
                    # Look for input field with the name or just grab the first text input value
                    m = re.search(r'<input[^>]*type="text"[^>]*value="([^"]+)"', nodename_html, re.IGNORECASE)
                    if m:
                        info["sysName"] = m.group(1).strip()
                    else:
                        # Fallback: any input with value on this page that isn't hidden/submit
                        m2 = re.search(r'<input[^>]*(?:name="NodeName"|id="NodeName")[^>]*value="([^"]+)"', nodename_html, re.IGNORECASE)
                        if m2:
                            info["sysName"] = m2.group(1).strip()
            except Exception as e:
                logger.warning(f"[Apeos {self.ip}] get_system_info (nodename page) error: {e}")

        return info

    def _parse_regex(self, pattern: str, text: str) -> Optional[int]:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            for g in match.groups():
                if g is not None:
                    try:
                        return int(g)
                    except ValueError:
                        pass
        return None

    async def get_supplies(self) -> Dict[str, Optional[int]]:
        """Scrape supply levels from information.html."""
        try:
            html = await self._fetch_info_page()
            if html is None:
                return {
                    "toner_level": None, "drum_level": None, "fuser_level": None,
                    "laser_unit_level": None, "pf_kit_mp_level": None, "pf_kit_1_level": None,
                }
                
            # Normalize HTML space entities
            html = html.replace('&#32;', ' ')
            text_html = re.sub(r'<[^>]+>', ' ', html)
            text_html = re.sub(r'\s+', ' ', text_html)

            supplies: Dict[str, Optional[int]] = {
                "toner_level": None,
                "drum_level": None,
                "fuser_level": None,
                "laser_unit_level": None,
                "pf_kit_mp_level": None,
                "pf_kit_1_level": None,
            }

            # --- Direct % items (Toner, Drum) ---
            # Format: <dt>Toner**</dt><dd>90%</dd>
            for key, pat in [
                ("toner_level", r'<dt[^>]*>\s*Toner[*\s]*</dt>\s*<dd[^>]*>\s*(\d+)%'),
                ("drum_level",  r'<dt[^>]*>\s*Drum(?:\s+Unit)?[*\s]*</dt>\s*<dd[^>]*>\s*(\d+)%'),
            ]:
                m = re.search(pat, html, re.IGNORECASE)
                if m:
                    supplies[key] = int(m.group(1))

            # Fallback for firmware that renders the same fields in tables or
            # adds markup between the label and value.
            for key, label in [("toner_level", "Toner"), ("drum_level", "Drum")]:
                if supplies[key] is None:
                    m = re.search(r'\b' + label + r'(?:\s+Unit)?\b.{0,180}?(\d+)\s*%', text_html, re.IGNORECASE)
                    if m:
                        supplies[key] = int(m.group(1))

            # --- Page-count items with (% of Life Remaining) on the next dt/dd ---
            # Format: <dt>Fuser Unit</dt><dd>167195 Page(s)</dd>
            #         <dt>(% of Life Remaining)</dt><dd>(84%)</dd>
            for key, name_pat in [
                ("fuser_level",      r"(?:Fuser|Fusing|Fixing)(?:&#32;|\s)+(?:Unit|Assembly|Kit)?"),
                ("laser_unit_level", r"(?:Laser|ROS)(?:&#32;|\s)+(?:Unit|Scanner)?"),
                ("pf_kit_mp_level",  r"(?:PF|Paper(?:&#32;|\s)+Feed(?:ing)?)(?:&#32;|\s)+(?:Kit|Roller)(?:&#32;|\s)+(?:MP|Bypass)"),
                ("pf_kit_1_level",   r"(?:PF|Paper(?:&#32;|\s)+Feed(?:ing)?)(?:&#32;|\s)+(?:Kit|Roller)(?:&#32;|\s)+(?:1|Tray(?:&#32;|\s)+1)"),
            ]:
                # Find the <dt> for this item, then grab the (XX%) in the following <dd>
                m = re.search(
                    r'<dt[^>]*>(?:&#32;|\s)*' + name_pat + r'(?:&#32;|\s)*[*\s]*</dt>.{0,500}?<dd[^>]*>(?:&#32;|\s)*\(?(?:&#32;|\s)*(\d+)(?:&#32;|\s)*%(?:&#32;|\s)*\)?(?:&#32;|\s)*</dd>',
                    html, re.IGNORECASE | re.DOTALL
                )
                if m:
                    supplies[key] = int(m.group(1))
                else:
                    m = re.search(name_pat + r'.{0,240}?(\d+)\s*%', text_html, re.IGNORECASE)
                    if m:
                        supplies[key] = int(m.group(1))

            # Fallback to SNMP for missing items (Fuser, Laser, PF Kits)
            if any(v is None for v in supplies.values()):
                try:
                    from app.snmp.standard import StandardSNMPAdapter
                    snmp_adapter = StandardSNMPAdapter(self.ip, "public", "v2c", timeout=2)
                    snmp_supplies = await snmp_adapter.get_supplies()
                    for k, v in snmp_supplies.items():
                        if supplies.get(k) is None and v is not None:
                            supplies[k] = v
                    snmp_adapter.close()
                except Exception as e:
                    logger.warning(f"[Apeos {self.ip}] SNMP fallback for supplies error: {e}")

            return supplies
        except Exception as e:
            logger.error(f"[Apeos {self.ip}] get_supplies error: {e}")
            return {"toner_level": None, "drum_level": None}


    async def get_counters(self) -> Dict[str, Any]:
        """Page counter from authenticated information page."""
        try:
            html = await self._fetch_info_page()
            if html is None:
                return {"total_pages": 0}

            # <dt>Page Counter</dt><dd>2356</dd>
            m = re.search(r'<dt>Page&#32;Counter</dt><dd>(\d+)</dd>', html)
            if m:
                return {"total_pages": int(m.group(1))}
        except Exception as e:
            logger.error(f"[Apeos {self.ip}] get_counters error: {e}")
        return {"total_pages": 0}

    def close(self):
        """Compatibility stub with StandardSNMPAdapter interface."""
        self._cookie = None   # clear cached session
        self._info_html = None

    # ── Internal helpers ──────────────────────────────────────────────────

    async def _fetch_info_page(self) -> Optional[str]:
        """
        Fetch https://{ip}/general/information.html?kind=item.
        Logs in automatically if no valid session cookie is cached.
        Caches the HTML page after successful fetch to reduce network requests.
        """
        if self._info_html:
            return self._info_html
            
        path = "/general/information.html?kind=item"

        # Login
        cookie = await self._login()
        if not cookie:
            return None

        self._cookie = cookie
        html = await self._fetch_https(path, cookie=self._cookie)
        if html and "Please&#32;Login" not in html and "Please Login" not in html:
            self._info_html = html
            return html
        return None

    async def _login(self) -> Optional[str]:
        """Login to Apeos web interface and return AuthCookie using urllib in a thread."""
        if self._cookie:
            return self._cookie

        def _do_login():
            import urllib.request
            import urllib.parse
            import ssl

            class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
                def redirect_request(self, req, fp, code, msg, headers, newurl):
                    return None

            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE

            opener = urllib.request.build_opener(NoRedirectHandler, urllib.request.HTTPSHandler(context=ctx))
            
            def attempt_login(base_url):
                url = f"{base_url}/home/status.html"
                req1 = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                html = ""
                with opener.open(req1, timeout=self.timeout) as resp1:
                    html = resp1.read().decode('utf-8', errors='ignore')

                pwd_field_match = re.search(r'<input\s+[^>]*type="password"[^>]*name="([^"]+)"', html, re.IGNORECASE)
                pwd_field = pwd_field_match.group(1) if pwd_field_match else "B1859"

                data = {
                    pwd_field: self.password,
                    "loginurl": "/general/information.html?kind=item"
                }
                body = urllib.parse.urlencode(data).encode('utf-8')

                req2 = urllib.request.Request(url, data=body, headers={"User-Agent": "Mozilla/5.0", "Content-Type": "application/x-www-form-urlencoded"})
                try:
                    resp2 = opener.open(req2, timeout=self.timeout)
                    headers = resp2.headers
                except urllib.error.HTTPError as e:
                    headers = e.headers
                return headers

            try:
                headers = attempt_login(self._https)
                self._base_url_working = self._https
            except Exception as e:
                headers = attempt_login(self._http)
                self._base_url_working = self._http

            cookie_str = headers.get('Set-Cookie', '')
            match = re.search(r"(?:^|;)\s*AuthCookie=([^;]+)", cookie_str)
            if match:
                return match.group(1)
            else:
                logger.error(f"[Apeos {self.ip}] AuthCookie not found in urllib headers")
                return None

        import asyncio
        try:
            cookie = await asyncio.to_thread(_do_login)
            if cookie:
                self._cookie = cookie
                return cookie
            return None
        except Exception as e:
            logger.error(f"[Apeos {self.ip}] Login error: {e}")
            return None

    async def _fetch_http(self, path: str) -> Optional[str]:
        """GET from http://{ip}{path} (no auth, no TLS)."""
        try:
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True, trust_env=False) as client:
                resp = await client.get(
                    self._http + path,
                    headers={"User-Agent": "Mozilla/5.0"}
                )
                if resp.status_code == 200:
                    return resp.content.decode("iso-8859-1", errors="replace")
                logger.warning(f"[Apeos {self.ip}] HTTP {resp.status_code} for {path}")
                return None
        except httpx.TimeoutException:
            logger.warning(f"[Apeos {self.ip}] Timeout: {path}")
            return None
        except Exception as e:
            logger.warning(f"[Apeos {self.ip}] HTTP fetch error {path}: {e}")
            return None

    async def _fetch_https(self, path: str, cookie: str) -> Optional[str]:
        """GET from https://{ip}{path} with AuthCookie (ignores TLS cert)."""
        base_url = getattr(self, "_base_url_working", self._https)
        try:
            async with httpx.AsyncClient(
                verify=False,
                timeout=self.timeout,
                follow_redirects=True,
                trust_env=False
            ) as client:
                resp = await client.get(
                    base_url + path,
                    headers={
                        "User-Agent": "Mozilla/5.0",
                        "Cookie":     f"AuthCookie={cookie}"
                    }
                )
                if resp.status_code == 200:
                    return resp.content.decode("iso-8859-1", errors="replace")
                logger.warning(f"[Apeos {self.ip}] HTTPS {resp.status_code} for {path}")
                return None
        except httpx.TimeoutException:
            logger.warning(f"[Apeos {self.ip}] HTTPS timeout: {path}")
            return None
        except Exception as e:
            logger.warning(f"[Apeos {self.ip}] HTTPS fetch error {path}: {e}")
            return None
