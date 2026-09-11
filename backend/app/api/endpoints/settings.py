from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.settings import SystemSetting
from app.schemas.settings import SettingsUpdate, SettingsResponse
from app.api.deps import get_current_active_user
from app.models.user import User
from fastapi import HTTPException

router = APIRouter()

def verify_admin(current_user: User = Depends(get_current_active_user)):
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user

@router.get("/", response_model=SettingsResponse)
def get_settings(db: Session = Depends(get_db), current_user: User = Depends(verify_admin)):
    settings_db = db.query(SystemSetting).all()
    result = {s.key: s.value for s in settings_db}
    return {"settings": result}

@router.put("/", response_model=SettingsResponse)
def update_settings(
    settings_in: SettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_admin)
):
    for key, value in settings_in.settings.items():
        db_setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if db_setting:
            db_setting.value = str(value)
        else:
            db_setting = SystemSetting(key=key, value=str(value))
            db.add(db_setting)
            
    db.commit()
    
    settings_db = db.query(SystemSetting).all()
    result = {s.key: s.value for s in settings_db}
    return {"settings": result}

from app.models.settings import BlacklistIP
from pydantic import BaseModel
from typing import List
import datetime

class BlacklistIPCreate(BaseModel):
    ip_address: str

class BlacklistIPResponse(BaseModel):
    id: int
    ip_address: str
    created_at: str | None
    
    class Config:
        orm_mode = True

@router.get("/blacklist", response_model=List[BlacklistIPResponse])
def get_blacklist(db: Session = Depends(get_db), current_user: User = Depends(verify_admin)):
    return db.query(BlacklistIP).all()

@router.post("/blacklist", response_model=BlacklistIPResponse)
def add_blacklist(item: BlacklistIPCreate, db: Session = Depends(get_db), current_user: User = Depends(verify_admin)):
    existing = db.query(BlacklistIP).filter(BlacklistIP.ip_address == item.ip_address).first()
    if existing:
        raise HTTPException(status_code=400, detail="IP already in blacklist")
        
    new_ip = BlacklistIP(
        ip_address=item.ip_address,
        created_at=datetime.datetime.utcnow().isoformat()
    )
    db.add(new_ip)
    db.commit()
    db.refresh(new_ip)
    return new_ip

@router.delete("/blacklist/all")
def clear_blacklist(db: Session = Depends(get_db), current_user: User = Depends(verify_admin)):
    db.query(BlacklistIP).delete()
    db.commit()
    return {"status": "success", "message": "Cleared blacklist"}

@router.delete("/blacklist/{ip_address}")
def remove_blacklist(ip_address: str, db: Session = Depends(get_db), current_user: User = Depends(verify_admin)):
    item = db.query(BlacklistIP).filter(BlacklistIP.ip_address == ip_address).first()
    if not item:
        raise HTTPException(status_code=404, detail="IP not found in blacklist")
        
    db.delete(item)
    db.commit()
    return {"status": "success"}
