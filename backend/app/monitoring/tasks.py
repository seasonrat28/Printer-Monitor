import asyncio
from datetime import datetime
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.printer import Printer
from app.models.monitoring import PrinterStatusHistory, PrinterSupplies, PrinterCounters
from app.snmp.standard import StandardSNMPAdapter

import aioping

async def ping_printers():
    db: Session = SessionLocal()
    try:
        printers = db.query(Printer).all()
        tasks = [_ping_single_printer(p, db) for p in printers]
        await asyncio.gather(*tasks)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error pinging printers: {e}")
    finally:
        db.close()

async def _ping_single_printer(printer: Printer, db: Session):
    try:
        delay = await aioping.ping(printer.ip_address, timeout=2.0)
        # Check if previous status was OFFLINE, then it's ONLINE now
        if printer.status == "OFFLINE" or printer.status == "UNKNOWN":
            printer.status = "ONLINE"
        printer.last_seen = datetime.utcnow()
    except TimeoutError:
        printer.status = "OFFLINE"
    except Exception as e:
        pass

async def check_snmp_status():
    db: Session = SessionLocal()
    try:
        printers = db.query(Printer).filter(Printer.snmp_enabled == True).all()
        tasks = []
        for p in printers:
            adapter = StandardSNMPAdapter(ip=p.ip_address, community=p.snmp_community, version=p.snmp_version)
            tasks.append(_check_single_printer_status(p.id, adapter, db))
        
        await asyncio.gather(*tasks)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error checking SNMP status: {e}")
    finally:
        db.close()

from app.alerts.engine import evaluate_status_alerts, evaluate_supply_alerts
from app.websocket.manager import manager

async def _check_single_printer_status(printer_id: int, adapter: StandardSNMPAdapter, db: Session):
    status = await adapter.get_status()
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if printer and status:
        printer.status = status
        printer.last_seen = datetime.utcnow()
        
        # Evaluate Alerts
        await evaluate_status_alerts(db, printer)
        
        history = PrinterStatusHistory(printer_id=printer_id, status=status)
        db.add(history)
        
        # Broadcast real-time update
        await manager.broadcast({
            "type": "STATUS_UPDATE",
            "data": {
                "printer_id": printer_id,
                "status": status
            }
        })

async def check_snmp_supplies():
    db: Session = SessionLocal()
    try:
        printers = db.query(Printer).filter(Printer.snmp_enabled == True).all()
        tasks = []
        for p in printers:
            adapter = StandardSNMPAdapter(ip=p.ip_address, community=p.snmp_community, version=p.snmp_version)
            tasks.append(_check_single_printer_supplies(p.id, adapter, db))
        await asyncio.gather(*tasks)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error checking SNMP supplies: {e}")
    finally:
        db.close()

async def _check_single_printer_supplies(printer_id: int, adapter: StandardSNMPAdapter, db: Session):
    supplies = await adapter.get_supplies()
    counters = await adapter.get_counters()
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    
    if printer:
        if supplies.get("toner_level") is not None:
            printer.toner_level = supplies["toner_level"]
        if supplies.get("drum_level") is not None:
            printer.drum_level = supplies["drum_level"]
            
        # Broadcast supply update directly
        await manager.broadcast({
            "type": "SUPPLY_UPDATE",
            "data": {
                "printer_id": printer_id,
                "toner_level": printer.toner_level,
                "drum_level": printer.drum_level
            }
        })
            
    if counters and "total_pages" in counters:
        new_counter = PrinterCounters(
            printer_id=printer_id,
            total_pages=counters["total_pages"]
        )
        db.add(new_counter)

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

