"""Printer Service and Unified Identification Layer.
Detects printer manufacturer, model, serial, status, counters, and web interface.
"""

import asyncio
import re
import socket
import subprocess
from typing import Any, Dict, Optional, Tuple
from services.apeos import apeos_adapter
from services.snmp import OIDS, SNMPService, snmp_service

KNOWN_MANUFACTURERS = [
    ("FUJIFILM", ["fujifilm", "fuji xerox", "apeos", "docuprint", "docucentre"]),
    ("Xerox", ["xerox", "phaser", "workcentre", "versalink", "altalink"]),
    ("Brother", ["brother", "hl-", "mfc-", "dcp-"]),
    ("HP", ["hp", "hewlett-packard", "laserjet", "page wide", "deskjet", "officejet"]),
    ("Canon", ["canon", "imagerunner", "lbp", "imageclass", "pixma", "maxify"]),
    ("Epson", ["epson", "workforce", "ecotank", "surecolor"]),
    ("Ricoh", ["ricoh", "aficio", "mp c", "sp c"]),
    ("Kyocera", ["kyocera", "ecosys", "taskalfa"]),
    ("Lexmark", ["lexmark", "ms", "mx", "cs", "cx"]),
    ("Konica Minolta", ["konica", "minolta", "bizhub"]),
    ("Pantum", ["pantum"]),
    ("Samsung", ["samsung", "xpress", "proxpress"]),
]


def get_mac_address(ip: str) -> str:
    """Retrieve MAC address from local ARP table (Windows / Linux)."""
    try:
        res = subprocess.run(["arp", "-a", ip], capture_output=True, text=True, timeout=1.5)
        out = res.stdout
        match = re.search(r"([0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2})", out)
        if match:
            return match.group(1).replace("-", ":").upper()
    except Exception:
        pass
    return ""


async def check_tcp_port(ip: str, port: int, timeout: float = 1.0) -> bool:
    """Check if a TCP port is open on target IP."""
    loop = asyncio.get_running_loop()
    def _probe():
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        try:
            sock.connect((ip, port))
            sock.close()
            return True
        except Exception:
            return False
    return await loop.run_in_executor(None, _probe)


async def check_http_management(ip: str, timeout: float = 1.0) -> Tuple[bool, str, str]:
    """Check if HTTP / HTTPS web management interface exists and extract page title."""
    loop = asyncio.get_running_loop()
    def _http_probe():
        import urllib.request
        import urllib.error
        for proto, port in [("http", 80), ("https", 443)]:
            # Fast socket check first
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(0.4)
            try:
                s.connect((ip, port))
                s.close()
            except Exception:
                s.close()
                continue

            url = f"{proto}://{ip}"
            try:
                req = urllib.request.Request(
                    url,
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PrinterMonitor/1.0"}
                )
                with urllib.request.urlopen(req, timeout=timeout) as response:
                    raw_html = response.read(4096).decode("utf-8", errors="ignore")
                    title_match = re.search(r"<title>(.*?)</title>", raw_html, re.IGNORECASE)
                    title = title_match.group(1).strip() if title_match else ""
                    return True, url, title
            except Exception:
                return True, url, ""
        return False, f"http://{ip}", ""

    return await loop.run_in_executor(None, _http_probe)


class PrinterService:
    """Unified Printer Service for device probing and classification."""

    def __init__(self, snmp: SNMPService = snmp_service):
        self.snmp = snmp
        self.apeos = apeos_adapter

    def detect_manufacturer_and_model(
        self,
        sys_descr: str,
        sys_object_id: str,
        snmp_data: Dict[str, Any],
        http_title: str = ""
    ) -> Tuple[str, str]:
        """Classify manufacturer and model name from device metadata."""
        combined = f"{sys_descr} {sys_object_id} {http_title} " + " ".join(
            str(v) for v in snmp_data.values() if isinstance(v, str)
        )
        combined_lower = combined.lower()

        # 1. FUJIFILM Apeos check
        if self.apeos.identify(sys_descr, sys_object_id, snmp_data):
            model = self.apeos.extract_model_name(sys_descr, snmp_data)
            return "FUJIFILM", model

        # 2. Other known manufacturers
        for brand, keywords in KNOWN_MANUFACTURERS:
            for kw in keywords:
                if kw in combined_lower:
                    # Model extraction heuristic
                    model = f"{brand} Printer"
                    name_oid = OIDS["prtGeneralPrinterName"].strip(".")
                    if name_oid in snmp_data and snmp_data[name_oid]:
                        model = str(snmp_data[name_oid])
                    elif sys_descr:
                        # Take first line or up to 40 chars
                        model = sys_descr.split("\n")[0].split(",")[0][:45].strip()
                    return brand, model

        return "Standard Printer", "Network Printer"

    async def probe_device(self, ip: str) -> Optional[Dict[str, Any]]:
        """Probe an IP address to determine if it is a printer and collect full details."""
        # 1. First probe SNMP standard values
        raw_snmp = await self.snmp.query(ip, list(OIDS.values()))
        has_snmp = bool(raw_snmp)

        # 2. Probe HTTP web interface
        has_http, web_url, http_title = await check_http_management(ip)

        # If neither SNMP nor HTTP responded, it's not a reachable web/SNMP printer
        if not has_snmp and not has_http:
            return None

        sys_descr = str(raw_snmp.get(OIDS["sysDescr"].strip("."), "") or "")
        sys_obj = str(raw_snmp.get(OIDS["sysObjectID"].strip("."), "") or "")
        sys_name = str(raw_snmp.get(OIDS["sysName"].strip("."), "") or "")
        sys_loc = str(raw_snmp.get(OIDS["sysLocation"].strip("."), "") or "")
        serial = str(raw_snmp.get(OIDS["prtGeneralSerialNumber"].strip("."), "") or "N/A")

        # Check if Apeos
        if self.apeos.identify(sys_descr, sys_obj, raw_snmp):
            info = await self.apeos.get_info(ip, self.snmp)
            info["mac_address"] = get_mac_address(ip)
            info["web_url"] = web_url
            return info

        # Generic Printer MIB extraction
        manufacturer, model = self.detect_manufacturer_and_model(sys_descr, sys_obj, raw_snmp, http_title)
        std_info = await self.snmp.get_standard_printer_info(ip)

        status = "ONLINE"
        toner_pct = std_info.get("toner_percent")
        drum_pct = std_info.get("drum_percent")
        if toner_pct is not None:
            if toner_pct <= 0:
                status = "ERROR"
            elif toner_pct <= 15:
                status = "WARNING"

        return {
            "ip_address": ip,
            "hostname": sys_name or ip,
            "device_name": std_info.get("name") or f"{manufacturer} {model}",
            "manufacturer": manufacturer,
            "model": model,
            "serial_number": serial if serial and serial != "N/A" else (std_info.get("serial") or "N/A"),
            "location": sys_loc,
            "mac_address": get_mac_address(ip),
            "status": status,
            "page_count": std_info.get("page_count") or 0,
            "toner_black": toner_pct or 0,
            "drum_level": drum_pct or 0,
            "firmware_version": "",
            "snmp_version": "v2c",
            "web_url": web_url,
            "raw_data": raw_snmp
        }


# Singleton printer service
printer_service = PrinterService()
