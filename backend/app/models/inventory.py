from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.models.base import Base

class Warehouse(Base):
    __tablename__ = "warehouses"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False) # e.g. "คลัง 81 : Paolo เกษตร"
    location = Column(String, nullable=True) # e.g. "สถานที่ 00 : Paolo เกษตร"
    created_at = Column(DateTime, default=datetime.utcnow)
    
    items = relationship("InventoryItem", back_populates="warehouse", cascade="all, delete-orphan")

class InventoryItem(Base):
    __tablename__ = "inventory_items"
    
    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    
    item_code = Column(String, index=True, nullable=False) # e.g. "ST-FTS-CT351436"
    name = Column(String, nullable=False) # e.g. "Drum Fujifilm for Apeos 4620SX"
    lot_number = Column(String, nullable=True) # e.g. "690901"
    page_yield = Column(Integer, nullable=True) # e.g. 73000
    
    quantity_total = Column(Float, default=0) # จำนวน (Total received)
    quantity_used = Column(Float, default=0) # ใช้ไป (Used)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    warehouse = relationship("Warehouse", back_populates="items")
    logs = relationship("InventoryUsageLog", back_populates="item", cascade="all, delete-orphan")

class InventoryUsageLog(Base):
    __tablename__ = "inventory_usage_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=False)
    action = Column(String, nullable=False) # "use" or "return"
    quantity = Column(Float, nullable=False)
    
    # Optional context fields
    printer_id = Column(Integer, ForeignKey("printers.id"), nullable=True)
    serial_number = Column(String, nullable=True)
    
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    item = relationship("InventoryItem", back_populates="logs")
    printer = relationship("Printer")
