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
    toner_black_level: Optional[int] = None
    toner_cyan_level: Optional[int] = None
    toner_magenta_level: Optional[int] = None
    toner_yellow_level: Optional[int] = None
    toner_photo_black_level: Optional[int] = None   # Epson PK
    toner_matte_black_level: Optional[int] = None   # Epson MK
    toner_red_level: Optional[int] = None           # Epson R
    drum_black_level: Optional[int] = None
    drum_cyan_level: Optional[int] = None
    drum_magenta_level: Optional[int] = None
    drum_yellow_level: Optional[int] = None
    fuser_level: Optional[int] = None
    laser_unit_level: Optional[int] = None
    pf_kit_mp_level: Optional[int] = None
    pf_kit_1_level: Optional[int] = None
    page_count: Optional[int] = None
    is_favorite: Optional[bool] = False
    snmp_enabled: Optional[bool] = True
    snmp_version: Optional[str] = "v2c"
    snmp_community: Optional[str] = "public"
    borrowed_by: Optional[str] = None
    
    asset_status: Optional[str] = "Deployed"
    purchase_date: Optional[datetime] = None
    warranty_expiry: Optional[datetime] = None
    
    lease_provider: Optional[str] = None
    lease_start_date: Optional[datetime] = None
    lease_end_date: Optional[datetime] = None

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

class PrinterBorrowCreate(BaseModel):
    department: str
    remark: Optional[str] = None
