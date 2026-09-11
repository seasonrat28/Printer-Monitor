import asyncio
from typing import Dict, Any, Optional
from pysnmp.hlapi.asyncio import *

from app.snmp.base import SNMPAdapter

class StandardSNMPAdapter(SNMPAdapter):
    def __init__(self, ip: str, community: str = "public", version: str = "v2c", timeout: int = 2, retries: int = 1):
        super().__init__(ip, community, version)
        self.timeout = timeout
        self.retries = retries
        self.snmp_engine = SnmpEngine()
        
    def close(self):
        if hasattr(self.snmp_engine, 'transportDispatcher') and self.snmp_engine.transportDispatcher:
            self.snmp_engine.transportDispatcher.closeDispatcher()

    async def _get_oid(self, oid: str) -> Optional[str]:
        errorIndication, errorStatus, errorIndex, varBinds = await get_cmd(
            self.snmp_engine,
            CommunityData(self.community, mpModel=1 if self.version == "v2c" else 0),
            await UdpTransportTarget.create((self.ip, 161)),
            ContextData(),
            ObjectType(ObjectIdentity(oid))
        )
        if errorIndication or errorStatus:
            return None
        return str(varBinds[0][1])

    async def get_system_info(self) -> Dict[str, Any]:
        # sysDescr, sysName, sysLocation, prtGeneralSerialNumber, prtGeneralPrinterName
        sysDescr = await self._get_oid("1.3.6.1.2.1.1.1.0")
        sysName = await self._get_oid("1.3.6.1.2.1.1.5.0")
        sysLocation = await self._get_oid("1.3.6.1.2.1.1.6.0")
        
        # Try to get serial number and model from prtGeneral
        serial_number = await self._get_oid("1.3.6.1.2.1.43.5.1.1.17.1")
        model = await self._get_oid("1.3.6.1.2.1.43.5.1.1.16.1")
        
        return {
            "sysDescr": sysDescr,
            "sysName": sysName,
            "sysLocation": sysLocation,
            "serialNumber": serial_number,
            "model": model
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
                    await UdpTransportTarget.create((self.ip, 161)),
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

            toner_level = None
            drum_level = None
            fuser_level = None
            laser_unit_level = None
            pf_kit_mp_level = None
            pf_kit_1_level = None

            for idx, desc in descriptions.items():
                desc_lower = desc.lower()
                
                # Skip waste containers
                if "waste" in desc_lower or "receptacle" in desc_lower or "collection" in desc_lower:
                    continue
                    
                try:
                    level = int(levels.get(idx, -1))
                    max_cap = int(max_caps.get(idx, 1))
                    
                    if max_cap <= 0:
                        continue
                        
                    percentage_exact = (level / max_cap) * 100
                    percentage = round(percentage_exact)
                    if level == -3:
                        percentage = 100
                    elif level < 0:
                        continue
                    
                    import math
                    if "drum" in desc_lower or "photoconductor" in desc_lower or "imaging" in desc_lower:
                        if drum_level is None:
                            drum_level = math.ceil(percentage_exact) if is_fuji else percentage

                    elif "toner" in desc_lower or "cartridge" in desc_lower or "black" in desc_lower or "cyan" in desc_lower or "magenta" in desc_lower or "yellow" in desc_lower:
                        if toner_level is None:
                            toner_level = math.ceil(percentage_exact / 10.0) * 10 if is_fuji else percentage

                    elif "fuser" in desc_lower:
                        if fuser_level is None:
                            fuser_level = percentage

                    elif "laser" in desc_lower:
                        if laser_unit_level is None:
                            laser_unit_level = percentage

                    elif ("paper feed" in desc_lower or "pf kit" in desc_lower or "paper feeding" in desc_lower or "feed kit" in desc_lower):
                        # Distinguish MP tray vs Tray 1
                        if "mp" in desc_lower or "multi" in desc_lower or "bypass" in desc_lower:
                            if pf_kit_mp_level is None:
                                pf_kit_mp_level = percentage
                        elif pf_kit_1_level is None:
                            pf_kit_1_level = percentage

                except ValueError:
                    continue

            if "brother" in sys_descr_lower:
                # Known firmware bug in many Brother printers: they swap Toner and Drum levels in standard MIB
                toner_level, drum_level = drum_level, toner_level

            return {
                "toner_level": toner_level,
                "drum_level": drum_level,
                "fuser_level": fuser_level,
                "laser_unit_level": laser_unit_level,
                "pf_kit_mp_level": pf_kit_mp_level,
                "pf_kit_1_level": pf_kit_1_level,
            }
        except Exception as e:
            return {"toner_level": None, "drum_level": None}

    async def get_counters(self) -> Dict[str, Any]:
        # prtMarkerLifeCount (1.3.6.1.2.1.43.10.2.1.4.1.1)
        pages = await self._get_oid("1.3.6.1.2.1.43.10.2.1.4.1.1")
        return {
            "total_pages": int(pages) if pages and pages.isdigit() else 0
        }
