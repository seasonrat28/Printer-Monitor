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
