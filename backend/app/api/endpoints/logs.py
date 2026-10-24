import os
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from app.db.session import get_db
from app.models.audit import LoginLog
from app.api.deps import get_current_active_user

router = APIRouter()

LOG_FILE_PATH = r"d:\app\Printer-Monitor\logs\printer_system.log"

class LoginLogSchema(BaseModel):
    id: int
    username: str
    user_id: Optional[int] = None
    display_name: Optional[str] = None
    role: Optional[str] = None
    ip_address: Optional[str] = None
    hostname: Optional[str] = None
    user_agent: Optional[str] = None
    device_type: Optional[str] = None
    os_name: Optional[str] = None
    browser_name: Optional[str] = None
    status: str
    fail_reason: Optional[str] = None
    login_at: datetime

    class Config:
        orm_mode = True

@router.get("/")
@router.get("")
def get_system_logs(lines: int = 100):
    if not os.path.exists(LOG_FILE_PATH):
        return {"logs": ["Log file not found."]}
    
    try:
        with open(LOG_FILE_PATH, 'r', encoding='utf-8', errors='replace') as f:
            all_lines = f.readlines()
            # Return last N lines
            return {"logs": all_lines[-lines:]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/login-history", response_model=List[LoginLogSchema])
@router.get("/login-history/", response_model=List[LoginLogSchema])
def get_login_history(
    limit: int = 200, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Retrieve history of user logins with IP, Device, OS, and Hostname."""
    logs = db.query(LoginLog).order_by(LoginLog.login_at.desc()).limit(limit).all()
    return logs

from app.api.deps import get_current_active_admin

@router.delete("/login-history/all")
@router.delete("/login-history/all/")
def clear_all_login_history(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_admin)
):
    """Clear all login history logs (Admin only)."""
    db.query(LoginLog).delete()
    db.commit()
    return {"status": "success", "message": "ล้างประวัติการเข้าสู่ระบบทั้งหมดเรียบร้อยแล้ว"}

@router.delete("/login-history/{log_id}")
@router.delete("/login-history/{log_id}/")
def delete_login_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_admin)
):
    """Delete a single login history record (Admin only)."""
    log = db.query(LoginLog).filter(LoginLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="ไม่พบรายการบันทึกนี้")
    db.delete(log)
    db.commit()
    return {"status": "success", "message": "ลบรายการบันทึกเรียบร้อยแล้ว"}

