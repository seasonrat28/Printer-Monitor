from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class InventoryItemBase(BaseModel):
    item_code: str
    name: str
    lot_number: Optional[str] = None
    page_yield: Optional[int] = None
    quantity_total: float = 0
    quantity_used: float = 0
    warehouse_id: int

class InventoryItemCreate(InventoryItemBase):
    pass

class InventoryItemUpdate(BaseModel):
    item_code: Optional[str] = None
    name: Optional[str] = None
    lot_number: Optional[str] = None
    page_yield: Optional[int] = None
    quantity_total: Optional[float] = None
    quantity_used: Optional[float] = None

class InventoryItemResponse(InventoryItemBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class InventoryUsageLogBase(BaseModel):
    inventory_item_id: int
    action: str
    quantity: float
    printer_id: Optional[int] = None
    serial_number: Optional[str] = None

class InventoryUsageLogCreate(InventoryUsageLogBase):
    pass

class InventoryUsageLogResponse(InventoryUsageLogBase):
    id: int
    timestamp: datetime
    
    # Optional nested data to make frontend display easier
    item_name: Optional[str] = None
    item_code: Optional[str] = None
    printer_ip: Optional[str] = None

    class Config:
        from_attributes = True

class WarehouseBase(BaseModel):
    name: str
    location: Optional[str] = None

class WarehouseCreate(WarehouseBase):
    pass

class WarehouseUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None

class WarehouseResponse(WarehouseBase):
    id: int
    created_at: datetime
    
    # We won't include full items here by default to prevent massive payloads,
    # but we can if we want to.
    # items: List[InventoryItemResponse] = []

    class Config:
        orm_mode = True
