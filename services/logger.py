"""Event Logger Service for Printer Management System.
Prints formatted messages to console and logs events into SQLite.
"""

import sys
from datetime import datetime
from typing import Any, Optional
from services.database import log_event


class EventLogger:
    """Structured Event Logger."""

    @staticmethod
    def _format_time() -> str:
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    @classmethod
    def log(
        cls,
        event_type: str,
        ip_address: Optional[str] = None,
        message: str = "",
        details: Optional[Any] = None
    ) -> None:
        """Log event to DB and stdout."""
        ts = cls._format_time()
        ip_str = f" [{ip_address}]" if ip_address else ""
        msg_str = f" - {message}" if message else ""
        print(f"[{ts}] {event_type}{ip_str}{msg_str}", flush=True)

        try:
            log_event(event_type, ip_address=ip_address, message=message, details=details)
        except Exception as e:
            print(f"[{ts}] ERROR [DB_LOG] Failed to write event to DB: {e}", file=sys.stderr)

    @classmethod
    def discovery_started(cls, network: str, total_ips: int) -> None:
        cls.log(
            "DISCOVERY_STARTED",
            message=f"Started scanning network: {network} ({total_ips} addresses)",
            details={"network": network, "total_ips": total_ips}
        )

    @classmethod
    def device_found(cls, ip: str, port: int = 161) -> None:
        cls.log("DEVICE_FOUND", ip_address=ip, message=f"Responsive device found on port {port}")

    @classmethod
    def device_identified(cls, ip: str, manufacturer: str, model: str, serial: str = "") -> None:
        cls.log(
            "DEVICE_IDENTIFIED",
            ip_address=ip,
            message=f"{manufacturer} {model}" + (f" (S/N: {serial})" if serial and serial != 'N/A' else ""),
            details={"manufacturer": manufacturer, "model": model, "serial": serial}
        )

    @classmethod
    def snmp_success(cls, ip: str, oids_count: int) -> None:
        cls.log("SNMP_SUCCESS", ip_address=ip, message=f"Successfully fetched {oids_count} OIDs")

    @classmethod
    def snmp_timeout(cls, ip: str, error: str = "Timeout") -> None:
        cls.log("SNMP_TIMEOUT", ip_address=ip, message=f"SNMP request timed out: {error}")

    @classmethod
    def device_offline(cls, ip: str, name: str = "") -> None:
        cls.log("DEVICE_OFFLINE", ip_address=ip, message=f"Device unreachable / offline: {name}")

    @classmethod
    def status_changed(cls, ip: str, old_status: str, new_status: str, reason: str = "") -> None:
        cls.log(
            "STATUS_CHANGED",
            ip_address=ip,
            message=f"Status changed from {old_status} -> {new_status}" + (f" ({reason})" if reason else ""),
            details={"old_status": old_status, "new_status": new_status, "reason": reason}
        )

    @classmethod
    def refresh(cls, ip: str, status: str) -> None:
        cls.log("REFRESH", ip_address=ip, message=f"Manually refreshed status: {status}")

    @classmethod
    def error(cls, message: str, ip: Optional[str] = None, details: Optional[Any] = None) -> None:
        cls.log("ERROR", ip_address=ip, message=message, details=details)


# Convenience singleton
logger = EventLogger()
