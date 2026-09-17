import io
import csv
import ipaddress
import re
import asyncio
from typing import List

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.printer import Printer as PrinterModel
from app.schemas.printer import PrinterCreate, PrinterUpdate, PrinterResponse, PrinterBulkCreate
from app.models.audit import AuditLog
from app.models.alert import Alert
from app.models.floormap import PrinterPin
from app.models.group import printer_group_association
from app.models.monitoring import PrinterCounters, PrinterStatusHistory, PrinterSupplies, PrinterSuppliesSnapshot
from app.monitoring.tasks import check_snmp_status, check_snmp_supplies, sync_specific_printers
from app.core.config import settings

router = APIRouter()

@router.get("/test_apeos")
async def test_apeos_html(ip: str):
    from app.scrapers.apeos import ApeosHTTPScraper
    from fastapi.responses import HTMLResponse
    scraper = ApeosHTTPScraper(ip, password=settings.APEOS_PASSWORD)
    html = await scraper._fetch_info_page()
    if html:
        # Also save to data folder in docker just in case
        try:
            with open("./data/debug_apeos_test.html", "w", encoding="utf-8") as f:
                f.write(html)
        except:
            pass
        return HTMLResponse(content=html)
    return {"status": "error", "msg": "failed to fetch"}

@router.post("/sync")
async def force_sync_printers():
    from app.websocket.manager import manager

    from app.monitoring.tasks import sync_all_printers
    await sync_all_printers()
    await manager.broadcast({"type": "SYNC_COMPLETE"})
    return {"status": "success", "message": "Synchronized all printers"}

