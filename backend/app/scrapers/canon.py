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
