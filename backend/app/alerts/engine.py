from sqlalchemy.orm import Session
from app.models.alert import Alert
from app.models.printer import Printer
from app.models.monitoring import PrinterSupplies
from app.websocket.manager import manager

async def evaluate_supply_alerts(db: Session, printer: Printer, supply: PrinterSupplies):
    if supply.maximum > 0:
        percentage = (supply.level / supply.maximum) * 100
        
        if percentage <= 10:
            severity = "CRITICAL"
            message = f"{supply.name} is critically low ({percentage:.1f}%)"
            await _create_or_update_alert(db, printer.id, "SUPPLY", severity, message)
        elif percentage <= 20:
            severity = "WARNING"
            message = f"{supply.name} is low ({percentage:.1f}%)"
            await _create_or_update_alert(db, printer.id, "SUPPLY", severity, message)
        else:
            await _resolve_alerts(db, printer.id, "SUPPLY")

async def evaluate_status_alerts(db: Session, printer: Printer):
    if printer.status in ["OFFLINE", "ERROR", "PAPER_JAM"]:
        severity = "CRITICAL" if printer.status == "OFFLINE" else "WARNING"
        message = f"Printer is {printer.status}"
        await _create_or_update_alert(db, printer.id, "STATUS", severity, message)
    else:
        await _resolve_alerts(db, printer.id, "STATUS")

async def _create_or_update_alert(db: Session, printer_id: int, alert_type: str, severity: str, message: str):
    existing = db.query(Alert).filter(
        Alert.printer_id == printer_id,
        Alert.alert_type == alert_type,
        Alert.is_resolved == False
    ).first()
    
    if not existing:
        new_alert = Alert(
            printer_id=printer_id,
            alert_type=alert_type,
            severity=severity,
            message=message
        )
        db.add(new_alert)
        db.commit()
        db.refresh(new_alert)
        await _broadcast_alert(new_alert)

async def _resolve_alerts(db: Session, printer_id: int, alert_type: str):
    alerts = db.query(Alert).filter(
        Alert.printer_id == printer_id,
        Alert.alert_type == alert_type,
        Alert.is_resolved == False
    ).all()
    
    for alert in alerts:
        alert.is_resolved = True
        
    if alerts:
        db.commit()
        # Broadcast resolution
        await manager.broadcast({
            "type": "ALERT_RESOLVED",
            "data": {
                "printer_id": printer_id,
                "alert_type": alert_type
            }
        })

async def _broadcast_alert(alert: Alert):
    await manager.broadcast({
        "type": "NEW_ALERT",
        "data": {
            "id": alert.id,
            "printer_id": alert.printer_id,
            "alert_type": alert.alert_type,
            "severity": alert.severity,
            "message": alert.message
        }
    })
