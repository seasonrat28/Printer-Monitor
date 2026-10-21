import httpx
import smtplib
import asyncio
from email.message import EmailMessage
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)



async def send_teams_webhook(
    title: str,
    message: str,
    severity: str = "WARNING",
    printer_name: str = "",
    printer_ip: str = "",
    location: str = "",
    created_at: str = ""
):
    from app.services.notification import get_db_setting
    webhook_url = get_db_setting("teamsWebhook", "TEAMS_WEBHOOK_URL")
    if not webhook_url:
        return
    
    is_crit = severity.upper() == "CRITICAL"
    badge_color = "Attention" if is_crit else "Warning"
    icon = "❌" if is_crit else "⚠️"
    
    p_name = printer_name or "-"
    p_ip = printer_ip or "-"
    p_loc = location or "-"
    p_time = created_at or "-"

    adaptive_card = {
        "type": "AdaptiveCard",
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.4",
        "title": title,
        "text": message,
        "severity": severity,
        "summary": title,
        "printer_name": p_name,
        "printer_ip": p_ip,
        "location": p_loc,
        "created_at": p_time,
        "body": [
            {
                "type": "Container",
                "items": [
                    {
                        "type": "TextBlock",
                        "text": f"{icon} {title}",
                        "weight": "Bolder",
                        "size": "Medium",
                        "color": badge_color,
                        "wrap": True
                    },
                    {
                        "type": "TextBlock",
                        "text": f"🖨️ {p_name} ({p_ip})",
                        "weight": "Bolder",
                        "size": "Default",
                        "spacing": "Small",
                        "wrap": True
                    },
                    {
                        "type": "TextBlock",
                        "text": f"📍 {p_loc}",
                        "size": "Small",
                        "isSubtle": True,
                        "spacing": "None",
                        "wrap": True
                    },
                    {
                        "type": "TextBlock",
                        "text": f"🕒 {p_time}",
                        "size": "Small",
                        "isSubtle": True,
                        "spacing": "None",
                        "wrap": True
                    }
                ]
            }
        ]
    }

    try:
        print(f"[Teams Webhook] Sending alert to Teams: {title} ({p_ip})...", flush=True)
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Send the Adaptive Card directly
            res = await client.post(webhook_url, json=adaptive_card)
            print(f"[Teams Webhook] Result: {res.status_code}", flush=True)
            logger.info(f"Teams webhook response: {res.status_code}")
    except Exception as e:
        print(f"[Teams Webhook] Error sending: {e}", flush=True)
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

async def dispatch_alert(
    title: str,
    message: str,
    severity: str = "WARNING",
    printer_name: str = "",
    printer_ip: str = "",
    location: str = "",
    created_at: str = ""
):
    await asyncio.gather(
        send_teams_webhook(
            title=title,
            message=message,
            severity=severity,
            printer_name=printer_name,
            printer_ip=printer_ip,
            location=location,
            created_at=created_at
        ),
        send_email(title, message)
    )
