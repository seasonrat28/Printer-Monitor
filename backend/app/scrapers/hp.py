import httpx
import re
import logging
from typing import Dict, Any, Optional

from app.snmp.standard import StandardSNMPAdapter

logger = logging.getLogger(__name__)

class HPHTTPScraper(StandardSNMPAdapter):
    """
    Scraper that fetches from HP HTML Web UI to match exact displayed values.
    Falls back to SNMP if HTTP fails.
    """
    def __init__(self, ip: str, community: str = "public", version: str = "v2c", timeout: int = 3):
        super().__init__(ip, community, version, timeout)
        
    async def get_supplies(self) -> Dict[str, Any]:
        # Base supplies from SNMP (This ensures we catch items like Drums that HP Web UI hides!)
        base_supplies = await super().get_supplies()

        # 1. Try modern HP Angular API first
        api_urls = [
            f"https://{self.ip}/cdm/supply/v1/suppliesPublic",
            f"http://{self.ip}/cdm/supply/v1/suppliesPublic"
        ]
        
        for url in api_urls:
            try:
                headers = {
                    "Accept": "application/json, text/plain, */*",
                    "User-Agent": "Mozilla/5.0"
                }
                async with httpx.AsyncClient(verify=False, timeout=5.0, trust_env=False) as client:
                    res = await client.get(url, headers=headers, follow_redirects=True)
                    if res.status_code == 200:
                        data = res.json()
                        if "suppliesList" in data:
                            logger.info(f"HPHTTPScraper [{self.ip}]: Successfully fetched JSON API")
                            
                            for item in data["suppliesList"]:
                                if "percentLifeDisplay" not in item or "colors" not in item:
                                    continue
                                
                                val = item["percentLifeDisplay"]
                                colors = item["colors"]
                                stype = item.get("supplyType", "").lower()
                                
                                # Ink or Toner
                                if "ink" in stype or "toner" in stype or "cartridge" in stype:
                                    if "C" in colors: base_supplies["toner_cyan_level"] = val
                                    if "M" in colors: base_supplies["toner_magenta_level"] = val
                                    if "Y" in colors: base_supplies["toner_yellow_level"] = val
                                    if "K" in colors: base_supplies["toner_black_level"] = val
                                
                                # Drums / Imaging units
                                elif "drum" in stype or "imaging" in stype:
                                    if "C" in colors: base_supplies["drum_cyan_level"] = val
                                    if "M" in colors: base_supplies["drum_magenta_level"] = val
                                    if "Y" in colors: base_supplies["drum_yellow_level"] = val
                                    if "K" in colors: base_supplies["drum_black_level"] = val
                            
                            # Recalculate lowest toner level
                            toner_levels = [
                                l for l in (
                                    base_supplies.get("toner_black_level"), base_supplies.get("toner_cyan_level"),
                                    base_supplies.get("toner_magenta_level"), base_supplies.get("toner_yellow_level")
                                ) if l is not None
                            ]
                            base_supplies["toner_level"] = min(toner_levels) if toner_levels else None
                            
                            base_supplies["_source"] = "hp_json_api"
                            return base_supplies
            except Exception as e:
                logger.error(f"HPHTTPScraper [{self.ip}]: JSON API fetch failed for {url} - {str(e)}")
                continue

        # 2. Fall back to legacy HTML scraper
        urls = [
            f"https://{self.ip}/hp/device/DeviceStatus/Index",
            f"http://{self.ip}/hp/device/DeviceStatus/Index"
        ]
        
        html = None
        for url in urls:
            try:
                async with httpx.AsyncClient(verify=False, timeout=5.0, trust_env=False) as client:
                    res = await client.get(url, follow_redirects=True)
                    if res.status_code == 200:
                        html = res.text
                        logger.info(f"HPHTTPScraper [{self.ip}]: Successfully fetched HTML {url}")
                        break
            except Exception as e:
                continue
                
        if html:
            # Regex to find cartridges
            matches = re.findall(r'<h2 id="SupplyName\d+" title="([^"]+)">.*?<span id="SupplyPLR\d+" class="plr">(\d+)%\*?</span>', html, re.DOTALL)
            
            if matches:
                for name, value in matches:
                    name_lower = name.lower()
                    val = int(value)
                    
                    if "black" in name_lower and "cartridge" in name_lower:
                        base_supplies["toner_black_level"] = val
                    elif "cyan" in name_lower and "cartridge" in name_lower:
                        base_supplies["toner_cyan_level"] = val
                    elif "magenta" in name_lower and "cartridge" in name_lower:
                        base_supplies["toner_magenta_level"] = val
                    elif "yellow" in name_lower and "cartridge" in name_lower:
                        base_supplies["toner_yellow_level"] = val
                        
                for name, value in matches:
                    name_lower = name.lower()
                    val = int(value)
                    if "fuser" in name_lower or "fixing" in name_lower:
                        base_supplies["fuser_level"] = val
                    elif "document feeder" in name_lower or "feed kit" in name_lower or "pf kit 1" in name_lower:
                        base_supplies["pf_kit_1_level"] = val
                    elif "pf kit mp" in name_lower or "bypass" in name_lower or "multipurpose" in name_lower:
                        base_supplies["pf_kit_mp_level"] = val
                    elif "drum" in name_lower or "imaging unit" in name_lower or "photoconductor" in name_lower:
                        if "black" in name_lower:
                            base_supplies["drum_black_level"] = val
                        elif "cyan" in name_lower:
                            base_supplies["drum_cyan_level"] = val
                        elif "magenta" in name_lower:
                            base_supplies["drum_magenta_level"] = val
                        elif "yellow" in name_lower:
                            base_supplies["drum_yellow_level"] = val
                        else:
                            base_supplies["drum_level"] = val

                toner_levels = [
                    l for l in (
                        base_supplies.get("toner_black_level"), base_supplies.get("toner_cyan_level"),
                        base_supplies.get("toner_magenta_level"), base_supplies.get("toner_yellow_level")
                    ) if l is not None
                ]
                base_supplies["toner_level"] = min(toner_levels) if toner_levels else None

                base_supplies["_source"] = "hp_web"
                return base_supplies
            
        return base_supplies
