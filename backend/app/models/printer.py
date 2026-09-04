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
    last_seen = Column(DateTime, nullable=True)
    toner_level = Column(Integer, nullable=True)
    drum_level = Column(Integer, nullable=True)
    snmp_enabled = Column(Boolean, default=True)
    snmp_version = Column(String, default="v2c")
    snmp_community = Column(String, default="public")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    alerts = relationship("Alert", back_populates="printer", cascade="all, delete-orphan")
