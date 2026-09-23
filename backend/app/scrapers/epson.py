import httpx
import re
import logging
from typing import Dict, Any, Optional

from app.snmp.standard import StandardSNMPAdapter

logger = logging.getLogger(__name__)

class EpsonHTTPScraper(StandardSNMPAdapter):
    """
    Scraper for Epson wide-format printers (SC-T series, etc.)
    Reads ink levels from CSS linear-gradient percentages in the web UI.
    Falls back to SNMP if HTTP fails.
    """

    def __init__(self, ip: str, community: str = "public", version: str = "v2c", timeout: int = 3):
        super().__init__(ip, community, version, timeout)

    async def get_supplies(self) -> Dict[str, Any]:
        # Check both the Wide-Format and EcoTank endpoints
        urls = [
            f"http://{self.ip}/PRESENTATION/ADVANCED/INFO_PRTINFO/TOP",
            f"http://{self.ip}/PRESENTATION/HTML/TOP/PRTINFO.HTML"
        ]
        
        html = None
        used_url = None
        for url in urls:
            try:
                async with httpx.AsyncClient(verify=False, timeout=6.0, trust_env=False) as client:
                    res = await client.get(url, follow_redirects=True)
                    if res.status_code == 200:
                        html = res.text
                        used_url = url
                        logger.info(f"EpsonHTTPScraper [{self.ip}]: fetched {url}")
                        break
            except Exception as e:
                logger.error(f"EpsonHTTPScraper [{self.ip}]: {url} failed: {e}")
                continue

        if not html:
            return await super().get_supplies()

        supplies: Dict[str, Any] = {
            "toner_level": None,
            "toner_black_level": None,
            "toner_cyan_level": None,
            "toner_magenta_level": None,
            "toner_yellow_level": None,
            "toner_photo_black_level": None,
            "toner_matte_black_level": None,
            "toner_red_level": None,
            "drum_level": None,
            "drum_black_level": None,
            "drum_cyan_level": None,
            "drum_magenta_level": None,
            "drum_yellow_level": None,
            "fuser_level": None,
            "laser_unit_level": None,
            "pf_kit_mp_level": None,
            "pf_kit_1_level": None,
            "_source": "epson_web",
        }

        parsed_any = False

        # Pattern 1: Wide-Format (e.g., SC-T series) using CSS linear-gradient
        tank_pattern = re.compile(
            r"<div class='tank'[^>]*linear-gradient\(to top,[^)]*?(?:#[0-9a-fA-F]{6}|rgb[^)]*)\s+\d+%,\s*"
            r"(?:#[0-9a-fA-F]{6}|rgb[^)]*)\s+(\d+)%",
            re.DOTALL
        )
        label_pattern = re.compile(r"<div class='clrname'>([^<]+)</div>")
        
        tank_levels = [int(m.group(1)) for m in tank_pattern.finditer(html)]
        labels = [m.group(1).strip() for m in label_pattern.finditer(html)]

        if tank_levels and labels:
            logger.info(f"EpsonHTTPScraper [{self.ip}]: Found WF format: levels={tank_levels}, labels={labels}")
            for i, label in enumerate(labels):
                if i >= len(tank_levels):
                    break
                pct = tank_levels[i]
                lu = label.upper()
                if lu == "PK":
                    supplies["toner_photo_black_level"] = pct
                    if supplies["toner_black_level"] is None:
                        supplies["toner_black_level"] = pct
                elif lu == "MK":
                    supplies["toner_matte_black_level"] = pct
                elif lu in ("K", "BK"):
                    supplies["toner_black_level"] = pct
                elif lu == "C":
                    supplies["toner_cyan_level"] = pct
                elif lu == "M":
                    supplies["toner_magenta_level"] = pct
                elif lu == "Y":
                    supplies["toner_yellow_level"] = pct
                elif lu == "R":
                    supplies["toner_red_level"] = pct
            parsed_any = True

        # Pattern 2: EcoTank (e.g., L6460 series) using <img> height
        # <img class='color' src='../../IMAGE/Ink_K.PNG' height='17' style=''> ... <div class='clrname'>BK</div>
        if not parsed_any:
            # We match the height and then the next clrname
            # The max height of the ink image is usually 50 pixels for 100%
            eco_pattern = re.compile(r"<img class='color'[^>]*height='(\d+)'[^>]*>.*?</div[^>]*>.*?<div class='clrname'>([^<]+)</div>", re.DOTALL)
            eco_matches = eco_pattern.findall(html)
            if eco_matches:
                logger.info(f"EpsonHTTPScraper [{self.ip}]: Found EcoTank format: {eco_matches}")
                for height_str, label in eco_matches:
                    h = int(height_str)
                    # Max height is 50px
                    pct = min(100, int((h / 50.0) * 100))
                    
                    lu = label.strip().upper()
                    if lu in ("K", "BK"):
                        supplies["toner_black_level"] = pct
                    elif lu == "C":
                        supplies["toner_cyan_level"] = pct
                    elif lu == "M":
                        supplies["toner_magenta_level"] = pct
                    elif lu == "Y":
                        supplies["toner_yellow_level"] = pct
                parsed_any = True

        if not parsed_any:
            logger.warning(f"EpsonHTTPScraper [{self.ip}]: parse failed, falling back to SNMP")
            return await super().get_supplies()

        # Overall toner = min of all ink levels found
        all_levels = [v for k, v in supplies.items()
                      if k.startswith("toner_") and k != "toner_level" and v is not None]
        supplies["toner_level"] = min(all_levels) if all_levels else None

        return supplies
