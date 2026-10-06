import asyncio
import ipaddress
import aioping
import httpx
from typing import List, Dict, Any

async def scan_network(cidr: str, snmp_community: str = "public", snmp_version: str = "v2c", blacklist: List[str] = None) -> List[Dict[str, Any]]:
    if blacklist is None:
        blacklist = []
        
    try:
        network = ipaddress.ip_network(cidr, strict=False)
    except ValueError as e:
        raise ValueError(f"Invalid CIDR format: {e}")
    
    ips = [str(ip) for ip in network.hosts() if str(ip) not in blacklist]
    
    # 1. Ping Sweep
    ping_tasks = [_ping_host(ip) for ip in ips]
    ping_results = await asyncio.gather(*ping_tasks)
    
    active_ips = [ip for ip, is_active in zip(ips, ping_results) if is_active]
    
    # 2. HTTP Web Probe on active IPs
    async with httpx.AsyncClient(verify=False) as client:
        http_tasks = [_http_probe(client, ip) for ip in active_ips]
        http_results = await asyncio.gather(*http_tasks)
    
    discovered_printers = [result for result in http_results if result is not None]
    
    return discovered_printers

async def _ping_host(ip: str, timeout: float = 0.5) -> bool:
    try:
        await aioping.ping(ip, timeout=timeout)
        return True
    except (TimeoutError, OSError):
        return False

async def _http_probe(client: httpx.AsyncClient, ip: str) -> Dict[str, Any]:
    try:
        # Try HTTP first
        url = f"http://{ip}"
        response = await client.get(url, timeout=2.0)
        html = response.text
        server_header = response.headers.get('Server', '').lower()
        return _analyze_web_response(ip, html, server_header)
    except Exception:
        # Fallback to HTTPS
        try:
            url = f"https://{ip}"
            response = await client.get(url, timeout=2.0)
            html = response.text
            server_header = response.headers.get('Server', '').lower()
            return _analyze_web_response(ip, html, server_header)
        except Exception:
            return None

def _analyze_web_response(ip: str, html: str, server_header: str) -> Dict[str, Any]:
    html_lower = html.lower()
    
    manufacturer = "Unknown"
    is_printer = False
    
    # Detect Brother
    if "brother" in html_lower or "brother" in server_header:
        manufacturer = "Brother"
        is_printer = True
        
    # Detect Fuji / Apeos
    elif "fuji" in html_lower or "apeos" in html_lower or "centreware" in html_lower:
        manufacturer = "FUJIFILM"
        is_printer = True
        
    # Detect HP
    elif "hp" in server_header or "hewlett-packard" in html_lower or "hp laserjet" in html_lower:
        manufacturer = "HP"
        is_printer = True
        
    # Detect Epson
    elif "epson" in html_lower or "epson" in server_header:
        manufacturer = "Epson"
        is_printer = True

    if not is_printer:
        return None
        
    return {
        "ip_address": ip,
        "hostname": f"{manufacturer} Printer ({ip})",
        "location": "",
        "manufacturer": manufacturer,
        "model": f"Detected by HTTP",
        "sys_descr": "Web Interface Detected",
        "status": "ONLINE"
    }
