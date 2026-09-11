from sqlalchemy import Column, Integer, String, Boolean, DateTime
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
    fuser_level = Column(Integer, nullable=True)
    laser_unit_level = Column(Integer, nullable=True)
    pf_kit_mp_level = Column(Integer, nullable=True)
    pf_kit_1_level = Column(Integer, nullable=True)
    is_favorite = Column(Boolean, default=False)
    snmp_enabled = Column(Boolean, default=True)
    snmp_version = Column(String, default="v2c")
    snmp_community = Column(String, default="public")
    # scraper_type: "snmp" (default) or "http_apeos" (HTTP scraping for Fujifilm Apeos)
    scraper_type = Column(String, default="snmp")
    page_count = Column(Integer, nullable=True, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    alerts = relationship("Alert", back_populates="printer", cascade="all, delete-orphan")

