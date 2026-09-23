from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.schemas.printer import PrinterResponse

class GroupBase(BaseModel):
    name: str
    description: Optional[str] = None

class GroupCreate(GroupBase):
    pass

class GroupUpdate(GroupBase):
    pass

class GroupResponse(GroupBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

class GroupWithPrintersResponse(GroupResponse):
    printers: List[PrinterResponse] = []
