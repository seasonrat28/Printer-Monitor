import httpx
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.settings import SystemSetting

logger = logging.getLogger(__name__)

def get_db_setting(key: str, env_key: str, default: str = "") -> str:
    db = SessionLocal()
    try:
        setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if setting and setting.value:
            return setting.value
        # fallback to env
        env_val = getattr(settings, env_key, default)
        return str(env_val) if env_val else default
    except Exception as e:
        logger.error(f"Error reading setting {key}: {e}")
        return default
    finally:
        db.close()

import time
from app.core.logger import log_printer_event

LAST_EMAIL_ALERT_CACHE = {}
ALERT_COOLDOWN_SECONDS = 3600  # เว้นระยะการส่งอีเมลเตือนซ้ำ 1 ชั่วโมง

async def send_email_notify(subject: str, message: str, to_email: str = None, printer_ip: str = None, issue_type: str = "general"):
    """Send notification via SMTP Email with throttling (LINE removed)."""
    current_time = time.time()
    
    # 1. บันทึกประวัติลง Log File เสมอในทุกๆ เหตุการณ์
    if printer_ip:
        log_printer_event(printer_ip, "WARNING", message)
    
    # 2. ตรวจสอบกลไกป้องกันส่งซ้ำ (Cooldown)
    cache_key = f"{printer_ip}_{issue_type}" if printer_ip else None
    if cache_key and cache_key in LAST_EMAIL_ALERT_CACHE:
        time_since_last_alert = current_time - LAST_EMAIL_ALERT_CACHE[cache_key]
        if time_since_last_alert < ALERT_COOLDOWN_SECONDS:
            logger.info(f"📌 [Skip Email] {printer_ip} เพิ่งส่งเมลเตือนปัญหา {issue_type} ไป ข้ามเพื่อป้องกันเมลขยะ")
            return
            
    smtp_server = get_db_setting("smtpServer", "SMTP_SERVER")
    from_email = get_db_setting("smtpFrom", "SENDER_EMAIL")
    
    if not smtp_server or not from_email:
        return

    recipient = to_email or get_db_setting("smtpTo", "RECEIVER_EMAIL")
    if not recipient:
        return

    msg = MIMEMultipart()
    msg['From'] = from_email
    msg['To'] = recipient
    msg['Subject'] = subject

    msg.attach(MIMEText(message, 'plain'))

    try:
        port = int(get_db_setting("smtpPort", "SMTP_PORT", "587"))
        # Running synchronous smtplib in an async context isn't ideal but works for simple low-volume alerts
        server = smtplib.SMTP(smtp_server, port)
        server.starttls()
        
        user = get_db_setting("smtpUser", "SMTP_USER")
        pwd = get_db_setting("smtpPassword", "SMTP_PASSWORD")
        if user and pwd:
            server.login(user, pwd)
        
        server.send_message(msg)
        server.quit()
        
        if cache_key:
            LAST_EMAIL_ALERT_CACHE[cache_key] = current_time
            
        logger.info(f"📧 [Email Sent Success] แจ้งเตือนไปยังไอทีสำเร็จสำหรับ IP: {printer_ip or ''}")
    except Exception as e:
        logger.error(f"❌ [Email Error] ส่งเมลไม่ผ่าน: {e}")

def get_department_email(department: str) -> str:
    """Helper to get department specific email from config if implemented."""
    return get_db_setting("smtpTo", "RECEIVER_EMAIL")
