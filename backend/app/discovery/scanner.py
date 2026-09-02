import asyncio
import ipaddress
import aioping
from typing import List, Dict, Any
from app.snmp.standard import StandardSNMPAdapter

async def scan_network(cidr: str, snmp_community: str = "public", snmp_version: str = "v2c") -> List[Dict[str, Any]]:
    try:
        network = ipaddress.ip_network(cidr, strict=False)
    except ValueError as e:
        raise ValueError(f"Invalid CIDR format: {e}")
    
    ips = [str(ip) for ip in network.hosts()]
    
    # 1. Ping Sweep
    ping_tasks = [_ping_host(ip) for ip in ips]
    ping_results = await asyncio.gather(*ping_tasks)
    
    active_ips = [ip for ip, is_active in zip(ips, ping_results) if is_active]
    
    # 2. SNMP Sweep on active IPs
    snmp_tasks = [_snmp_probe(ip, snmp_community, snmp_version) for ip in active_ips]
    snmp_results = await asyncio.gather(*snmp_tasks)
    
    discovered_printers = [result for result in snmp_results if result is not None]
    
    return discovered_printers

async def _ping_host(ip: str, timeout: float = 0.5) -> bool:
    try:
        await aioping.ping(ip, timeout=timeout)
        return True
    except (TimeoutError, OSError):
        return False

async def _snmp_probe(ip: str, community: str, version: str) -> Dict[str, Any]:
    adapter = StandardSNMPAdapter(ip=ip, community=community, version=version, timeout=1, retries=0)
    system_info = await adapter.get_system_info()
    
    sys_descr = system_info.get("sysDescr")
    if not sys_descr:
        return None  # No SNMP response
        
    # Basic Detection Logic
    sys_descr_lower = sys_descr.lower()
    is_printer = "printer" in sys_descr_lower or "print" in sys_descr_lower or "brother" in sys_descr_lower or "fuji" in sys_descr_lower or "hp" in sys_descr_lower
    
    if not is_printer:
        # We might want to be more liberal in production, but let's filter for now
        return None
        
    manufacturer = "Unknown"
    if "brother" in sys_descr_lower:
        manufacturer = "Brother"
    elif "fuji" in sys_descr_lower or "fujifilm" in sys_descr_lower:
        manufacturer = "FUJIFILM"
    elif "hp " in sys_descr_lower or "hewlett-packard" in sys_descr_lower:
        manufacturer = "HP"

    return {
        "ip_address": ip,
        "hostname": system_info.get("sysName", ""),
        "location": system_info.get("sysLocation", ""),
        "manufacturer": manufacturer,
        "model": "Detected by sysDescr",  # We can parse model from sysDescr later
        "sys_descr": sys_descr,
        "status": "ONLINE"
    }
