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
        raise HTTPException(status_code=403, detail="สิทธิ์ของคุณไม่เพียงพอ (เฉพาะผู้ดูแลระบบไอทีเท่านั้น)")
    return current_user

@router.get("", response_model=SettingsResponse)
@router.get("/", response_model=SettingsResponse)
def get_settings(db: Session = Depends(get_db), current_user: User = Depends(verify_admin)):
    settings_db = db.query(SystemSetting).all()
    result = {s.key: s.value for s in settings_db}
    return {"settings": result}

@router.put("", response_model=SettingsResponse)
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
@router.get("/blacklist/", response_model=List[BlacklistIPResponse])
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

@router.post("/test-teams")
async def test_teams_notification(current_user: User = Depends(verify_admin)):
    from app.core.notifications import send_teams_webhook
    await send_teams_webhook(
        title="Test Notification from Enterprise Printer Monitor",
        message="การเชื่อมต่อระหว่างระบบ Enterprise Printer Monitor และ MS Teams สำเร็จเรียบร้อยแล้ว!",
        severity="WARNING"
    )
    return {"status": "success", "message": "ส่งข้อความทดสอบไปยัง MS Teams เรียบร้อยแล้ว"}

import subprocess
from pathlib import Path

TUNNEL_URL_FILE = Path(r"d:\app\Printer-Monitor\runtime\tunnel_url.txt")

@router.get("/tunnel/status")
@router.get("/tunnel/status/")
def get_tunnel_status(current_user: User = Depends(verify_admin)):
    running = False
    try:
        res = subprocess.run(["tasklist", "/FI", "IMAGENAME eq cloudflared.exe"], capture_output=True, text=True)
        running = "cloudflared.exe" in res.stdout
    except Exception:
        pass

    url = None
    if TUNNEL_URL_FILE.exists():
        try:
            url = TUNNEL_URL_FILE.read_text(encoding="utf-8").strip()
        except Exception:
            pass

    return {"is_running": running, "url": url if running else None}

@router.post("/tunnel/toggle")
@router.post("/tunnel/toggle/")
def toggle_tunnel(current_user: User = Depends(verify_admin)):
    import re
    import threading
    base_dir = Path(r"d:\app\Printer-Monitor")
    cloudflared_exe = base_dir / "cloudflared.exe"

    # Check if currently running
    res = subprocess.run(["tasklist", "/FI", "IMAGENAME eq cloudflared.exe"], capture_output=True, text=True)
    is_running = "cloudflared.exe" in res.stdout

    if is_running:
        subprocess.run(["taskkill", "/F", "/IM", "cloudflared.exe"], capture_output=True)
        if TUNNEL_URL_FILE.exists():
            try:
                TUNNEL_URL_FILE.unlink()
            except Exception:
                pass
        return {"status": "stopped", "is_running": False, "url": None}
    else:
        if not cloudflared_exe.exists():
            raise HTTPException(status_code=404, detail="ไม่พบไฟล์ cloudflared.exe ในระบบ")

        TUNNEL_URL_FILE.parent.mkdir(parents=True, exist_ok=True)
        if TUNNEL_URL_FILE.exists():
            try:
                TUNNEL_URL_FILE.unlink()
            except Exception:
                pass

        cmd = [str(cloudflared_exe), "tunnel", "--url", "http://localhost:4173"]
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            creationflags=0x08000000
        )

        def read_output():
            for line in iter(proc.stdout.readline, ''):
                if not line:
                    break
                match = re.search(r'https://[a-zA-Z0-9\-]+\.trycloudflare\.com', line)
                if match:
                    found_url = match.group(0)
                    TUNNEL_URL_FILE.write_text(found_url, encoding="utf-8")
                    break

        threading.Thread(target=read_output, daemon=True).start()
        return {"status": "starting", "is_running": True, "url": None}

