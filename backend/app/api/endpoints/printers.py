from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import csv
import io
from fastapi.responses import StreamingResponse

from app.db.session import get_db
from app.models.printer import Printer as PrinterModel
from app.schemas.printer import PrinterCreate, PrinterUpdate, PrinterResponse
from app.models.audit import AuditLog

router = APIRouter()

@router.get("/", response_model=List[PrinterResponse])
def get_printers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    printers = db.query(PrinterModel).offset(skip).limit(limit).all()
    return printers

@router.post("/", response_model=PrinterResponse)
def add_printer(printer: PrinterCreate, db: Session = Depends(get_db)):
    db_printer = db.query(PrinterModel).filter(PrinterModel.ip_address == printer.ip_address).first()
    if db_printer:
        raise HTTPException(status_code=400, detail="Printer with this IP already exists")
    
    new_printer = PrinterModel(**printer.dict())
    db.add(new_printer)
    db.commit()
    db.refresh(new_printer)
    return new_printer

import ipaddress
import re

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

from app.schemas.printer import PrinterBulkCreate

@router.post("/bulk")
def add_printers_bulk(payload: PrinterBulkCreate, db: Session = Depends(get_db)):
    ip_list = parse_ips(payload.raw_ips)
    if not ip_list:
        raise HTTPException(status_code=400, detail="No valid IP addresses found")
    
    added = 0
    for ip in ip_list:
        db_printer = db.query(PrinterModel).filter(PrinterModel.ip_address == ip).first()
        if not db_printer:
            new_printer = PrinterModel(ip_address=ip)
            db.add(new_printer)
            added += 1
            
    db.add(AuditLog(action="ADD_PRINTERS_BULK", entity_type="Printer", details=f"Added {added} printers"))
    db.commit()
    return {"message": f"Successfully added {added} printers", "added_count": added}

@router.get("/{printer_id}", response_model=PrinterResponse)
def get_printer(printer_id: int, db: Session = Depends(get_db)):
    db_printer = db.query(PrinterModel).filter(PrinterModel.id == printer_id).first()
    if not db_printer:
        raise HTTPException(status_code=404, detail="Printer not found")
    return db_printer

@router.delete("/{printer_id}")
def delete_printer(printer_id: int, db: Session = Depends(get_db)):
    db_printer = db.query(PrinterModel).filter(PrinterModel.id == printer_id).first()
    if not db_printer:
        raise HTTPException(status_code=404, detail="Printer not found")
    db.delete(db_printer)
    db.commit()
    return {"status": "success", "message": "Printer deleted successfully"}

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
def import_printers(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be CSV")
    
    content = file.file.read().decode('utf-8')
    reader = csv.reader(io.StringIO(content))
    next(reader, None) # Skip header
    
    count = 0
    for row in reader:
        if len(row) >= 1:
            ip = row[0]
            existing = db.query(PrinterModel).filter(PrinterModel.ip_address == ip).first()
            if not existing:
                new_printer = PrinterModel(
                    ip_address=ip,
                    hostname=row[1] if len(row) > 1 else None,
                    manufacturer=row[2] if len(row) > 2 else None,
                    model=row[3] if len(row) > 3 else None,
                    snmp_community=row[4] if len(row) > 4 else "public"
                )
                db.add(new_printer)
                count += 1
                
    db.add(AuditLog(action="IMPORT_PRINTERS", entity_type="Printer", details=f"Imported {count} printers"))
    db.commit()
    return {"message": f"Successfully imported {count} printers"}
