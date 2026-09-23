import asyncio
from typing import Dict, Any, Optional
from pysnmp.hlapi.asyncio import *

from app.snmp.base import SNMPAdapter

class StandardSNMPAdapter(SNMPAdapter):
    SYSTEM_OIDS = {
        "description": "1.3.6.1.2.1.1.1.0",
        "name": "1.3.6.1.2.1.1.5.0",
        "location": "1.3.6.1.2.1.1.6.0",
        "serial": "1.3.6.1.2.1.43.5.1.1.17.1",
        "model": "1.3.6.1.2.1.43.5.1.1.16.1",
    }

    def __init__(self, ip: str, community: str = "public", version: str = "v2c", timeout: int = 2, retries: int = 1):
        super().__init__(ip, community, version)
        self.timeout = timeout
        self.retries = retries
        self.snmp_engine = SnmpEngine()
        
    def close(self):
        if hasattr(self.snmp_engine, 'transportDispatcher') and self.snmp_engine.transportDispatcher:
            self.snmp_engine.transportDispatcher.closeDispatcher()

    async def _get_oid(self, oid: str) -> Optional[str]:
        try:
            errorIndication, errorStatus, errorIndex, varBinds = await get_cmd(
                self.snmp_engine,
                CommunityData(self.community, mpModel=1 if self.version == "v2c" else 0),
                await UdpTransportTarget.create((self.ip, 161), timeout=self.timeout, retries=self.retries),
                ContextData(),
                ObjectType(ObjectIdentity(oid))
            )
        except (OSError, TimeoutError, asyncio.TimeoutError):
            return None
        except Exception:
            return None
        if errorIndication or errorStatus or not varBinds:
            return None
        return str(varBinds[0][1])

    async def get_system_info(self) -> Dict[str, Any]:
        values = {name: await self._get_oid(oid) for name, oid in self.SYSTEM_OIDS.items()}
        
        return {
            "sysDescr": values["description"],
            "sysName": values["name"],
            "sysLocation": values["location"],
            "serialNumber": values["serial"],
            "model": values["model"]
        }

    async def get_status(self) -> tuple[str, Optional[str]]:
        # Standard Host Resources MIB hrPrinterStatus (1.3.6.1.2.1.25.3.5.1.1.1)
        status_val = await self._get_oid("1.3.6.1.2.1.25.3.5.1.1.1")
        
        # prtConsoleDisplayBufferText line 1 (1.3.6.1.2.1.43.16.5.1.2.1.1)
        status_message = await self._get_oid("1.3.6.1.2.1.43.16.5.1.2.1.1")
        if not status_message or status_message.strip().lower() in ["ready", "sleeping", "power saver", ""]:
            # Fallback to prtAlertDescription (1.3.6.1.2.1.43.18.1.1.8)
            alerts = await self._walk_oid("1.3.6.1.2.1.43.18.1.1.8")
            if alerts:
                valid_alerts = [msg.strip() for msg in alerts.values() if msg and msg.strip() and msg.strip().lower() not in ["ready", "no error"]]
                if valid_alerts:
                    status_message = " | ".join(valid_alerts)
            
        if status_message:
            status_message = status_message.strip()
            
        final_status = "UNKNOWN"
        
        # If hrPrinterStatus is missing, try hrDeviceStatus (1.3.6.1.2.1.25.3.2.1.5.1)
        if not status_val:
            device_status = await self._get_oid("1.3.6.1.2.1.25.3.2.1.5.1")
            if device_status:
                device_status_map = {"1": "UNKNOWN", "2": "ONLINE", "3": "WARNING", "4": "OFFLINE", "5": "OFFLINE"}
                final_status = device_status_map.get(device_status, "UNKNOWN")
        else:
            # 1: other, 2: unknown, 3: idle, 4: printing, 5: warmup
            status_map = {"3": "ONLINE", "4": "ONLINE", "5": "ONLINE", "1": "WARNING", "2": "UNKNOWN"}
            final_status = status_map.get(status_val, "UNKNOWN")
            
        if final_status in ["ONLINE", "WARNING"] and status_message:
            text_lower = status_message.lower()
            if any(w in text_lower for w in ["low", "empty", "please order"]):
                final_status = "WARNING"
            if any(w in text_lower for w in ["jam", "error", "replace", "open", "offline", "cannot print", "paper out"]):
                final_status = "ERROR"
            
        return final_status, status_message

    async def _walk_oid(self, oid: str) -> Dict[str, str]:
        results = {}
        current_oid = ObjectType(ObjectIdentity(oid))
        while True:
            try:
                errorIndication, errorStatus, errorIndex, varBinds = await next_cmd(
                    self.snmp_engine,
                    CommunityData(self.community, mpModel=1 if self.version == "v2c" else 0),
                    await UdpTransportTarget.create(
                        (self.ip, 161), timeout=self.timeout, retries=self.retries
                    ),
                    ContextData(),
                    current_oid
                )
                if errorIndication or errorStatus or not varBinds:
                    break
                    
                varBind = varBinds[0]
                oid_str = str(varBind[0])
                if not oid_str.startswith(oid):
                    break
                    
                idx = oid_str[len(oid):].strip('.')
                results[idx] = str(varBind[1])
                current_oid = ObjectType(ObjectIdentity(oid_str))
            except Exception:
                break
        return results

    async def get_supplies(self) -> Dict[str, Any]:
        try:
            # Check if this is a FujiFilm/FujiXerox printer
            sys_descr = await self._get_oid("1.3.6.1.2.1.1.1.0")
            sys_descr_lower = sys_descr.lower() if sys_descr else ""
            is_fuji = "fuji" in sys_descr_lower or "apeos" in sys_descr_lower
            
            # 1.3.6.1.2.1.43.11.1.1.6 - prtMarkerSuppliesDescription
            # 1.3.6.1.2.1.43.11.1.1.8 - prtMarkerSuppliesMaxCapacity
            # 1.3.6.1.2.1.43.11.1.1.9 - prtMarkerSuppliesLevel
            descriptions = await self._walk_oid("1.3.6.1.2.1.43.11.1.1.6")
            max_caps = await self._walk_oid("1.3.6.1.2.1.43.11.1.1.8")
            levels = await self._walk_oid("1.3.6.1.2.1.43.11.1.1.9")

            # Some HP, Canon, Brother, and Fuji Xerox firmware exposes levels
            # but omits descriptions. Keep a generic fallback instead of failing.
            if not descriptions:
                descriptions = {idx: f"Generic supply {idx}" for idx in levels}

            toner_level = None
            toner_black_level = None
            toner_cyan_level = None
            toner_magenta_level = None
            toner_yellow_level = None

            drum_level = None
            drum_black_level = None
            drum_cyan_level = None
            drum_magenta_level = None
            drum_yellow_level = None

            fuser_level = None
            laser_unit_level = None
            pf_kit_mp_level = None
            pf_kit_1_level = None

            for idx, desc in descriptions.items():
                desc_lower = " ".join(desc.lower().replace("_", " ").split())
                
                # Skip waste containers
                if "waste" in desc_lower or "receptacle" in desc_lower or "collection" in desc_lower:
                    continue
                    
                try:
                    level = int(levels.get(idx, -1))
                    raw_max_cap = max_caps.get(idx)
                    max_cap = int(raw_max_cap) if raw_max_cap is not None else 0

                    # RFC 3805 uses -3 for "at least 100%" on some devices.
                    if level == -3:
                        percentage_exact = 100
                    # Some HP/Canon/Brother devices expose a percentage level
                    # but omit prtMarkerSuppliesMaxCapacity.
                    elif max_cap <= 0 and 0 <= level <= 100:
                        percentage_exact = level
                    elif max_cap > 0:
                        percentage_exact = (level / max_cap) * 100
                    else:
                        continue

                    percentage = round(percentage_exact)
                    if level < 0 and level != -3:
                        continue
                    
                    import math
                    is_drum = any(term in desc_lower for term in ("drum", "photoconductor", "image drum", "imaging unit", "opc unit"))
                    is_toner = any(term in desc_lower for term in ("toner", "cartridge", "ink", "black", "cyan", "magenta", "yellow")) and not is_drum and "developer" not in desc_lower and "fuser" not in desc_lower and "belt" not in desc_lower and "clean" not in desc_lower and "collection" not in desc_lower

                    if is_drum:
                        parsed_percentage = math.ceil(percentage_exact) if is_fuji else percentage
                        if drum_level is None or parsed_percentage < drum_level:
                            drum_level = parsed_percentage
                        if "black" in desc_lower or " k " in desc_lower or desc_lower.endswith("k"):
                            drum_black_level = parsed_percentage
                        elif "cyan" in desc_lower or " c " in desc_lower or desc_lower.endswith("c"):
                            drum_cyan_level = parsed_percentage
                        elif "magenta" in desc_lower or " m " in desc_lower or desc_lower.endswith("m"):
                            drum_magenta_level = parsed_percentage
                        elif "yellow" in desc_lower or " y " in desc_lower or desc_lower.endswith("y"):
                            drum_yellow_level = parsed_percentage

                    elif is_toner:
                        parsed_percentage = math.ceil(percentage_exact / 10.0) * 10 if is_fuji else percentage
                        if toner_level is None or parsed_percentage < toner_level:
                            toner_level = parsed_percentage
                        if "black" in desc_lower or " k " in desc_lower or desc_lower.endswith("k"):
                            toner_black_level = parsed_percentage
                        elif "cyan" in desc_lower or " c " in desc_lower or desc_lower.endswith("c"):
                            toner_cyan_level = parsed_percentage
                        elif "magenta" in desc_lower or " m " in desc_lower or desc_lower.endswith("m"):
                            toner_magenta_level = parsed_percentage
                        elif "yellow" in desc_lower or " y " in desc_lower or desc_lower.endswith("y"):
                            toner_yellow_level = parsed_percentage

                    elif any(term in desc_lower for term in (
                        "fuser", "fixing unit", "fixing assembly", "fixing roller", "heater unit"
                    )):
                        if fuser_level is None:
                            fuser_level = percentage

                    elif any(term in desc_lower for term in (
                        "laser", "laser unit", "laser scanner", "scanner unit", "write unit"
                    )):
                        if laser_unit_level is None:
                            laser_unit_level = percentage

                    elif any(term in desc_lower for term in (
                        "paper feed", "paper feeding", "feed kit", "paper feed kit",
                        "paper pickup", "pickup roller", "feed roller", "pf kit",
                        "maintenance kit", "pf 1", "pf 2", "tray 1", "tray 2"
                    )):
                        # Distinguish MP tray vs Tray 1 / Tray 2 variants.
                        if "mp" in desc_lower or "multi" in desc_lower or "bypass" in desc_lower:
                            if pf_kit_mp_level is None:
                                pf_kit_mp_level = percentage
                        elif any(marker in desc_lower for marker in ("pf kit 1", "pf 1", "tray 1", "paper feed kit 1", "paper feeding kit 1")):
                            if pf_kit_1_level is None:
                                pf_kit_1_level = percentage
                        elif any(marker in desc_lower for marker in ("pf kit 2", "pf 2", "tray 2", "paper feed kit 2", "paper feeding kit 2")):
                            # Some models expose PF Kit 2 as the tray-1 maintenance kit; keep it in the Tray 1 slot
                            if pf_kit_1_level is None:
                                pf_kit_1_level = percentage
                        elif pf_kit_1_level is None:
                            pf_kit_1_level = percentage

                except ValueError:
                    continue

            return {
                "toner_level": toner_level,
                "drum_level": drum_level,
                "toner_black_level": toner_black_level,
                "toner_cyan_level": toner_cyan_level,
                "toner_magenta_level": toner_magenta_level,
                "toner_yellow_level": toner_yellow_level,
                "drum_black_level": drum_black_level,
                "drum_cyan_level": drum_cyan_level,
                "drum_magenta_level": drum_magenta_level,
                "drum_yellow_level": drum_yellow_level,
                "fuser_level": fuser_level,
                "laser_unit_level": laser_unit_level,
                "pf_kit_mp_level": pf_kit_mp_level,
                "pf_kit_1_level": pf_kit_1_level,
            }
        except Exception as e:
            return {"toner_level": None, "drum_level": None}

    async def get_counters(self) -> Dict[str, Any]:
        # prtMarkerLifeCount (1.3.6.1.2.1.43.10.2.1.4.1.1)
        try:
            pages = await self._get_oid("1.3.6.1.2.1.43.10.2.1.4.1.1")
        except Exception:
            pages = None
        return {
            "total_pages": int(pages) if pages and pages.isdigit() else 0
        }
