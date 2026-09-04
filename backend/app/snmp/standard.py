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

    async def get_status(self) -> str:
        # Standard Host Resources MIB hrPrinterStatus (1.3.6.1.2.1.25.3.5.1.1.1)
        status_val = await self._get_oid("1.3.6.1.2.1.25.3.5.1.1.1")
        
        # If hrPrinterStatus is missing, try hrDeviceStatus (1.3.6.1.2.1.25.3.2.1.5.1)
        if not status_val:
            device_status = await self._get_oid("1.3.6.1.2.1.25.3.2.1.5.1")
            if device_status:
                device_status_map = {"1": "UNKNOWN", "2": "ONLINE", "3": "WARNING", "4": "OFFLINE", "5": "OFFLINE"}
                return device_status_map.get(device_status, "UNKNOWN")
            return "UNKNOWN"
            
        # 1: other, 2: unknown, 3: idle, 4: printing, 5: warmup
        status_map = {"3": "ONLINE", "4": "ONLINE", "5": "ONLINE", "1": "WARNING", "2": "UNKNOWN"}
        return status_map.get(status_val, "UNKNOWN")

    async def _walk_oid(self, oid: str) -> Dict[str, str]:
        results = {}
        async for errorIndication, errorStatus, errorIndex, varBinds in next_cmd(
            self.snmp_engine,
            CommunityData(self.community, mpModel=1 if self.version == "v2c" else 0),
            await UdpTransportTarget.create((self.ip, 161)),
            ContextData(),
            ObjectType(ObjectIdentity(oid)),
            lexicographicMode=False
        ):
            if errorIndication or errorStatus:
                break
            for varBind in varBinds:
                # varBind[0] is the OID, varBind[1] is the value
                oid_str = str(varBind[0])
                idx = oid_str.split('.')[-1]
                results[idx] = str(varBind[1])
        return results

    async def get_supplies(self) -> Dict[str, Any]:
        try:
            # 1.3.6.1.2.1.43.11.1.1.6 - prtMarkerSuppliesDescription
            # 1.3.6.1.2.1.43.11.1.1.8 - prtMarkerSuppliesMaxCapacity
            # 1.3.6.1.2.1.43.11.1.1.9 - prtMarkerSuppliesLevel
            descriptions = await self._walk_oid("1.3.6.1.2.1.43.11.1.1.6")
            max_caps = await self._walk_oid("1.3.6.1.2.1.43.11.1.1.8")
            levels = await self._walk_oid("1.3.6.1.2.1.43.11.1.1.9")

            toner_level = None
            drum_level = None

            for idx, desc in descriptions.items():
                desc_lower = desc.lower()
                try:
                    level = int(levels.get(idx, -1))
                    max_cap = int(max_caps.get(idx, 1))
                    
                    if max_cap <= 0:
                        continue
                        
                    percentage = int((level / max_cap) * 100)
                    if percentage < 0:
                        percentage = 0 # Some printers return -3 for OK
                    
                    if "drum" in desc_lower or "photoconductor" in desc_lower or "imaging" in desc_lower:
                        if drum_level is None:
                            drum_level = percentage
                    elif "toner" in desc_lower or "cartridge" in desc_lower or "black" in desc_lower or "cyan" in desc_lower or "magenta" in desc_lower or "yellow" in desc_lower:
                        if toner_level is None:
                            toner_level = percentage
                except ValueError:
                    continue

            return {
                "toner_level": toner_level,
                "drum_level": drum_level
            }
        except Exception as e:
            return {"toner_level": None, "drum_level": None}

    async def get_counters(self) -> Dict[str, Any]:
        # prtMarkerLifeCount (1.3.6.1.2.1.43.10.2.1.4.1.1)
        pages = await self._get_oid("1.3.6.1.2.1.43.10.2.1.4.1.1")
        return {
            "total_pages": int(pages) if pages and pages.isdigit() else 0
        }
