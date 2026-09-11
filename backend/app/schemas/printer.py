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
    fuser_level: Optional[int] = None
    laser_unit_level: Optional[int] = None
    pf_kit_mp_level: Optional[int] = None
    pf_kit_1_level: Optional[int] = None
    page_count: Optional[int] = None
    is_favorite: Optional[bool] = False
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
