from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class SNMPAdapter(ABC):
    def __init__(self, ip: str, community: str = "public", version: str = "v2c"):
        self.ip = ip
        self.community = community
        self.version = version

    @abstractmethod
    async def get_system_info(self) -> Dict[str, Any]:
        """Fetch basic sysName, sysDescr, sysLocation, etc."""
        pass

    @abstractmethod
    async def get_status(self) -> str:
        """Fetch current printer status (ONLINE, WARNING, ERROR, etc.)"""
        pass

    @abstractmethod
    async def get_supplies(self) -> list[Dict[str, Any]]:
        """Fetch supplies (toner, drum, etc.) levels."""
        pass

    @abstractmethod
    async def get_counters(self) -> Dict[str, Any]:
        """Fetch page counters (total, print, copy, etc.)"""
        pass
