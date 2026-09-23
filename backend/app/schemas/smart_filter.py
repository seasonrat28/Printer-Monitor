from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class SmartFilterBase(BaseModel):
    name: str
    description: Optional[str] = None

class SmartFilterCreate(SmartFilterBase):
    pass

class SmartFilterUpdate(SmartFilterBase):
    name: Optional[str] = None

class SmartFilter(SmartFilterBase):
    id: int
    created_at: datetime
    
    class Config:
        orm_mode = True
