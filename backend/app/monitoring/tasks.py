import asyncio

_sync_lock = asyncio.Lock()
import ipaddress
from datetime import datetime
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.printer import Printer, MaintenanceLog
from app.models.monitoring import PrinterStatusHistory, PrinterSupplies, PrinterCounters, PrinterSuppliesSnapshot
from app.snmp.standard import StandardSNMPAdapter
from app.scrapers.apeos import ApeosHTTPScraper
from app.core.config import settings

import aioping

# -----------------------------------------------------------------------
# Adapter factory – returns the right scraper for each printer
# -----------------------------------------------------------------------

APEOS_KEYWORDS = ("apeos", "fujifilm", "fuji xerox", "fuji-xerox", "fuji_xerox")

def _is_known_apeos_ip(ip: str) -> bool:
    try:
        address = ipaddress.ip_address(ip)
        return address == ipaddress.ip_address("10.119.18.211") or ipaddress.ip_address("10.119.34.20") <= address <= ipaddress.ip_address("10.119.34.175")
    except ValueError:
        return False

def _is_apeos(printer: Printer) -> bool:
    """Return True if this printer should use the Apeos HTTP scraper."""
    if _is_known_apeos_ip(printer.ip_address):
        return True
    if getattr(printer, "scraper_type", "snmp") == "http_apeos":
        return True
    # Auto-detect from model / manufacturer strings stored in DB
    for field in (printer.model or "", printer.manufacturer or ""):
        if any(kw in field.lower() for kw in APEOS_KEYWORDS):
            return True
    return False

def get_adapter(printer: Printer):
    """Return the correct scraper instance for a printer."""
    if _is_apeos(printer):
        pwd = settings.APEOS_PASSWORD
        return ApeosHTTPScraper(
            ip=printer.ip_address,
            password=pwd,
            timeout=3
        )
    return StandardSNMPAdapter(
        ip=printer.ip_address,
        community=printer.snmp_community or "public",
        version=printer.snmp_version or "v2c",
        timeout=3
    )

# -----------------------------------------------------------------------

async def ping_printers():
    db: Session = SessionLocal()
    try:
        printers = db.query(Printer).all()
        printer_data = [(p.id, p.ip_address, p.status) for p in printers]
    except Exception as e:
        print(f"Error getting printers for ping: {e}")
        return
    finally:
        db.close()
    sem = asyncio.Semaphore(8)
    async def bounded_ping(pid, ip, status):
        async with sem:
            await _ping_single_printer(pid, ip, status)
            
    tasks = [bounded_ping(pid, ip, status) for pid, ip, status in printer_data]
    await asyncio.gather(*tasks)

async def _ping_single_printer(printer_id: int, ip_address: str, current_status: str):
    new_status = current_status
    last_seen = None
    
    try:
        delay = await aioping.ping(ip_address, timeout=2.0)
        if current_status == "OFFLINE" or current_status == "UNKNOWN":
            new_status = "ONLINE"
        last_seen = datetime.utcnow()
    except TimeoutError:
        new_status = "OFFLINE"
    except Exception as e:
        pass
        
    db = SessionLocal()
    try:
        printer = db.query(Printer).filter(Printer.id == printer_id).first()
        if printer:
            printer.status = new_status
            if last_seen:
                printer.last_seen = last_seen
            db.commit()
    except Exception as e:
        db.rollback()
    finally:
        db.close()

async def check_snmp_status():
    db: Session = SessionLocal()
    try:
        printers = db.query(Printer).filter(Printer.snmp_enabled == True).all()
        printer_configs = [(p.id, get_adapter(p)) for p in printers]
    except Exception as e:
        print(f"Error checking status: {e}")
        return
    finally:
        db.close()

    sem = asyncio.Semaphore(8)
    async def bounded_check(pid, adapter):
        async with sem:
            ip = getattr(adapter, 'ip', '?')
            print(f"Checking status for IP: {ip}", flush=True)
            try:
                await _check_single_printer_status(pid, adapter)
            finally:
                adapter.close()

    tasks = [bounded_check(pid, adapter) for pid, adapter in printer_configs]
    await asyncio.gather(*tasks)

