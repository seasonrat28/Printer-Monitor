"""Background Polling Worker.
Periodically polls known printers from the database every 30-60 seconds via SNMP,
updates consumables and page counters, and logs status transitions.
"""

import asyncio
from datetime import datetime
from typing import Optional
from services.database import list_printers, update_printer_status
from services.logger import logger
from services.printer import printer_service
from services.snmp import snmp_service


class PollingWorker:
    """Background polling worker for active status monitoring."""

    def __init__(self, interval_seconds: int = 30):
        self.interval_seconds = interval_seconds
        self.is_running = False
        self._task: Optional[asyncio.Task] = None

    async def poll_printer(self, printer: dict) -> None:
        """Poll a single printer and update DB."""
        ip = printer.get("ip_address")
        if not ip:
            return

        old_status = printer.get("status", "UNKNOWN")
        name = printer.get("device_name") or printer.get("model") or ip

        try:
            # Probe device using unified printer service
            updated = await printer_service.probe_device(ip)

            if updated:
                new_status = updated.get("status", "ONLINE")
                update_printer_status(ip, new_status, updates=updated)

                if old_status != new_status and old_status != "UNKNOWN":
                    logger.status_changed(ip, old_status, new_status, reason="Polling update")
            else:
                # Device timed out or unreachable -> set OFFLINE
                new_status = "OFFLINE"
                update_printer_status(ip, new_status)
                if old_status != "OFFLINE" and old_status != "UNKNOWN":
                    logger.device_offline(ip, name=name)
                    logger.status_changed(ip, old_status, "OFFLINE", reason="SNMP timeout during polling")

        except Exception as e:
            update_printer_status(ip, "OFFLINE")
            if old_status != "OFFLINE":
                logger.status_changed(ip, old_status, "OFFLINE", reason=str(e))

    async def poll_all_printers(self) -> None:
        """Poll all registered printers in the database."""
        printers = list_printers()
        if not printers:
            return

        # Poll with concurrency limit of 20
        sem = asyncio.Semaphore(20)

        async def _bounded_poll(p):
            async with sem:
                await self.poll_printer(p)

        tasks = [_bounded_poll(p) for p in printers]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _run_loop(self) -> None:
        """Continuous polling loop."""
        while self.is_running:
            try:
                await self.poll_all_printers()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Polling loop exception: {e}")

            # Sleep interval
            try:
                await asyncio.sleep(self.interval_seconds)
            except asyncio.CancelledError:
                break

    def start(self) -> None:
        """Start the background polling worker."""
        if not self.is_running:
            self.is_running = True
            self._task = asyncio.create_task(self._run_loop())
            print(f"[*] Background Polling Worker started (Interval: {self.interval_seconds}s)")

    def stop(self) -> None:
        """Stop the background polling worker."""
        self.is_running = False
        if self._task and not self._task.done():
            self._task.cancel()
            self._task = None
            print("[*] Background Polling Worker stopped")


# Singleton polling worker
polling_worker = PollingWorker(interval_seconds=30)
