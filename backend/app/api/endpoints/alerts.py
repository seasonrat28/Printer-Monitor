from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.api import deps
from app.models.alert import Alert
from app.models.printer import Printer
from app.schemas.alert import AlertResponse, AlertUpdate

router = APIRouter()

@router.get("/", response_model=List[AlertResponse])
def get_alerts(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    is_resolved: Optional[bool] = None
):
    """
    Retrieve alerts.
    """
    query = db.query(Alert).join(Printer)
    
    if is_resolved is not None:
        query = query.filter(Alert.is_resolved == is_resolved)
        
    alerts = query.order_by(desc(Alert.created_at)).offset(skip).limit(limit).all()
    
    # Manually attach printer info for the response since Pydantic might need it flattened
    result = []
    for alert in alerts:
        alert_dict = {
            "id": alert.id,
            "printer_id": alert.printer_id,
            "alert_type": alert.alert_type,
            "severity": alert.severity,
            "message": alert.message,
            "is_resolved": alert.is_resolved,
            "created_at": alert.created_at,
            "resolved_at": alert.resolved_at,
            "printer_hostname": alert.printer.hostname,
            "printer_ip": alert.printer.ip_address,
            "printer_location": alert.printer.location
        }
        result.append(alert_dict)
        
    return result

@router.put("/{alert_id}/resolve", response_model=AlertResponse)
async def resolve_alert(
    alert_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    Mark an alert as resolved manually.
    """
    from datetime import datetime
    from app.websocket.manager import manager
    
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    if alert.is_resolved:
        raise HTTPException(status_code=400, detail="Alert is already resolved")
        
    alert.is_resolved = True
    alert.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(alert)
    
    # Broadcast resolution to connected clients
    await manager.broadcast({
        "type": "ALERT_RESOLVED",
        "data": {
            "id": alert.id,
            "printer_id": alert.printer_id,
            "alert_type": alert.alert_type
        }
    })
    
    return {
        "id": alert.id,
        "printer_id": alert.printer_id,
        "alert_type": alert.alert_type,
        "severity": alert.severity,
        "message": alert.message,
        "is_resolved": alert.is_resolved,
        "created_at": alert.created_at,
        "resolved_at": alert.resolved_at,
        "printer_hostname": alert.printer.hostname if alert.printer else None,
        "printer_ip": alert.printer.ip_address if alert.printer else None,
        "printer_location": alert.printer.location if alert.printer else None
    }

@router.delete("/resolved")
def clear_resolved_alerts(
    db: Session = Depends(deps.get_db)
):
    """
    Delete all resolved alerts to clean up database.
    """
    deleted_count = db.query(Alert).filter(Alert.is_resolved == True).delete()
    db.commit()
    return {"message": f"Deleted {deleted_count} resolved alerts"}
