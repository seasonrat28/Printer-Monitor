from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class PrinterBase(BaseModel):
    ip_address: str
    hostname: Optional[str] = None
    mac_address: Optional[str] = None
    model: Optional[str] = None
    manufacturer: Optional[str] = None
    serial_number: Optional[str] = None
    location: Optional[str] = None
    site: Optional[str] = None
    floor: Optional[str] = None
    department: Optional[str] = None
    status: Optional[str] = "UNKNOWN"
    toner_level: Optional[int] = None
    drum_level: Optional[int] = None
    snmp_enabled: Optional[bool] = True
    snmp_version: Optional[str] = "v2c"
    snmp_community: Optional[str] = "public"

class PrinterCreate(PrinterBase):
    pass

class PrinterBulkCreate(BaseModel):
    raw_ips: str

class PrinterUpdate(PrinterBase):
    pass

class PrinterResponse(PrinterBase):
    id: int
    last_seen: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True
