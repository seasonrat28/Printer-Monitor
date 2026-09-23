from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.models.base import Base

class Printer(Base):
    __tablename__ = "printers"
    
    id = Column(Integer, primary_key=True, index=True)
    ip_address = Column(String, unique=True, index=True, nullable=False)
    hostname = Column(String, nullable=True)
    mac_address = Column(String, nullable=True)
    model = Column(String, nullable=True)
    manufacturer = Column(String, nullable=True)
    serial_number = Column(String, nullable=True)
    location = Column(String, nullable=True)
    site = Column(String, nullable=True)
    floor = Column(String, nullable=True)
    department = Column(String, nullable=True)
    status = Column(String, default="UNKNOWN")
    status_message = Column(String, nullable=True)
    last_seen = Column(DateTime, nullable=True)
    toner_level = Column(Integer, nullable=True)
    drum_level = Column(Integer, nullable=True)
    toner_black_level = Column(Integer, nullable=True)
    toner_cyan_level = Column(Integer, nullable=True)
    toner_magenta_level = Column(Integer, nullable=True)
    toner_yellow_level = Column(Integer, nullable=True)
    toner_photo_black_level = Column(Integer, nullable=True)   # Epson PK
    toner_matte_black_level = Column(Integer, nullable=True)   # Epson MK
    toner_red_level = Column(Integer, nullable=True)           # Epson R
    drum_black_level = Column(Integer, nullable=True)
    drum_cyan_level = Column(Integer, nullable=True)
    drum_magenta_level = Column(Integer, nullable=True)
    drum_yellow_level = Column(Integer, nullable=True)
    asset_status = Column(String(50), default="Deployed")
    purchase_date = Column(Date, nullable=True)
    warranty_expiry = Column(Date, nullable=True)
    
    lease_provider = Column(String, nullable=True)
    lease_start_date = Column(Date, nullable=True)
    lease_end_date = Column(Date, nullable=True)

    fuser_level = Column(Integer, nullable=True)
    laser_unit_level = Column(Integer, nullable=True)
    pf_kit_mp_level = Column(Integer, nullable=True)
    pf_kit_1_level = Column(Integer, nullable=True)
    is_favorite = Column(Boolean, default=False)
    snmp_enabled = Column(Boolean, default=True)
    snmp_version = Column(String, default="v2c")
    snmp_community = Column(String, default="public")
    scraper_type = Column(String, default="snmp")
    page_count = Column(Integer, nullable=True, default=0)
    borrowed_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    alerts = relationship("Alert", back_populates="printer", cascade="all, delete-orphan")
    maintenance_logs = relationship("MaintenanceLog", back_populates="printer", cascade="all, delete-orphan")
    borrow_logs = relationship("PrinterBorrowLog", back_populates="printer", cascade="all, delete-orphan")
    attachments = relationship("PrinterAttachment", back_populates="printer", cascade="all, delete-orphan")


class PrinterAttachment(Base):
    __tablename__ = "printer_attachments"
    
    id = Column(Integer, primary_key=True, index=True)
    printer_id = Column(Integer, ForeignKey('printers.id'), index=True)
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False) # in bytes
    file_type = Column(String, nullable=True) # mime type
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    
    printer = relationship("Printer", back_populates="attachments")


class PrinterBorrowLog(Base):
    __tablename__ = "printer_borrow_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    printer_id = Column(Integer, ForeignKey('printers.id'), index=True)
    department = Column(String, nullable=False)
    remark = Column(String, nullable=True)
    status = Column(String, default="Active")  # 'Active' or 'Returned'
    created_at = Column(DateTime, default=datetime.utcnow)
    
    printer = relationship("Printer", back_populates="borrow_logs")


class MaintenanceLog(Base):
    __tablename__ = "maintenance_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    printer_id = Column(Integer, ForeignKey('printers.id'), index=True)
    description = Column(String, nullable=False)
    performed_by = Column(String, nullable=True)
    date = Column(DateTime, default=datetime.utcnow)
    
    printer = relationship("Printer", back_populates="maintenance_logs")
