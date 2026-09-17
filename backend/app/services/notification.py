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

async def send_line_notify(message: str):
    """Send notification to LINE Notify."""
    token = get_db_setting("lineToken", "LINE_NOTIFY_TOKEN")
    if not token:
        return

    url = "https://notify-api.line.me/api/notify"
    headers = {
        "Authorization": f"Bearer {token}"
    }
    data = {"message": message}
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, data=data, timeout=5.0)
            if response.status_code != 200:
                logger.error(f"LINE Notify failed: {response.text}")
            else:
                logger.info("LINE Notify sent successfully")
    except Exception as e:
        logger.error(f"Error sending LINE Notify: {e}")

import time
LAST_EMAIL_ALERT_CACHE = {}
ALERT_COOLDOWN_SECONDS = 3600  # เว้นระยะการส่งอีเมลเตือนซ้ำ 1 ชั่วโมง

async def send_email_notify(subject: str, message: str, to_email: str = None, printer_ip: str = None):
    """Send notification via SMTP Email with throttling."""
    current_time = time.time()
    
    # 1. ตรวจสอบกลไกป้องกันส่งซ้ำ (Cooldown)
    if printer_ip and printer_ip in LAST_EMAIL_ALERT_CACHE:
        time_since_last_alert = current_time - LAST_EMAIL_ALERT_CACHE[printer_ip]
        if time_since_last_alert < ALERT_COOLDOWN_SECONDS:
            logger.info(f"📌 [Skip Email] {printer_ip} เพิ่งส่งเมลเตือนไป ข้ามเพื่อป้องกันเมลขยะ")
            return
            
    smtp_server = get_db_setting("smtpServer", "SMTP_SERVER")
    from_email = get_db_setting("smtpFrom", "SMTP_FROM_EMAIL")
    
    if not smtp_server or not from_email:
        return

    recipient = to_email or get_db_setting("smtpTo", "SMTP_TO_EMAIL")
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
        
        if printer_ip:
            LAST_EMAIL_ALERT_CACHE[printer_ip] = current_time
            
        logger.info(f"📧 [Email Sent] ส่งอีเมลแจ้งเตือนเครื่องพิมพ์ {printer_ip or ''} สำเร็จไปยัง {recipient}")
    except Exception as e:
        logger.error(f"❌ [Email Error] ไม่สามารถส่งอีเมลแจ้งเตือนได้: {e}")

def get_department_email(department: str) -> str:
    """Helper to get department specific email from config if implemented."""
    return get_db_setting("smtpTo", "SMTP_TO_EMAIL")
