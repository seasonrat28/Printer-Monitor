import httpx
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

async def send_line_notify(message: str):
    """Send notification to LINE Notify."""
    if not settings.LINE_NOTIFY_TOKEN:
        return

    url = "https://notify-api.line.me/api/notify"
    headers = {
        "Authorization": f"Bearer {settings.LINE_NOTIFY_TOKEN}"
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

async def send_email_notify(subject: str, message: str, to_email: str = None):
    """Send notification via SMTP Email."""
    if not settings.SMTP_SERVER or not settings.SMTP_FROM_EMAIL:
        return

    recipient = to_email or settings.SMTP_TO_EMAIL
    if not recipient:
        return

    msg = MIMEMultipart()
    msg['From'] = settings.SMTP_FROM_EMAIL
    msg['To'] = recipient
    msg['Subject'] = subject

    msg.attach(MIMEText(message, 'plain'))

    try:
        # Running synchronous smtplib in an async context isn't ideal but works for simple low-volume alerts
        server = smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT)
        server.starttls()
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        
        server.send_message(msg)
        server.quit()
        logger.info(f"Email sent successfully to {recipient}")
    except Exception as e:
        logger.error(f"Error sending email: {e}")

def get_department_email(department: str) -> str:
    """Helper to get department specific email from config if implemented."""
    # The user can customize this logic later to return different emails per department
    # e.g., mapping = {"IT": "it@domain.com", "HR": "hr@domain.com"}
    return settings.SMTP_TO_EMAIL
