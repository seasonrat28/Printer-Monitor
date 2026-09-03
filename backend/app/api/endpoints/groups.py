from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.models.group import PrinterGroup
from app.models.printer import Printer
from app.schemas.group import GroupCreate, GroupUpdate, GroupResponse, GroupWithPrintersResponse

router = APIRouter()

@router.get("/", response_model=List[GroupResponse])
def get_groups(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    groups = db.query(PrinterGroup).offset(skip).limit(limit).all()
    return groups

@router.get("/{group_id}", response_model=GroupWithPrintersResponse)
def get_group(group_id: int, db: Session = Depends(get_db)):
    group = db.query(PrinterGroup).filter(PrinterGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group

@router.post("/", response_model=GroupResponse)
def create_group(group_in: GroupCreate, db: Session = Depends(get_db)):
    # Check if name exists
    existing = db.query(PrinterGroup).filter(PrinterGroup.name == group_in.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Group name already registered")
    
    group = PrinterGroup(**group_in.model_dump())
    db.add(group)
    db.commit()
    db.refresh(group)
    return group

@router.put("/{group_id}", response_model=GroupResponse)
def update_group(group_id: int, group_in: GroupUpdate, db: Session = Depends(get_db)):
    group = db.query(PrinterGroup).filter(PrinterGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if group_in.name != group.name:
        existing = db.query(PrinterGroup).filter(PrinterGroup.name == group_in.name).first()
        if existing:
            raise HTTPException(status_code=400, detail="Group name already registered")

    for key, value in group_in.model_dump(exclude_unset=True).items():
        setattr(group, key, value)
        
    db.commit()
    db.refresh(group)
    return group

@router.delete("/{group_id}")
def delete_group(group_id: int, db: Session = Depends(get_db)):
    group = db.query(PrinterGroup).filter(PrinterGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Printers associated will just lose this group because it's a many-to-many relationship
    # handled automatically by SQLAlchemy cascade on the association table if configured, 
    # but let's safely clear the relationship first
    group.printers = []
    db.commit()
    
    db.delete(group)
    db.commit()
    return {"status": "success", "message": "Group deleted successfully"}

@router.post("/{group_id}/printers/{printer_id}")
def add_printer_to_group(group_id: int, printer_id: int, db: Session = Depends(get_db)):
    group = db.query(PrinterGroup).filter(PrinterGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
        
    if printer in group.printers:
        raise HTTPException(status_code=400, detail="Printer already in this group")
        
    group.printers.append(printer)
    db.commit()
    return {"status": "success"}

@router.delete("/{group_id}/printers/{printer_id}")
def remove_printer_from_group(group_id: int, printer_id: int, db: Session = Depends(get_db)):
    group = db.query(PrinterGroup).filter(PrinterGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
        
    if printer not in group.printers:
        raise HTTPException(status_code=400, detail="Printer not in this group")
        
    group.printers.remove(printer)
    db.commit()
    return {"status": "success"}