async def _sync_all_printers_unlocked():
    db: Session = SessionLocal()
    try:
        printers = db.query(Printer).filter(Printer.snmp_enabled == True).all()
        printer_configs = [(p.id, get_adapter(p)) for p in printers]
    except Exception as e:
        print(f"Error checking status/supplies: {e}")
        return
    finally:
        db.close()

    sem = asyncio.Semaphore(8)
    async def bounded_check(pid, adapter):
        async with sem:
            ip = getattr(adapter, 'ip', '?')
            print(f"Syncing printer IP: {ip}", flush=True)
            try:
                await _check_single_printer_status(pid, adapter)
                await _check_single_printer_supplies(pid, adapter)
            finally:
                adapter.close()

    tasks = [bounded_check(pid, adapter) for pid, adapter in printer_configs]
    await asyncio.gather(*tasks)

    # WAL checkpoint after full sync to keep WAL file small
    try:
        db2: Session = SessionLocal()
        from sqlalchemy import text
        db2.execute(text("PRAGMA wal_checkpoint(TRUNCATE)"))
        db2.close()
    except Exception:
        pass

async def sync_all_printers():
    """Run one full sync at a time to protect SQLite and reduce duplicate work."""
    async with _sync_lock:
        await _sync_all_printers_unlocked()

from app.alerts.engine import evaluate_status_alerts, evaluate_supply_alerts
from app.websocket.manager import manager
from app.services.notification import send_line_notify, send_email_notify, get_department_email
import asyncio

async def _check_single_printer_status(printer_id: int, adapter: StandardSNMPAdapter):
    status, status_message = await adapter.get_status()
    db = SessionLocal()
    try:
        printer = db.query(Printer).filter(Printer.id == printer_id).first()
        if printer and status:
            printer.status = status
            printer.status_message = status_message
            printer.last_seen = datetime.utcnow()

        # Fetch metadata if it's missing (happens on first run or DB reset) or if hostname is a default Fuji model name
        metadata_has_markup = any(
            "<" in (value or "") or ">" in (value or "")
            for value in (printer.hostname, printer.location, printer.serial_number, printer.model)
        )
        is_fuji_default_name = bool(printer.hostname and "FUJIFILM Apeos" in printer.hostname)
        if not printer.hostname or is_fuji_default_name or not printer.location or not printer.serial_number or metadata_has_markup:
            sys_info = await adapter.get_system_info()
            if sys_info:
                if sys_info.get("sysName") or is_fuji_default_name: 
                    # If we have a new name, or if we need to clear the bad Fuji name
                    printer.hostname = sys_info.get("sysName")
                if sys_info.get("sysLocation"): printer.location = sys_info["sysLocation"]
                if sys_info.get("serialNumber"): printer.serial_number = sys_info["serialNumber"]
                if sys_info.get("model"): printer.model = sys_info["model"]
        
        # Evaluate Alerts
        await evaluate_status_alerts(db, printer)
        
        history = PrinterStatusHistory(printer_id=printer_id, status=status)
        db.add(history)
        
        # Broadcast real-time update
        await manager.broadcast({
            "type": "STATUS_UPDATE",
            "data": {
                "printer_id": printer_id,
                "status": status,
                "status_message": status_message,
                "hostname": printer.hostname,
                "location": printer.location,
                "serial_number": printer.serial_number,
                "model": printer.model
            }
        })
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error processing single printer status: {e}")
    finally:
        db.close()

from typing import List

async def sync_specific_printers(printer_ids: List[int]):
    db: Session = SessionLocal()
    try:
        printers = db.query(Printer).filter(Printer.id.in_(printer_ids)).all()
        printer_adapters = [(p.id, get_adapter(p)) for p in printers]
    except Exception as e:
        print(f"Error getting configs for specific printers: {e}")
        return
    finally:
        db.close()
        
    async def run_adapter(pid, adapter):
        try:
            await _check_single_printer_status(pid, adapter)
            await _check_single_printer_supplies(pid, adapter)
        finally:
            adapter.close()

    tasks = [run_adapter(pid, adapter) for pid, adapter in printer_adapters]
    if tasks:
        await asyncio.gather(*tasks)


