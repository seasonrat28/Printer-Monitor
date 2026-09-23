import httpx
import re
from typing import Dict, Any, Optional

from app.snmp.standard import StandardSNMPAdapter
from app.core.logger import logger

class CanonHTTPScraper(StandardSNMPAdapter):
    """
    Scraper for Canon printers that expose status via /JS_MDL/model.js
    (e.g., Canon GX7000 series and similar models).
    """

    def __init__(self, ip: str, community: str = "public", version: str = "v2c", timeout: int = 3):
        super().__init__(ip, community, version, timeout)

    async def get_status(self) -> tuple[str, Optional[str]]:
        """
        Fetch status from Canon model.js.
        Returns: (status, status_message)
        """
        url = f"http://{self.ip}/JS_MDL/model.js"
        
        try:
            async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
                response = await client.get(url)
                response.raise_for_status()
                
                js_content = response.text
                
                # Parse status
                status = "UNKNOWN"
                status_message = None
                err_msg_match = re.search(r"var g_err_msg_id\s*=\s*'([^']+)';", js_content)
                if err_msg_match:
                    err_msg = err_msg_match.group(1)
                    status_message = err_msg
                    if err_msg == "HTTP_ERR_DISP_IDLE":
                        status = "READY"
                        status_message = "Ready"
                    elif "SLEEP" in err_msg:
                        status = "READY"
                        status_message = "Sleep"
                    elif "PRINTING" in err_msg or "BUSY" in err_msg:
                        status = "PRINTING"
                    elif "ERR" in err_msg or "ERROR" in err_msg:
                        status = "ERROR"
                    else:
                        status = err_msg
                        
                return status, status_message
                
        except Exception as e:
            logger.error(f"Canon HTTP connection error for {self.ip}: {str(e)}")
            # Fallback to SNMP
            return await super().get_status()

    async def get_supplies(self) -> Dict[str, Any]:
        url = f"http://{self.ip}/JS_MDL/model.js"
        supplies: Dict[str, Any] = {}
        try:
            async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
                response = await client.get(url)
                response.raise_for_status()
                js_content = response.text
                
                # Parse Ink colors array
                ink_cols_match = re.search(r"var inkCOL\s*=\s*\[(.*?)\];", js_content)
                ink_colors = []
                if ink_cols_match:
                    cols_str = ink_cols_match.group(1)
                    # Extract strings from ['InkBlk', 'InkCia', ...]
                    ink_colors = re.findall(r"'([^']+)'", cols_str)

                # inktank[0]=[0,8,0] or [0,8,0,0]
                inktank_matches = re.finditer(r"inktank\[(\d+)\]\s*=\s*\[(.*?)\];", js_content)
                
                for match in inktank_matches:
                    idx = int(match.group(1))
                    values = [v.strip() for v in match.group(2).split(',')]
                    if len(values) < 2:
                        continue
                    level_raw = int(values[1]) # The actual level, e.g., 8
                    
                    if idx < len(ink_colors):
                        color_code = ink_colors[idx]
                        # Map Canon color codes to our standard codes
                        color_map = {
                            'InkBlk': 'black',
                            'InkCia': 'cyan',
                            'InkMaz': 'magenta',
                            'InkYel': 'yellow'
                        }
                        mapped_color = color_map.get(color_code, color_code.lower())
                        
                        max_level = 10
                        
                        level_pct = min(100, max(0, int((level_raw / max_level) * 100)))
                        key = f"toner_{mapped_color}_level"
                        supplies[key] = level_pct
                        
                        if mapped_color == 'black':
                            supplies["toner_level"] = level_pct

                # Parse maintenance cartridge (cartridge_rest)
                cart_match = re.search(r"var g_cartridge_rest\s*=\s*\[(\d+),\s*(\d+)\];", js_content)
                if cart_match:
                    cart_level = int(cart_match.group(1))
                    supplies["maintenance_kit_level"] = int((cart_level / 10) * 100)  # Assume max 10

        except Exception as e:
            logger.error(f"Canon HTTP parse error for {self.ip}: {str(e)}")
            
        if not supplies:
            return await super().get_supplies()
            
        return supplies

    async def get_system_info(self) -> Dict[str, Any]:
        info = await super().get_system_info()
        url = f"http://{self.ip}/JS_MDL/model.js"
        try:
            async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
                response = await client.get(url)
                if response.status_code == 200:
                    model_match = re.search(r"DEV=([^&]+)", response.text)
                    if model_match:
                        info["model"] = "Canon " + model_match.group(1).replace('+', ' ')
        except Exception:
            pass
        return info