@router.get("/dashboard/summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    from sqlalchemy import func
    from app.models.monitoring import PrinterCounters

    printers = db.query(PrinterModel).all()
    printer_map = {p.id: p for p in printers}

    total = len(printers)
    online = sum(1 for p in printers if p.status == 'ONLINE')
    warning = sum(1 for p in printers if p.status == 'WARNING')
    offline = sum(1 for p in printers if p.status == 'OFFLINE')

    # Consumables Requiring Replacement (already in memory from printers query)
    low_toner = [{"id": p.id, "hostname": p.hostname, "ip_address": p.ip_address, "level": p.toner_level, "type": "Toner"} for p in printers if p.toner_level is not None and p.toner_level <= 10]
    low_drum  = [{"id": p.id, "hostname": p.hostname, "ip_address": p.ip_address, "level": p.drum_level,  "type": "Drum"}  for p in printers if p.drum_level  is not None and p.drum_level  <= 10]
    consumables_alert = low_toner + low_drum

    # Alert counts — 2 scalar queries
    active_alerts   = db.query(Alert).filter(Alert.is_resolved == False).count()
    critical_alerts = db.query(Alert).filter(Alert.is_resolved == False, Alert.severity == 'CRITICAL').count()

    # Latest counter per printer — 1 query with GROUP BY + MAX
    subq = (
        db.query(
            PrinterCounters.printer_id,
            func.max(PrinterCounters.measured_at).label("max_ts")
        )
        .group_by(PrinterCounters.printer_id)
        .subquery()
    )
    latest_rows = (
        db.query(PrinterCounters)
        .join(subq, (PrinterCounters.printer_id == subq.c.printer_id) &
                    (PrinterCounters.measured_at == subq.c.max_ts))
        .all()
    )
    pages_printed = sum(c.total_pages for c in latest_rows if c.total_pages is not None)

    # Recent Alerts — 1 JOIN query instead of N+1
    recent_alerts_raw = (
        db.query(Alert, PrinterModel)
        .outerjoin(PrinterModel, Alert.printer_id == PrinterModel.id)
        .filter(Alert.is_resolved == False)
        .order_by(Alert.created_at.desc())
        .limit(5)
        .all()
    )
    recent_alerts = [
        {
            "id": a.id,
            "printer_id": a.printer_id,
            "hostname": p.hostname if p else "Unknown",
            "ip_address": p.ip_address if p else "Unknown",
            "alert_type": a.alert_type,
            "severity": a.severity,
            "message": a.message,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a, p in recent_alerts_raw
    ]

    # Top Printers by Volume — use already-loaded printer_map (no extra DB calls)
    sorted_counters = sorted(latest_rows, key=lambda c: c.total_pages or 0, reverse=True)[:5]
    top_printers = [
        {
            "printer_id": c.printer_id,
            "hostname": printer_map[c.printer_id].hostname if c.printer_id in printer_map else None,
            "ip_address": printer_map[c.printer_id].ip_address if c.printer_id in printer_map else None,
            "total_pages": c.total_pages,
            "model": printer_map[c.printer_id].model if c.printer_id in printer_map else None,
        }
        for c in sorted_counters
        if c.printer_id in printer_map
    ]

    # Department Distribution — already in memory
    from collections import Counter
    dept_counts = dict(Counter(p.department for p in printers if p.department))
    department_distribution = [{"name": k, "value": v} for k, v in dept_counts.items()] or [{"name": "Unassigned", "value": total}]

    return {
        "status_summary": {"total": total, "online": online, "warning": warning, "offline": offline},
        "metrics": {
            "active_alerts": active_alerts,
            "critical_alerts": critical_alerts,
            "pages_printed": pages_printed,
            "low_toner_printers": len(low_toner),
            "avg_response": "N/A",
        },
        "consumables_alert": consumables_alert,
        "recent_alerts": recent_alerts,
        "top_printers": top_printers,
        "department_distribution": department_distribution,
    }

@router.get("/", response_model=List[PrinterResponse])
def get_printers(skip: int = 0, limit: int = 1000, db: Session = Depends(get_db)):
    printers = db.query(PrinterModel).offset(skip).limit(limit).all()
    return printers

@router.post("/", response_model=PrinterResponse)
def add_printer(printer: PrinterCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    db_printer = db.query(PrinterModel).filter(PrinterModel.ip_address == printer.ip_address).first()
    if db_printer:
        raise HTTPException(status_code=400, detail="Printer with this IP already exists")
    
    new_printer = PrinterModel(**printer.dict())
    db.add(new_printer)
    db.flush()
    new_id = new_printer.id
    db.commit()
    db.refresh(new_printer)
    
    # Schedule background task
    async def run_sync(p_ids):
        await sync_specific_printers(p_ids)
        
    background_tasks.add_task(run_sync, [new_id])
    
    return new_printer

def parse_ips(raw: str) -> List[str]:
    ips = set()
    lines = raw.replace(',', '\n').split('\n')
    for line in lines:
        line = line.strip()
        if not line:
            continue
        # Check if range like 10.119.34.21-50
        match = re.match(r'^(\d+\.\d+\.\d+\.)(\d+)-(\d+)$', line)
        if match:
            prefix = match.group(1)
            start = int(match.group(2))
            end = int(match.group(3))
            if start <= end and start >= 0 and end <= 255:
                for i in range(start, end + 1):
                    ips.add(f"{prefix}{i}")
        else:
            try:
                # Validate simple IP
                ipaddress.ip_address(line)
                ips.add(line)
            except ValueError:
                pass
    return list(ips)

@router.patch("/{printer_id}/toggle-favorite")
def toggle_favorite(printer_id: int, db: Session = Depends(get_db)):
    db_printer = db.query(PrinterModel).filter(PrinterModel.id == printer_id).first()
    if not db_printer:
        raise HTTPException(status_code=404, detail="Printer not found")
    
    new_fav = not getattr(db_printer, 'is_favorite', False)
    db_printer.is_favorite = new_fav
    db.commit()
    return {"status": "success", "is_favorite": new_fav}

@router.get("/{printer_id}/history")
def get_printer_history(printer_id: int, days: int = 30, db: Session = Depends(get_db)):
    from datetime import datetime, timedelta
    from app.models.monitoring import PrinterStatusHistory, PrinterCounters, PrinterSuppliesSnapshot
    
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    # Get status history
    try:
        status_history = db.query(PrinterStatusHistory).filter(
            PrinterStatusHistory.printer_id == printer_id,
            PrinterStatusHistory.checked_at >= cutoff
        ).order_by(PrinterStatusHistory.checked_at.desc()).limit(50).all()
    except Exception:
        db.rollback()
        status_history = []
    
    # Get counters history
    try:
        counters_history = db.query(PrinterCounters).filter(
            PrinterCounters.printer_id == printer_id,
            PrinterCounters.measured_at >= cutoff
        ).order_by(PrinterCounters.measured_at.asc()).all()
    except Exception:
        db.rollback()
        counters_history = []

    # Get supplies snapshots — table may not exist yet on first run
    try:
        supplies_history = db.query(PrinterSuppliesSnapshot).filter(
            PrinterSuppliesSnapshot.printer_id == printer_id,
            PrinterSuppliesSnapshot.measured_at >= cutoff
        ).order_by(PrinterSuppliesSnapshot.measured_at.asc()).all()
    except Exception:
        db.rollback()
        supplies_history = []
    
    return {
        "status_history": [{"status": s.status, "checked_at": s.checked_at.isoformat()} for s in status_history],
        "counters_history": [{"total_pages": c.total_pages, "measured_at": c.measured_at.isoformat()} for c in counters_history],
        "supplies_history": [{
            "toner_level": s.toner_level,
            "drum_level": s.drum_level,
            "fuser_level": s.fuser_level,
            "laser_unit_level": s.laser_unit_level,
            "pf_kit_mp_level": s.pf_kit_mp_level,
            "pf_kit_1_level": s.pf_kit_1_level,
            "measured_at": s.measured_at.isoformat()
        } for s in supplies_history]
    }


@router.delete("/{printer_id}")
def delete_printer(printer_id: int, db: Session = Depends(get_db)):
    db_printer = db.query(PrinterModel).filter(PrinterModel.id == printer_id).first()
    if not db_printer:
        raise HTTPException(status_code=404, detail="Printer not found")
    db.delete(db_printer)
    db.commit()
    return {"status": "success", "message": "Printer deleted successfully"}

@router.delete("/")
def delete_all_printers(db: Session = Depends(get_db)):
    try:
        # Remove dependent records first because existing databases may not have
        # cascading foreign keys for every printer-related table.
        db.query(Alert).delete(synchronize_session=False)
        db.query(PrinterStatusHistory).delete(synchronize_session=False)
        db.query(PrinterSupplies).delete(synchronize_session=False)
        db.query(PrinterCounters).delete(synchronize_session=False)
        db.query(PrinterSuppliesSnapshot).delete(synchronize_session=False)
        db.query(PrinterPin).delete(synchronize_session=False)
        db.execute(delete(printer_group_association))
        db.query(PrinterModel).delete()
        db.commit()
        return {"status": "success", "message": "All printers deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/export/csv")
def export_printers(db: Session = Depends(get_db)):
    printers = db.query(PrinterModel).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["IP Address", "Hostname", "Manufacturer", "Model", "SNMP Community"])
    for p in printers:
        writer.writerow([p.ip_address, p.hostname, p.manufacturer, p.model, p.snmp_community])
    
    output.seek(0)
    
    # Audit log
    db.add(AuditLog(action="EXPORT_PRINTERS", entity_type="Printer"))
    db.commit()

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=printers_export.csv"}
    )

@router.post("/import/csv")
def import_printers(file: UploadFile = File(...), background_tasks: BackgroundTasks = None, db: Session = Depends(get_db)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be CSV")
    
    content = file.file.read().decode('utf-8')
    reader = csv.reader(io.StringIO(content))
    next(reader, None) # Skip header
    
    count = 0
    added_ids = []
    for row in reader:
        if not row or len(row) < 1: continue
        ip = row[0]
        if db.query(PrinterModel).filter(PrinterModel.ip_address == ip).first():
            continue
        
        printer = PrinterModel(
            ip_address=ip,
            hostname=row[1] if len(row) > 1 else None,
            manufacturer=row[2] if len(row) > 2 else None,
            model=row[3] if len(row) > 3 else None,
            snmp_community=row[4] if len(row) > 4 else "public"
        )
        db.add(printer)
        db.flush()
        added_ids.append(printer.id)
        count += 1
        
    db.add(AuditLog(action="IMPORT_PRINTERS", entity_type="Printer", details=f"Imported {count} printers via CSV"))
    db.commit()
    
    # Schedule background task
    if added_ids and background_tasks:
        async def run_sync(p_ids):
            await sync_specific_printers(p_ids)
        background_tasks.add_task(run_sync, added_ids)
        
    return {"status": "success", "message": f"Imported {count} printers"}

@router.post("/bulk")
def add_printers_bulk(payload: PrinterBulkCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    ip_list = parse_ips(payload.raw_ips)
    if not ip_list:
        raise HTTPException(status_code=400, detail="No valid IP addresses found")
    
    added_ids = []
    added = 0
    for ip in ip_list:
        db_printer = db.query(PrinterModel).filter(PrinterModel.ip_address == ip).first()
        if not db_printer:
            new_printer = PrinterModel(ip_address=ip)
            db.add(new_printer)
            db.flush()
            added_ids.append(new_printer.id)
            added += 1
            
    db.add(AuditLog(action="ADD_PRINTERS_BULK", entity_type="Printer", details=f"Added {added} printers"))
    db.commit()
    
    # Schedule background task to fetch SNMP info immediately
    if added_ids and background_tasks:
        async def run_sync(p_ids):
            await sync_specific_printers(p_ids)
        background_tasks.add_task(run_sync, added_ids)
        
    return {"message": f"Successfully added {added} printers. Data is being fetched in the background.", "added_count": added}

@router.get("/debug_snmp/{ip}")
async def debug_snmp(ip: str):
    from pysnmp.hlapi.asyncio import SnmpEngine, CommunityData, UdpTransportTarget, ContextData, ObjectType, ObjectIdentity, next_cmd, get_cmd
    
    engine = SnmpEngine()
    results = {"standard_desc": {}, "brother_hex": None}
    
    try:
        # Standard descriptions
        async for errorIndication, errorStatus, errorIndex, varBinds in next_cmd(
            engine,
            CommunityData('public', mpModel=1),
            await UdpTransportTarget.create((ip, 161)),
            ContextData(),
            ObjectType(ObjectIdentity('1.3.6.1.2.1.43.11.1.1.6')),
            lexicographicMode=False
        ):
            if not errorIndication and not errorStatus:
                for vb in varBinds:
                    results["standard_desc"][str(vb[0])] = str(vb[1])
                    
        # Brother Maintenance Info (Toner Hex)
        errorIndication, errorStatus, errorIndex, varBinds = await get_cmd(
            engine,
            CommunityData('public', mpModel=1),
            await UdpTransportTarget.create((ip, 161)),
            ContextData(),
            ObjectType(ObjectIdentity('1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.8.0'))
        )
        if not errorIndication and not errorStatus:
            results["brother_hex"] = varBinds[0][1].prettyPrint()
            
    except Exception as e:
        results["error"] = str(e)
    finally:
        if hasattr(engine, 'transportDispatcher') and engine.transportDispatcher:
            engine.transportDispatcher.closeDispatcher()
            
    return results

from pydantic import BaseModel
from datetime import datetime
from app.models.printer import MaintenanceLog

class MaintenanceLogCreate(BaseModel):
    description: str
    performed_by: str | None = None

class MaintenanceLogResponse(BaseModel):
    id: int
    printer_id: int
    description: str
    performed_by: str | None
    date: datetime

    class Config:
        orm_mode = True

@router.get("/{printer_id}/maintenance", response_model=List[MaintenanceLogResponse])
def get_maintenance_logs(printer_id: int, db: Session = Depends(get_db)):
    return db.query(MaintenanceLog).filter(MaintenanceLog.printer_id == printer_id).order_by(MaintenanceLog.date.desc()).all()

@router.post("/{printer_id}/maintenance", response_model=MaintenanceLogResponse)
def add_maintenance_log(printer_id: int, log_in: MaintenanceLogCreate, db: Session = Depends(get_db)):
    db_printer = db.query(PrinterModel).filter(PrinterModel.id == printer_id).first()
    if not db_printer:
        raise HTTPException(status_code=404, detail="Printer not found")
        
    new_log = MaintenanceLog(
        printer_id=printer_id,
        description=log_in.description,
        performed_by=log_in.performed_by,
        date=datetime.utcnow()
    )
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    return new_log

@router.delete("/{printer_id}/maintenance/{log_id}")
def delete_maintenance_log(printer_id: int, log_id: int, db: Session = Depends(get_db)):
    log = db.query(MaintenanceLog).filter(MaintenanceLog.id == log_id, MaintenanceLog.printer_id == printer_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    
    db.delete(log)
    db.commit()
    return {"status": "success"}

