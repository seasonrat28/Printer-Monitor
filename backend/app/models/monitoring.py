from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Index
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
    
    __table_args__ = (
        Index('idx_status_printer_checked', printer_id, checked_at.desc()),
    )

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
    
    __table_args__ = (
        Index('idx_counters_printer_measured', printer_id, measured_at.desc()),
    )

class PrinterSuppliesSnapshot(Base):
    """Periodic snapshot of toner/drum/fuser levels for historical charting."""
    __tablename__ = "printer_supplies_snapshots"
    
    id = Column(Integer, primary_key=True, index=True)
    printer_id = Column(Integer, ForeignKey("printers.id"), nullable=False)
    toner_level = Column(Integer, nullable=True)
    drum_level = Column(Integer, nullable=True)
    
    __table_args__ = (
        Index('idx_snapshot_printer_measured', printer_id, id.desc()),
    )
    fuser_level = Column(Integer, nullable=True)
    laser_unit_level = Column(Integer, nullable=True)
    pf_kit_mp_level = Column(Integer, nullable=True)
    pf_kit_1_level = Column(Integer, nullable=True)
    measured_at = Column(DateTime, default=datetime.utcnow)
