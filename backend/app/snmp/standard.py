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
            UdpTransportTarget((self.ip, 161)),
            ContextData(),
            ObjectType(ObjectIdentity(oid))
        )
        if errorIndication or errorStatus:
            return None
        return str(varBinds[0][1])

    async def get_system_info(self) -> Dict[str, Any]:
        # sysDescr, sysName, sysLocation
        sysDescr = await self._get_oid("1.3.6.1.2.1.1.1.0")
        sysName = await self._get_oid("1.3.6.1.2.1.1.5.0")
        sysLocation = await self._get_oid("1.3.6.1.2.1.1.6.0")
        
        return {
            "sysDescr": sysDescr,
            "sysName": sysName,
            "sysLocation": sysLocation
        }

    async def get_status(self) -> str:
        # Standard Host Resources MIB hrPrinterStatus (1.3.6.1.2.1.25.3.5.1.1.1)
        status_val = await self._get_oid("1.3.6.1.2.1.25.3.5.1.1.1")
        if not status_val:
            return "UNKNOWN"
        # 1: other, 2: unknown, 3: idle, 4: printing, 5: warmup
        status_map = {"3": "ONLINE", "4": "ONLINE", "5": "ONLINE", "1": "WARNING", "2": "UNKNOWN"}
        return status_map.get(status_val, "UNKNOWN")

    async def get_supplies(self) -> list[Dict[str, Any]]:
        # prtMarkerSuppliesLevel (1.3.6.1.2.1.43.11.1.1.9.1.1)
        # We will implement table walking later for full support.
        # This is a stub for standard MIB single lookup.
        return []

    async def get_counters(self) -> Dict[str, Any]:
        # prtMarkerLifeCount (1.3.6.1.2.1.43.10.2.1.4.1.1)
        pages = await self._get_oid("1.3.6.1.2.1.43.10.2.1.4.1.1")
        return {
            "total_pages": int(pages) if pages and pages.isdigit() else 0
        }
