from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.models.inventory import Warehouse, InventoryItem, InventoryUsageLog
from app.schemas.inventory import (
    WarehouseCreate, WarehouseResponse, WarehouseUpdate,
    InventoryItemCreate, InventoryItemResponse, InventoryItemUpdate,
    InventoryUsageLogResponse
)

router = APIRouter()

# --- Warehouses ---

@router.get("/warehouses", response_model=List[WarehouseResponse])
def get_warehouses(db: Session = Depends(get_db)):
    return db.query(Warehouse).all()

@router.post("/warehouses", response_model=WarehouseResponse)
def create_warehouse(warehouse: WarehouseCreate, db: Session = Depends(get_db)):
    new_warehouse = Warehouse(**warehouse.dict())
    db.add(new_warehouse)
    db.commit()
    db.refresh(new_warehouse)
    return new_warehouse

@router.delete("/warehouses/{warehouse_id}")
def delete_warehouse(warehouse_id: int, db: Session = Depends(get_db)):
    db_warehouse = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    if not db_warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    db.delete(db_warehouse)
    db.commit()
    return {"status": "success"}


# --- Inventory Items ---

@router.get("/items", response_model=List[InventoryItemResponse])
def get_inventory_items(warehouse_id: int = None, db: Session = Depends(get_db)):
    query = db.query(InventoryItem)
    if warehouse_id:
        query = query.filter(InventoryItem.warehouse_id == warehouse_id)
    return query.all()

@router.post("/items", response_model=InventoryItemResponse)
def create_inventory_item(item: InventoryItemCreate, db: Session = Depends(get_db)):
    # Check if warehouse exists
    if not db.query(Warehouse).filter(Warehouse.id == item.warehouse_id).first():
        raise HTTPException(status_code=404, detail="Warehouse not found")
        
    new_item = InventoryItem(**item.dict())
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item

@router.put("/items/{item_id}", response_model=InventoryItemResponse)
def update_inventory_item(item_id: int, item_update: InventoryItemUpdate, db: Session = Depends(get_db)):
    db_item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    update_data = item_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_item, key, value)
        
    db.commit()
    db.refresh(db_item)
    return db_item

@router.post("/items/{item_id}/use")
def use_inventory_item(item_id: int, quantity: float = 1.0, printer_id: int = None, serial_number: str = None, db: Session = Depends(get_db)):
    db_item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    # Check if we have enough
    balance = db_item.quantity_total - db_item.quantity_used
    if balance < quantity:
        raise HTTPException(status_code=400, detail="Not enough stock balance")
        
    db_item.quantity_used += quantity
    
    # Create log
    log = InventoryUsageLog(
        inventory_item_id=item_id,
        action="use",
        quantity=quantity,
        printer_id=printer_id,
        serial_number=serial_number
    )
    db.add(log)
    
    db.commit()
    db.refresh(db_item)
    
    return {"status": "success", "new_balance": db_item.quantity_total - db_item.quantity_used, "quantity_used": db_item.quantity_used}

@router.post("/items/{item_id}/return")
def return_inventory_item(item_id: int, quantity: float = 1.0, printer_id: int = None, serial_number: str = None, db: Session = Depends(get_db)):
    db_item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    if db_item.quantity_used < quantity:
        raise HTTPException(status_code=400, detail="Cannot return more than what was used")
        
    db_item.quantity_used -= quantity
    
    # Create log
    log = InventoryUsageLog(
        inventory_item_id=item_id,
        action="return",
        quantity=quantity,
        printer_id=printer_id,
        serial_number=serial_number
    )
    db.add(log)
    
    db.commit()
    db.refresh(db_item)
    
    return {"status": "success", "new_balance": db_item.quantity_total - db_item.quantity_used, "quantity_used": db_item.quantity_used}

@router.delete("/items/{item_id}")
def delete_inventory_item(item_id: int, db: Session = Depends(get_db)):
    db_item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    db.delete(db_item)
    db.commit()
    return {"status": "success"}

# --- Logs ---

@router.get("/logs", response_model=List[InventoryUsageLogResponse])
def get_inventory_logs(limit: int = 50, db: Session = Depends(get_db)):
    logs = db.query(InventoryUsageLog).order_by(InventoryUsageLog.timestamp.desc()).limit(limit).all()
    
    # Enrich with frontend friendly data
    result = []
    for log in logs:
        log_dict = {
            "inventory_item_id": log.inventory_item_id,
            "action": log.action,
            "quantity": log.quantity,
            "printer_id": log.printer_id,
            "serial_number": log.serial_number,
            "id": log.id,
            "timestamp": log.timestamp,
        }
        
        # Add item details
        if log.item:
            log_dict["item_name"] = log.item.name
            log_dict["item_code"] = log.item.item_code
            
        # Add printer details
        if log.printer:
            log_dict["printer_ip"] = log.printer.ip_address
            
        result.append(log_dict)
        
    return result
