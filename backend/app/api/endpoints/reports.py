from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.api import deps
from app.models.printer import Printer
from app.models.monitoring import PrinterSupplies, PrinterCounters, PrinterStatusHistory
from app.models.alert import Alert
import pandas as pd
from io import BytesIO
from datetime import datetime, timezone
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

router = APIRouter()

# ─────────────────────────────────────────────
# GET /reports/stats  — Aggregated Statistics
# ─────────────────────────────────────────────
@router.get("/stats")
def get_stats(db: Session = Depends(deps.get_db)):
    total_printers = db.query(func.count(Printer.id)).scalar()

    status_counts = (
        db.query(Printer.status, func.count(Printer.id))
        .group_by(Printer.status)
        .all()
    )
    status_map = {s: c for s, c in status_counts}

    # Active alerts
    active_alerts = db.query(func.count(Alert.id)).filter(Alert.is_resolved == False).scalar()
    critical_alerts = (
        db.query(func.count(Alert.id))
        .filter(Alert.is_resolved == False, Alert.severity == "CRITICAL")
        .scalar()
    )

    # Total pages printed (sum of latest counters per printer)
    total_pages = db.query(func.sum(PrinterCounters.total_pages)).scalar() or 0

    # Average response time
    avg_response = db.query(func.avg(PrinterStatusHistory.response_time)).scalar()

    # Printers with low toner (< 20%)
    low_toner_count = 0
    supplies = db.query(PrinterSupplies).filter(PrinterSupplies.supply_type == "toner").all()
    for s in supplies:
        if s.maximum and s.maximum > 0:
            pct = (s.level / s.maximum) * 100
            if pct < 20:
                low_toner_count += 1

    return {
        "total_printers": total_printers,
        "online": status_map.get("ONLINE", 0),
        "offline": status_map.get("OFFLINE", 0),
        "error": status_map.get("ERROR", 0),
        "unknown": status_map.get("UNKNOWN", 0),
        "active_alerts": active_alerts,
        "critical_alerts": critical_alerts,
        "total_pages_printed": total_pages,
        "avg_response_ms": round(avg_response, 2) if avg_response else None,
        "low_toner_printers": low_toner_count,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

# ─────────────────────────────────────────────
# GET /reports/excel  — Full Excel Export
# ─────────────────────────────────────────────
@router.get("/excel")
def export_excel(db: Session = Depends(deps.get_db)):
    printers = db.query(Printer).all()
    output = BytesIO()

    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        # Sheet 1: Printer Summary
        printer_data = []
        for p in printers:
            latest_counter = (
                db.query(PrinterCounters)
                .filter(PrinterCounters.printer_id == p.id)
                .order_by(PrinterCounters.measured_at.desc())
                .first()
            )
            printer_data.append({
                "IP Address": p.ip_address,
                "Hostname": p.hostname or "",
                "Model": p.model or "",
                "Manufacturer": p.manufacturer or "",
                "Location": p.location or "",
                "Department": p.department or "",
                "Floor": p.floor or "",
                "Status": p.status,
                "Last Seen": p.last_seen.strftime("%Y-%m-%d %H:%M") if p.last_seen else "",
                "Total Pages": latest_counter.total_pages if latest_counter else 0,
            })
        df_printers = pd.DataFrame(printer_data)
        df_printers.to_excel(writer, index=False, sheet_name='Printers')

        # Sheet 2: Supplies / Toner Levels
        supply_data = []
        supplies = db.query(PrinterSupplies).all()
        for s in supplies:
            printer = db.query(Printer).filter(Printer.id == s.printer_id).first()
            pct = round((s.level / s.maximum) * 100, 1) if s.maximum and s.maximum > 0 else None
            supply_data.append({
                "Printer IP": printer.ip_address if printer else "",
                "Supply": s.name,
                "Type": s.supply_type,
                "Level": s.level,
                "Maximum": s.maximum,
                "Percent %": pct,
                "Status": "CRITICAL" if pct and pct <= 10 else ("LOW" if pct and pct <= 20 else "OK"),
                "Updated": s.updated_at.strftime("%Y-%m-%d %H:%M") if s.updated_at else "",
            })
        df_supplies = pd.DataFrame(supply_data)
        df_supplies.to_excel(writer, index=False, sheet_name='Supplies')

        # Sheet 3: Active Alerts
        alert_data = []
        alerts = db.query(Alert).filter(Alert.is_resolved == False).all()
        for a in alerts:
            printer = db.query(Printer).filter(Printer.id == a.printer_id).first()
            alert_data.append({
                "Printer IP": printer.ip_address if printer else "",
                "Type": a.alert_type,
                "Severity": a.severity,
                "Message": a.message,
                "Created": a.created_at.strftime("%Y-%m-%d %H:%M") if a.created_at else "",
            })
        df_alerts = pd.DataFrame(alert_data)
        df_alerts.to_excel(writer, index=False, sheet_name='Active Alerts')

    headers = {
        'Content-Disposition': f'attachment; filename="printer_monitor_report_{datetime.now().strftime("%Y%m%d")}.xlsx"'
    }
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )

