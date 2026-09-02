from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float
from datetime import datetime
from app.models.base import Base

class PrinterStatusHistory(Base):
    __tablename__ = "printer_status_history"
    
    id = Column(Integer, primary_key=True, index=True)
    printer_id = Column(Integer, ForeignKey("printers.id"), nullable=False)
    status = Column(String, nullable=False)
    error_message = Column(String, nullable=True)
    response_time = Column(Float, nullable=True) # in ms
    checked_at = Column(DateTime, default=datetime.utcnow)

class PrinterSupplies(Base):
    __tablename__ = "printer_supplies"
    
    id = Column(Integer, primary_key=True, index=True)
    printer_id = Column(Integer, ForeignKey("printers.id"), nullable=False)
    supply_type = Column(String, nullable=False) # e.g. 'toner', 'drum'
    name = Column(String, nullable=False) # e.g. 'Black Toner'
    level = Column(Integer, nullable=True)
    maximum = Column(Integer, nullable=True)
    status = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class PrinterCounters(Base):
    __tablename__ = "printer_counters"
    
    id = Column(Integer, primary_key=True, index=True)
    printer_id = Column(Integer, ForeignKey("printers.id"), nullable=False)
    total_pages = Column(Integer, nullable=True)
    print_pages = Column(Integer, nullable=True)
    copy_pages = Column(Integer, nullable=True)
    scan_pages = Column(Integer, nullable=True)
    measured_at = Column(DateTime, default=datetime.utcnow)
