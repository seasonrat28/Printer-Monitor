"""Network Discovery Engine for Printer Management System.
Discovers local subnets, performs concurrent asynchronous network scanning,
detects printers, and saves discovered devices to SQLite database.
"""

import asyncio
import ipaddress
import socket
import time
from typing import Any, Callable, Dict, List, Optional
from services.database import upsert_printer
from services.logger import logger
from services.printer import check_tcp_port, printer_service
from services.snmp import OIDS, snmp_service


def get_local_subnets() -> List[str]:
    """Auto-detect local active IPv4 subnets (e.g. ['10.171.200.0/24'])."""
    subnets = []
    try:
        hostname = socket.gethostname()
        ips = socket.gethostbyname_ex(hostname)[2]
        for ip in ips:
            if ip.startswith("127.") or ip.startswith("169.254."):
                continue
            try:
                # Default to /24 for local subnets
                net = ipaddress.IPv4Network(f"{ip}/24", strict=False)
                subnets.append(str(net))
            except Exception:
                pass
    except Exception:
        pass

    if not subnets:
        subnets.append("192.168.1.0/24")

    # Remove duplicates preserving order
    seen = set()
    result = []
    for s in subnets:
        if s not in seen:
            seen.add(s)
            result.append(s)
    return result


def parse_ip_targets(target: str) -> List[str]:
    """Parse CIDR (192.168.1.0/24), range (192.168.1.1-192.168.1.254), or single IP."""
    target = target.strip()
    if not target:
        return []

    # CIDR notation
    if "/" in target:
        try:
            net = ipaddress.IPv4Network(target, strict=False)
            return [str(ip) for ip in net.hosts()]
        except Exception:
            return []

    # IP Range e.g. 192.168.1.10 - 192.168.1.50
    if "-" in target:
        parts = target.split("-")
        if len(parts) == 2:
            start_str = parts[0].strip()
            end_str = parts[1].strip()
            try:
                start_ip = ipaddress.IPv4Address(start_str)
                if "." in end_str:
                    end_ip = ipaddress.IPv4Address(end_str)
                else:
                    # Last octet format e.g. 192.168.1.10-50
                    prefix = ".".join(start_str.split(".")[:3])
                    end_ip = ipaddress.IPv4Address(f"{prefix}.{end_str}")

                if int(start_ip) <= int(end_ip):
                    return [str(ipaddress.IPv4Address(i)) for i in range(int(start_ip), int(end_ip) + 1)]
            except Exception:
                pass

    # Single IP
    try:
        ip = ipaddress.IPv4Address(target)
        return [str(ip)]
    except Exception:
        return []


class DiscoveryEngine:
    """Asynchronous Controlled Network Discovery Engine."""

    def __init__(self):
        self.is_scanning = False
        self.cancel_requested = False
        self.scan_status: Dict[str, Any] = {
            "is_scanning": False,
            "network": "",
            "total": 0,
            "scanned": 0,
            "percent": 0,
            "found_count": 0,
            "found_printers": [],
            "start_time": 0,
            "elapsed_seconds": 0,
            "error": None
        }

    def cancel(self) -> bool:
        """Request cancellation of the active network scan."""
        if self.is_scanning:
            self.cancel_requested = True
            logger.log("ERROR", message="Network discovery scan cancelled by user")
            return True
        return False

    async def scan_ip(
        self,
        ip: str,
        semaphore: asyncio.Semaphore,
        timeout: float = 1.2
    ) -> Optional[Dict[str, Any]]:
        """Probe a single IP address safely."""
        if self.cancel_requested:
            return None

        async with semaphore:
            # 1. Quick probe: check SNMP UDP port 161 with sysDescr first
            has_response = False
            raw_snmp = await snmp_service.query(ip, [OIDS["sysDescr"]], timeout=timeout, retries=0)
            if raw_snmp:
                has_response = True
            else:
                # Fast TCP probe for common printer ports (9100, 80, 443, 631, 515)
                for port in (9100, 80, 443, 631, 515):
                    if await check_tcp_port(ip, port, timeout=0.4):
                        has_response = True
                        break

            if not has_response:
                return None

            # 2. Comprehensive device identification
            device = await printer_service.probe_device(ip)
            if device:
                # Save to database
                saved = upsert_printer(device)
                logger.device_found(ip)
                logger.device_identified(
                    ip,
                    device.get("manufacturer", "Unknown"),
                    device.get("model", "Printer"),
                    device.get("serial_number", "")
                )
                return saved

            return None

    async def run_discovery(
        self,
        network_or_target: Optional[str] = None,
        concurrency_limit: int = 50,
        timeout: float = 1.2,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None
    ) -> List[Dict[str, Any]]:
        """Run network discovery scan."""
        if self.is_scanning:
            raise RuntimeError("A network scan is already in progress.")

        # Determine target list
        target_str = network_or_target
        if not target_str:
            subnets = get_local_subnets()
            target_str = subnets[0] if subnets else "192.168.1.0/24"

        ip_list = parse_ip_targets(target_str)
        if not ip_list:
            raise ValueError(f"Invalid network target: {target_str}")

        self.is_scanning = True
        self.cancel_requested = False
        start_t = time.time()

        self.scan_status = {
            "is_scanning": True,
            "network": target_str,
            "total": len(ip_list),
            "scanned": 0,
            "percent": 0,
            "found_count": 0,
            "found_printers": [],
            "start_time": start_t,
            "elapsed_seconds": 0,
            "error": None
        }

        logger.discovery_started(target_str, len(ip_list))

        semaphore = asyncio.Semaphore(concurrency_limit)
        found_devices: List[Dict[str, Any]] = []
        scanned_count = 0

        try:
            async def _worker(target_ip: str):
                nonlocal scanned_count
                if self.cancel_requested:
                    return

                res = await self.scan_ip(target_ip, semaphore, timeout=timeout)
                scanned_count += 1

                if res:
                    found_devices.append(res)

                elapsed = round(time.time() - start_t, 2)
                percent = round((scanned_count / len(ip_list)) * 100, 1)

                self.scan_status.update({
                    "scanned": scanned_count,
                    "percent": percent,
                    "found_count": len(found_devices),
                    "found_printers": found_devices,
                    "elapsed_seconds": elapsed
                })

                if progress_callback:
                    progress_callback(self.scan_status)

            # Launch all probes concurrently with semaphore constraint
            tasks = [_worker(ip) for ip in ip_list]
            await asyncio.gather(*tasks, return_exceptions=True)

        except Exception as e:
            self.scan_status["error"] = str(e)
            logger.error(f"Discovery error: {e}")
        finally:
            elapsed_total = round(time.time() - start_t, 2)
            self.is_scanning = False
            self.scan_status.update({
                "is_scanning": False,
                "percent": 100 if not self.cancel_requested else self.scan_status["percent"],
                "elapsed_seconds": elapsed_total
            })
            logger.log(
                "DISCOVERY_COMPLETED",
                message=f"Discovery completed in {elapsed_total}s. Found {len(found_devices)} printers."
            )

        return found_devices


# Singleton discovery engine
discovery_engine = DiscoveryEngine()