# ─────────────────────────────────────────────
# GET /reports/pdf  — Formatted PDF Export
# ─────────────────────────────────────────────
@router.get("/pdf")
def export_pdf(db: Session = Depends(deps.get_db)):
    printers = db.query(Printer).all()
    output = BytesIO()
    doc = SimpleDocTemplate(output, pagesize=A4, leftMargin=15*mm, rightMargin=15*mm, topMargin=20*mm, bottomMargin=15*mm)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle('Title', parent=styles['Title'], fontSize=18, textColor=colors.HexColor('#1e3a5f'))
    heading_style = ParagraphStyle('Heading2', parent=styles['Heading2'], fontSize=12, textColor=colors.HexColor('#1e3a5f'))
    small_style = ParagraphStyle('Small', parent=styles['Normal'], fontSize=8, textColor=colors.HexColor('#64748b'))

    story = []
    story.append(Paragraph("Enterprise Printer Monitor — Report", title_style))
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", small_style))
    story.append(Spacer(1, 8*mm))

    # Printer Table
    story.append(Paragraph("Printer Inventory", heading_style))
    story.append(Spacer(1, 3*mm))

    header = ["IP Address", "Model", "Location", "Status", "Last Seen"]
    table_data = [header]
    for p in printers:
        table_data.append([
            p.ip_address,
            p.model or "N/A",
            p.location or "N/A",
            p.status,
            p.last_seen.strftime("%d/%m/%Y %H:%M") if p.last_seen else "N/A",
        ])

    STATUS_BG = {
        "ONLINE":  colors.HexColor('#dcfce7'),
        "OFFLINE": colors.HexColor('#fee2e2'),
        "ERROR":   colors.HexColor('#fee2e2'),
        "WARNING": colors.HexColor('#fef9c3'),
        "UNKNOWN": colors.HexColor('#f1f5f9'),
    }

    col_widths = [38*mm, 60*mm, 40*mm, 25*mm, 35*mm]
    t = Table(table_data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a5f')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#cbd5e1')),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]
    # Color status column per row
    for i, p in enumerate(printers, start=1):
        bg = STATUS_BG.get(p.status, colors.white)
        style_cmds.append(('BACKGROUND', (3, i), (3, i), bg))

    t.setStyle(TableStyle(style_cmds))
    story.append(t)
    story.append(Spacer(1, 8*mm))

    # Active Alerts Section
    alerts = db.query(Alert).filter(Alert.is_resolved == False).all()
    story.append(Paragraph(f"Active Alerts ({len(alerts)})", heading_style))
    story.append(Spacer(1, 3*mm))

    if alerts:
        alert_header = ["Printer IP", "Type", "Severity", "Message"]
        alert_data = [alert_header]
        for a in alerts:
            printer = db.query(Printer).filter(Printer.id == a.printer_id).first()
            alert_data.append([
                printer.ip_address if printer else "N/A",
                a.alert_type,
                a.severity,
                a.message[:60] + "..." if len(a.message) > 60 else a.message,
            ])
        at = Table(alert_data, colWidths=[38*mm, 30*mm, 25*mm, 95*mm], repeatRows=1)
        at.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7f1d1d')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#fca5a5')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#fff1f2'), colors.white]),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        story.append(at)
    else:
        story.append(Paragraph("✅ No active alerts at time of report.", styles['Normal']))

    doc.build(story)

    headers = {
        'Content-Disposition': f'attachment; filename="printer_monitor_{datetime.now().strftime("%Y%m%d")}.pdf"'
    }
    return Response(content=output.getvalue(), media_type="application/pdf", headers=headers)