async def check_snmp_supplies():
    db: Session = SessionLocal()
    try:
        printers = db.query(Printer).filter(Printer.snmp_enabled == True).all()
        printer_adapters = [(p.id, get_adapter(p)) for p in printers]
    except Exception as e:
        print(f"Error checking supplies: {e}")
        return
    finally:
        db.close()
    sem = asyncio.Semaphore(8)
    async def bounded_check(pid, adapter):
        async with sem:
            ip = getattr(adapter, 'ip', '?')
            print(f"Checking supplies for IP: {ip}", flush=True)
            try:
                await _check_single_printer_supplies(pid, adapter)
            finally:
                adapter.close()

    tasks = [bounded_check(pid, adapter) for pid, adapter in printer_adapters]
    await asyncio.gather(*tasks)


async def _check_single_printer_supplies(printer_id: int, adapter: StandardSNMPAdapter):
    supplies = await adapter.get_supplies()
    counters = await adapter.get_counters()
    sys_info = await adapter.get_system_info()
    
    db = SessionLocal()
    try:
        printer = db.query(Printer).filter(Printer.id == printer_id).first()
        if printer:
            if sys_info:
                if sys_info.get("sysName"): printer.hostname = sys_info["sysName"]
                if sys_info.get("sysLocation"): printer.location = sys_info["sysLocation"]
                if sys_info.get("serialNumber"): printer.serial_number = sys_info["serialNumber"]
                if sys_info.get("model"): printer.model = sys_info["model"]

            if counters and counters.get("total_pages") is not None:
                printer.page_count = counters["total_pages"]

            if supplies.get("toner_level") is not None:
                prev_toner = printer.toner_level
                printer.toner_level = supplies["toner_level"]
                
                from app.alerts.engine import _create_or_update_alert, _resolve_alerts
                
                if printer.toner_level <= 10:
                    # In-app alert
                    msg_in_app = f"Toner is critically low ({printer.toner_level}%)"
                    await _create_or_update_alert(db, printer.id, "SUPPLY", "CRITICAL", msg_in_app)
                    
                    # External notification (LINE/Email) only when it crosses the threshold
                    if prev_toner is None or prev_toner > 10:
                        msg = f"🟡 LOW TONER ALERT ({printer.toner_level}%)\nName: {printer.hostname or printer.ip_address}\nIP: {printer.ip_address}\nLocation: {printer.location or '-'}"
                        asyncio.create_task(send_line_notify(msg))
                        dept_email = get_department_email(printer.department)
                        if dept_email:
                            asyncio.create_task(send_email_notify(f"Low Toner Alert: {printer.ip_address}", msg, dept_email, printer_ip=printer.ip_address))
                else:
                    await _resolve_alerts(db, printer.id, "SUPPLY")
                
                # Auto-detect Toner Replacement
                if prev_toner is not None and printer.toner_level > prev_toner + 20:
                    db.add(MaintenanceLog(
                        printer_id=printer.id,
                        description=f"Auto-detected: Toner Replaced (from {prev_toner}% to {printer.toner_level}%)",
                        performed_by="System (Auto)"
                    ))

            if supplies.get("drum_level") is not None:
                prev_drum = printer.drum_level
                printer.drum_level = supplies["drum_level"]
                
                # Auto-detect Drum Replacement
                if prev_drum is not None and printer.drum_level > prev_drum + 20:
                    db.add(MaintenanceLog(
                        printer_id=printer.id,
                        description=f"Auto-detected: Drum Replaced (from {prev_drum}% to {printer.drum_level}%)",
                        performed_by="System (Auto)"
                    ))
                
            if supplies.get("fuser_level") is not None:
                printer.fuser_level = supplies["fuser_level"]
            if supplies.get("laser_unit_level") is not None:
                printer.laser_unit_level = supplies["laser_unit_level"]
            if supplies.get("pf_kit_mp_level") is not None:
                printer.pf_kit_mp_level = supplies["pf_kit_mp_level"]
            if supplies.get("pf_kit_1_level") is not None:
                printer.pf_kit_1_level = supplies["pf_kit_1_level"]
                
            # Broadcast supply update directly
            await manager.broadcast({
                "type": "SUPPLY_UPDATE",
                "data": {
                    "printer_id": printer_id,
                    "toner_level": printer.toner_level,
                    "drum_level": printer.drum_level,
                    "fuser_level": printer.fuser_level,
                    "laser_unit_level": printer.laser_unit_level,
                    "pf_kit_mp_level": printer.pf_kit_mp_level,
                    "pf_kit_1_level": printer.pf_kit_1_level,
                    "hostname": printer.hostname,
                    "location": printer.location,
                    "serial_number": printer.serial_number,
                    "model": printer.model
                }
            })
                
        if counters and "total_pages" in counters:
            new_counter = PrinterCounters(
                printer_id=printer_id,
                total_pages=counters["total_pages"]
            )
            db.add(new_counter)

        # Save supplies snapshot for history charting
        if supplies and any(supplies.get(k) is not None for k in ["toner_level", "drum_level"]):
            snapshot = PrinterSuppliesSnapshot(
                printer_id=printer_id,
                toner_level=printer.toner_level,
                drum_level=printer.drum_level,
                fuser_level=printer.fuser_level,
                laser_unit_level=printer.laser_unit_level,
                pf_kit_mp_level=printer.pf_kit_mp_level,
                pf_kit_1_level=printer.pf_kit_1_level,
            )
            db.add(snapshot)
            
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error processing single printer supplies: {e}")
    finally:
        db.close()

