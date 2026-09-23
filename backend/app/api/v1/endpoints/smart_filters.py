from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.models.smart_filter import SmartFilter
from app.schemas.smart_filter import SmartFilter as SmartFilterSchema, SmartFilterCreate, SmartFilterUpdate
from app.models.printer import Printer

router = APIRouter()

@router.get("/", response_model=List[dict])
def get_smart_filters(db: Session = Depends(get_db)):
    filters = db.query(SmartFilter).all()
    # Return count of printers with it
    result = []
    for f in filters:
        result.append({
            "id": f.id,
            "name": f.name,
            "description": f.description,
            "created_at": f.created_at,
            "printers": [{"id": p.id, "ip_address": p.ip_address} for p in f.printers]
        })
    return result

@router.post("/", response_model=SmartFilterSchema)
def create_smart_filter(filter_in: SmartFilterCreate, db: Session = Depends(get_db)):
    db_filter = SmartFilter(**filter_in.dict())
    db.add(db_filter)
    try:
        db.commit()
        db.refresh(db_filter)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Smart Filter name might already exist")
    return db_filter

@router.put("/{filter_id}", response_model=SmartFilterSchema)
def update_smart_filter(filter_id: int, filter_in: SmartFilterUpdate, db: Session = Depends(get_db)):
    db_filter = db.query(SmartFilter).filter(SmartFilter.id == filter_id).first()
    if not db_filter:
        raise HTTPException(status_code=404, detail="Smart filter not found")
        
    for var, value in filter_in.dict(exclude_unset=True).items():
        setattr(db_filter, var, value)
        
    try:
        db.commit()
        db.refresh(db_filter)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error updating smart filter")
    return db_filter

@router.delete("/{filter_id}")
def delete_smart_filter(filter_id: int, db: Session = Depends(get_db)):
    db_filter = db.query(SmartFilter).filter(SmartFilter.id == filter_id).first()
    if not db_filter:
        raise HTTPException(status_code=404, detail="Smart filter not found")
    
    # First clear association
    db_filter.printers = []
    db.commit()
    
    db.delete(db_filter)
    db.commit()
    return {"status": "ok"}
