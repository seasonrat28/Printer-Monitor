import httpx
import smtplib
import asyncio
from email.message import EmailMessage
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)



async def send_teams_webhook(title: str, message: str):
    if not settings.TEAMS_WEBHOOK_URL:
        return
    try:
        url = settings.TEAMS_WEBHOOK_URL
        payload = {
            "@type": "MessageCard",
            "@context": "http://schema.org/extensions",
            "themeColor": "0076D7",
            "summary": title,
            "sections": [{
                "activityTitle": title,
                "text": message
            }]
        }
        async with httpx.AsyncClient() as client:
            await client.post(url, json=payload)
    except Exception as e:
        logger.error(f"Failed to send Teams webhook: {e}")

def send_email_sync(subject: str, message: str):
    if not settings.SMTP_SERVER or not settings.SENDER_EMAIL or not settings.RECEIVER_EMAIL:
        return
    try:
        msg = EmailMessage()
        msg.set_content(message)
        msg['Subject'] = subject
        msg['From'] = settings.SENDER_EMAIL
        msg['To'] = settings.RECEIVER_EMAIL

        with smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT) as server:
            server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
    except Exception as e:
        logger.error(f"Failed to send email: {e}")

async def send_email(subject: str, message: str):
    await asyncio.to_thread(send_email_sync, subject, message)

async def dispatch_alert(title: str, message: str):
    await asyncio.gather(
        send_teams_webhook(title, message),
        send_email(title, message)
    )
