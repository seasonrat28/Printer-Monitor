from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class AlertBase(BaseModel):
    printer_id: int
    alert_type: str
    severity: str
    message: str

class AlertCreate(AlertBase):
    pass

class AlertUpdate(BaseModel):
    is_resolved: Optional[bool] = None

class AlertResponse(AlertBase):
    id: int
    is_resolved: bool
    created_at: datetime
    resolved_at: Optional[datetime] = None
    
    # Extra fields for UI convenience
    printer_hostname: Optional[str] = None
    printer_ip: Optional[str] = None
    printer_location: Optional[str] = None

    class Config:
        from_attributes = True