async def simulate_demo_printers():
    import random
    db: Session = SessionLocal()
    try:
        printers = db.query(Printer).filter(Printer.ip_address.like("192.168.99.%")).all()
        statuses = ["ONLINE", "ONLINE", "ONLINE", "WARNING", "OFFLINE"]
        
        for p in printers:
            # Random status
            new_status = random.choice(statuses)
            p.status = new_status
            p.last_seen = datetime.utcnow()
            
            # Broadcast status update
            await manager.broadcast({
                "type": "STATUS_UPDATE",
                "data": {
                    "printer_id": p.id,
                    "status": new_status
                }
            })
            
            # Random supplies
            supply_name = "Black Toner"
            existing_supply = db.query(PrinterSupplies).filter(
                PrinterSupplies.printer_id == p.id,
                PrinterSupplies.name == supply_name
            ).first()
            
            new_level = random.randint(5, 100)
            if existing_supply:
                existing_supply.level = new_level
            else:
                existing_supply = PrinterSupplies(
                    printer_id=p.id,
                    supply_type="toner",
                    name=supply_name,
                    level=new_level,
                    maximum=100
                )
                db.add(existing_supply)
                
            db.flush()
            
            # Broadcast supply update
            await manager.broadcast({
                "type": "SUPPLY_UPDATE",
                "data": {
                    "printer_id": p.id,
                    "supply_name": supply_name,
                    "level": new_level,
                    "maximum": 100
                }
            })
            
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error simulating demo printers: {e}")
    finally:
        db.close()

async def cleanup_old_logs():
    """Delete logs (Audit, Status, Counters, Supplies) older than 30 days to save DB space."""
    from datetime import datetime, timedelta
    from app.models.audit import AuditLog
    from app.models.monitoring import PrinterStatusHistory, PrinterCounters, PrinterSuppliesSnapshot
    
    db: Session = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(days=30)
        
        # Delete old audit logs
        db.query(AuditLog).filter(AuditLog.created_at < cutoff).delete(synchronize_session=False)
        
        # Delete old monitoring histories
        db.query(PrinterStatusHistory).filter(PrinterStatusHistory.checked_at < cutoff).delete(synchronize_session=False)
        db.query(PrinterCounters).filter(PrinterCounters.measured_at < cutoff).delete(synchronize_session=False)
        db.query(PrinterSuppliesSnapshot).filter(PrinterSuppliesSnapshot.measured_at < cutoff).delete(synchronize_session=False)
        
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error cleaning up old logs: {e}")
    finally:
        db.close()
