from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import os
import uuid
import shutil
from app.db.session import get_db
from app.models.floormap import FloorMap, PrinterPin
from pydantic import BaseModel

router = APIRouter()

UPLOAD_DIR = "uploads/floormaps"
os.makedirs(UPLOAD_DIR, exist_ok=True)

class PrinterPinCreate(BaseModel):
    printer_id: int
    x_percent: float
    y_percent: float

class FloorMapCreate(BaseModel):
    name: str

class FloorMapResponse(BaseModel):
    id: int
    name: str
    image_url: str
    is_active: bool

    class Config:
        orm_mode = True

@router.get("/", response_model=List[FloorMapResponse])
def get_floormaps(db: Session = Depends(get_db)):
    return db.query(FloorMap).all()

@router.post("/upload", response_model=FloorMapResponse)
async def upload_floormap(name: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.png', '.jpg', '.jpeg')):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
        
    ext = file.filename.split('.')[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    new_map = FloorMap(
        name=name,
        image_url=f"/static/floormaps/{filename}",
    )
    db.add(new_map)
    db.commit()
    db.refresh(new_map)
    
    return new_map

@router.get("/{map_id}/pins")
def get_pins(map_id: int, db: Session = Depends(get_db)):
    pins = db.query(PrinterPin).filter(PrinterPin.floor_map_id == map_id).all()
    # We also want printer info
    result = []
    from app.models.printer import Printer
    for pin in pins:
        printer = db.query(Printer).filter(Printer.id == pin.printer_id).first()
        if printer:
            result.append({
                "id": pin.id,
                "printer_id": pin.printer_id,
                "x_percent": pin.x_percent,
                "y_percent": pin.y_percent,
                "printer": {
                    "ip_address": printer.ip_address,
                    "hostname": printer.hostname,
                    "status": printer.status,
                    "toner_level": printer.toner_level,
                    "drum_level": printer.drum_level
                }
            })
    return result

@router.post("/{map_id}/pins")
def add_or_update_pin(map_id: int, pin_req: PrinterPinCreate, db: Session = Depends(get_db)):
    existing = db.query(PrinterPin).filter(
        PrinterPin.floor_map_id == map_id, 
        PrinterPin.printer_id == pin_req.printer_id
    ).first()
    
    if existing:
        existing.x_percent = pin_req.x_percent
        existing.y_percent = pin_req.y_percent
    else:
        new_pin = PrinterPin(
            floor_map_id=map_id,
            printer_id=pin_req.printer_id,
            x_percent=pin_req.x_percent,
            y_percent=pin_req.y_percent
        )
        db.add(new_pin)
        
    db.commit()
    return {"status": "success"}

@router.delete("/{map_id}/pins/{pin_id}")
def delete_pin(map_id: int, pin_id: int, db: Session = Depends(get_db)):
    pin = db.query(PrinterPin).filter(PrinterPin.id == pin_id, PrinterPin.floor_map_id == map_id).first()
    if pin:
        db.delete(pin)
        db.commit()
    return {"status": "success"}

@router.put("/{map_id}", response_model=FloorMapResponse)
def update_floormap(map_id: int, floormap_req: FloorMapCreate, db: Session = Depends(get_db)):
    db_map = db.query(FloorMap).filter(FloorMap.id == map_id).first()
    if not db_map:
        raise HTTPException(status_code=404, detail="Map not found")
    
    db_map.name = floormap_req.name
    db.commit()
    db.refresh(db_map)
    return db_map

@router.delete("/{map_id}")
def delete_floormap(map_id: int, db: Session = Depends(get_db)):
    db_map = db.query(FloorMap).filter(FloorMap.id == map_id).first()
    if not db_map:
        raise HTTPException(status_code=404, detail="Map not found")
    
    # Try to delete the file
    try:
        filename = db_map.image_url.split('/')[-1]
        filepath = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(filepath):
            os.remove(filepath)
    except Exception as e:
        print(f"Error deleting file: {e}")

    # Delete pins associated with the map
    db.query(PrinterPin).filter(PrinterPin.floor_map_id == map_id).delete()
    
    # Delete the map itself
    db.delete(db_map)
    db.commit()
    return {"status": "success"}
