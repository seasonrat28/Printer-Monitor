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
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from xml.sax.saxutils import escape as xml_escape

router = APIRouter()

def _report_text(value) -> str:
    return xml_escape(str(value if value is not None else "N/A"))

def format_local_time(dt: datetime, fmt: str) -> str:
    if not dt:
        return ""
    # Assuming dt is naive UTC from the database
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone().strftime(fmt)

# ─────────────────────────────────────────────
# GET /reports/stats  — Aggregated Statistics
# ─────────────────────────────────────────────
@router.get("/stats")
def get_stats(db: Session = Depends(deps.get_db)):
    from app.models.printer import Printer as PrinterModel

    # Load all printers once
    printers = db.query(PrinterModel).all()
    total_printers = len(printers)
    status_map = {}
    for p in printers:
        status_map[p.status] = status_map.get(p.status, 0) + 1

    # Active alerts
    active_alerts   = db.query(func.count(Alert.id)).filter(Alert.is_resolved == False).scalar()
    critical_alerts = (
        db.query(func.count(Alert.id))
        .filter(Alert.is_resolved == False, Alert.severity == "CRITICAL")
        .scalar()
    )

    # Total pages printed — latest counter per printer (same logic as dashboard)
    subq = (
        db.query(
            PrinterCounters.printer_id,
            func.max(PrinterCounters.measured_at).label("max_ts")
        )
        .group_by(PrinterCounters.printer_id)
        .subquery()
    )
    latest_rows = (
        db.query(PrinterCounters)
        .join(subq, (PrinterCounters.printer_id == subq.c.printer_id) &
                    (PrinterCounters.measured_at == subq.c.max_ts))
        .all()
    )
    total_pages = sum(c.total_pages for c in latest_rows if c.total_pages is not None)

    # Average response time
    avg_response = db.query(func.avg(PrinterStatusHistory.response_time)).scalar()

    # Low toner — use toner_level column (consistent with dashboard)
    low_toner_count = sum(1 for p in printers if p.toner_level is not None and p.toner_level <= 20)

    return {
        "total_printers": total_printers,
        "online": status_map.get("ONLINE", 0),
        "offline": status_map.get("OFFLINE", 0),
        "warning": status_map.get("WARNING", 0),
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
async def export_excel(db: Session = Depends(deps.get_db)):
    # Export the latest committed snapshot. Use Reports > Sync Now when a
    # fresh network poll is needed; exporting must remain fast and reliable.
    db.expire_all()
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
                "Last Updated": format_local_time(p.last_seen, "%Y-%m-%d %H:%M") if p.last_seen else "",
                "Toner %": p.toner_level,
                "Drum %": p.drum_level,
                "Fuser %": p.fuser_level,
                "Laser %": p.laser_unit_level,
                "PF Kit MP %": p.pf_kit_mp_level,
                "PF Kit 1 %": p.pf_kit_1_level,
                "Total Pages": latest_counter.total_pages if latest_counter else 0,
            })
        df_printers = pd.DataFrame(printer_data)
        df_printers.to_excel(writer, index=False, sheet_name='Printers')

        # Sheet 2: Supplies / Toner Levels
        supply_data = []
        supplies = db.query(PrinterSupplies).all()
        for s in supplies:
            printer = db.query(Printer).filter(Printer.id == s.printer_id).first()
            pct = round((s.level / s.maximum) * 100, 1) if s.level is not None and s.maximum and s.maximum > 0 else None
            supply_data.append({
                "Printer IP": printer.ip_address if printer else "",
                "Supply": s.name,
                "Type": s.supply_type,
                "Level": s.level,
                "Maximum": s.maximum,
                "Percent %": pct,
                "Status": "CRITICAL" if pct and pct <= 10 else ("LOW" if pct and pct <= 20 else "OK"),
                "Updated": format_local_time(s.updated_at, "%Y-%m-%d %H:%M") if s.updated_at else "",
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
                "Created": format_local_time(a.created_at, "%Y-%m-%d %H:%M") if a.created_at else "",
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
async def export_pdf(db: Session = Depends(deps.get_db)):
    # Export the latest committed snapshot. Do not block file generation on a
    # full network sync of every printer.
    db.expire_all()
    printers = db.query(Printer).all()
    output = BytesIO()
    doc = SimpleDocTemplate(output, pagesize=landscape(A4), leftMargin=12*mm, rightMargin=12*mm, topMargin=15*mm, bottomMargin=12*mm)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle('Title', parent=styles['Title'], fontSize=18, textColor=colors.HexColor('#1e3a5f'))
    heading_style = ParagraphStyle('Heading2', parent=styles['Heading2'], fontSize=12, textColor=colors.HexColor('#1e3a5f'))
    small_style = ParagraphStyle('Small', parent=styles['Normal'], fontSize=8, textColor=colors.HexColor('#64748b'))

    story = []
    story.append(Paragraph("Paolo Kaset Printer Monitor — Report", title_style))
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", small_style))
    story.append(Spacer(1, 8*mm))

    # Printer Table
    story.append(Paragraph("Printer Inventory", heading_style))
    story.append(Spacer(1, 3*mm))

    header = ["IP Address", "Model", "Location", "Status", "Last Updated", "Toner %", "Drum %", "Fuser %", "Laser %", "PF MP %", "PF 1 %"]
    table_data = [header]
    for p in printers:
        table_data.append([
            p.ip_address,
            p.model or "N/A",
            p.location or "N/A",
            p.status,
            format_local_time(p.last_seen, "%d/%m/%Y %H:%M") if p.last_seen else "N/A",
            f"{p.toner_level}%" if p.toner_level is not None else "N/A",
            f"{p.drum_level}%" if p.drum_level is not None else "N/A",
            f"{p.fuser_level}%" if p.fuser_level is not None else "N/A",
            f"{p.laser_unit_level}%" if p.laser_unit_level is not None else "N/A",
            f"{p.pf_kit_mp_level}%" if p.pf_kit_mp_level is not None else "N/A",
            f"{p.pf_kit_1_level}%" if p.pf_kit_1_level is not None else "N/A",
        ])

    STATUS_BG = {
        "ONLINE":  colors.HexColor('#dcfce7'),
        "OFFLINE": colors.HexColor('#fee2e2'),
        "ERROR":   colors.HexColor('#fee2e2'),
        "WARNING": colors.HexColor('#fef9c3'),
        "UNKNOWN": colors.HexColor('#f1f5f9'),
    }

    col_widths = [28*mm, 48*mm, 45*mm, 23*mm, 32*mm, 15*mm, 15*mm, 15*mm, 15*mm, 15*mm, 15*mm]
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

# GET /reports/image - Printable SVG image of the same inventory report
@router.get("/image")
def export_image(db: Session = Depends(deps.get_db)):
    printers = db.query(Printer).all()
    row_height = 32
    header_height = 74
    width = 2200
    height = header_height + (len(printers) * row_height) + 80
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="#ffffff"/>',
        '<style>text{font-family:Arial,sans-serif;fill:#172b4d}.head{font-weight:700;fill:#ffffff}.small{font-size:15px}.body{font-size:16px}</style>',
        '<text x="32" y="38" font-size="26" font-weight="700">Enterprise Printer Monitor - Report</text>',
        f'<text x="32" y="62" class="small">Generated: {_report_text(datetime.now().strftime("%Y-%m-%d %H:%M"))}</text>',
        '<rect x="24" y="82" width="2152" height="36" fill="#1e3a5f"/>',
    ]
    columns = [(36, 'IP Address'), (210, 'Model'), (620, 'Location'), (1030, 'Status'), (1190, 'Last Updated'), (1430, 'Toner %'), (1540, 'Drum %'), (1650, 'Fuser %'), (1760, 'Laser %'), (1870, 'PF MP %'), (1980, 'PF 1 %')]
    column_lines = [24, 198, 608, 1018, 1178, 1418, 1528, 1638, 1748, 1858, 1968, 2152]
    for x, label in columns:
        parts.append(f'<text x="{x}" y="106" class="head small">{label}</text>')

    status_colors = {'ONLINE': '#dcfce7', 'WARNING': '#fef9c3', 'OFFLINE': '#fee2e2', 'ERROR': '#fee2e2'}
    for index, printer in enumerate(printers):
        y = header_height + index * row_height
        bg = '#ffffff' if index % 2 == 0 else '#f8fafc'
        parts.append(f'<rect x="24" y="{y}" width="2152" height="{row_height}" fill="{bg}" stroke="#cbd5e1"/>')
        status = printer.status or 'UNKNOWN'
        parts.append(f'<rect x="1030" y="{y}" width="145" height="{row_height}" fill="{status_colors.get(status, "#f1f5f9")}"/>')
        values = [
            (36, printer.ip_address), (210, printer.model), (620, printer.location),
            (1030, status), (1190, format_local_time(printer.last_seen, '%d/%m/%Y %H:%M') if printer.last_seen else 'N/A'),
            (1430, f'{printer.toner_level}%' if printer.toner_level is not None else 'N/A'),
            (1540, f'{printer.drum_level}%' if printer.drum_level is not None else 'N/A'),
            (1650, f'{printer.fuser_level}%' if printer.fuser_level is not None else 'N/A'),
            (1760, f'{printer.laser_unit_level}%' if printer.laser_unit_level is not None else 'N/A'),
            (1870, f'{printer.pf_kit_mp_level}%' if printer.pf_kit_mp_level is not None else 'N/A'),
            (1980, f'{printer.pf_kit_1_level}%' if printer.pf_kit_1_level is not None else 'N/A'),
        ]
        for x, value in values:
            parts.append(f'<text x="{x}" y="{y + 22}" class="body">{_report_text(value)}</text>')
        for x in column_lines:
            parts.append(f'<line x1="{x}" y1="{y}" x2="{x}" y2="{y + row_height}" stroke="#cbd5e1" stroke-width="1"/>')
    for x in column_lines:
        parts.append(f'<line x1="{x}" y1="82" x2="{x}" y2="{header_height + (len(printers) * row_height)}" stroke="#cbd5e1" stroke-width="1"/>')
    parts.append('</svg>')
    headers = {'Content-Disposition': f'attachment; filename="printer_monitor_{datetime.now().strftime("%Y%m%d")}.svg"'}
    return Response(content=''.join(parts), media_type='image/svg+xml', headers=headers)
