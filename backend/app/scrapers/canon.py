"""
Canon HTTP Scraper - stub placeholder
Uses SNMP fallback via StandardSNMPAdapter
"""
from typing import Optional, Tuple
from app.snmp.standard import StandardSNMPAdapter


class CanonHTTPScraper(StandardSNMPAdapter):
    """Canon printer scraper - falls back to SNMP for supply data."""
    
    def __init__(self, ip: str, community: str = "public", version: str = "v2c", timeout: int = 3):
        super().__init__(ip=ip, community=community, version=version, timeout=timeout)

    async def get_status(self) -> Tuple[str, Optional[str]]:
        import httpx
        urls = [
            f"http://{self.ip}/",
            f"https://{self.ip}/"
        ]
        for url in urls:
            try:
                async with httpx.AsyncClient(verify=False, timeout=4.0) as client:
                    res = await client.get(url, follow_redirects=True)
                    if res.status_code == 200:
                        return "ONLINE", "Ready (HTTP)"
            except Exception:
                continue
        return await super().get_status()

    async def get_system_info(self) -> dict:
        import httpx
        import re
        info = await super().get_system_info()
        if not info.get("sysName") or not info.get("model"):
            try:
                async with httpx.AsyncClient(verify=False, timeout=4.0) as client:
                    res = await client.get(f"http://{self.ip}/", follow_redirects=True)
                    if res.status_code == 200:
                        info["sysDescr"] = info.get("sysDescr") or "Canon Printer (HTTP)"
                        info["model"] = info.get("model") or "Canon Printer"
                        m = re.search(r"<title>\s*Canon\s+([^<]+)</title>", res.text, re.IGNORECASE)
                        if m:
                            info["model"] = m.group(1).strip()
            except Exception:
                pass
        return info
