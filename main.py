"""FastAPI Server for FUJIFILM Apeos & Network Printer Management System.
Provides full REST API and serves the interactive Web Dashboard cloned from IT Support PLK.
"""

import asyncio
import csv
import io
import json
import os
import sys
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# Ensure project root is in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from services.database import (
    delete_printer,
    get_connection,
    get_logs,
    get_printer_by_id,
    get_printer_by_ip,
    get_stats,
    init_db,
    list_printers,
    update_printer_status,
    upsert_printer,
)
from services.discovery import discovery_engine, get_local_subnets
from services.logger import logger
from services.polling import polling_worker
from services.printer import printer_service
from services.snmp import snmp_service


# ============================================================================
# In-Memory State & Cache
# ============================================================================

blacklist_ips = set()
favorite_ips = set()
app_settings = {
    "refresh_interval": 60,
    "tonerThreshold": 15,
    "drumThreshold": 15,
    "theme": "light"
}


# ============================================================================
# Application Lifecycle & App Instance
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    polling_worker.start()
    subnets = get_local_subnets()
    print("=" * 60)
    print(f"  FUJIFILM Printer Monitor Server Started (Apeos 4620 SZ)")
    print(f"  Local Subnets Detected: {', '.join(subnets)}")
    print(f"  Web Dashboard: http://localhost:3000")
    print("=" * 60)
    yield
    # Shutdown
    polling_worker.stop()
    print("[*] Printer Management Server Stopped")


app = FastAPI(
    title="FUJIFILM Apeos Printer Management API",
    description="REST API for network printer discovery, monitoring, and Apeos 4620 SZ management.",
    version="3.0.0",
    lifespan=lifespan
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static directory
STATIC_DIR = os.path.join(BASE_DIR, "static")
if not os.path.exists(STATIC_DIR):
    os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# ============================================================================
# Helper Functions for Cloned IT Web Format
# ============================================================================

def format_it_printer_response(printer: Dict[str, Any]) -> Dict[str, Any]:
    """Format printer record into the IT Support PLK object structure."""
    ip = printer.get("ip_address") or printer.get("ip", "")
    st = printer.get("status", "ONLINE").upper()
    status_str = "online" if st in ("ONLINE", "READY", "WARNING", "ERROR") else "offline"
    
    last_dt = printer.get("last_seen") or datetime.now().strftime("%d/%m/%Y %H:%M")
    
    device_status = None
    if st == "ERROR":
        device_status = {"level": "error", "message": "ระดับหมึกหรือดรัมมีปัญหา"}
    elif st == "WARNING":
        device_status = {"level": "warning", "message": "หมึกใกล้หมด"}
    elif status_str == "online":
        device_status = {"level": "ready", "message": "Ready"}

    return {
        "ip": ip,
        "status": status_str,
        "toner": printer.get("toner_black"),
        "drum": printer.get("drum_level"),
        "printer_name": printer.get("model") or printer.get("device_name") or "Apeos 4620 SZ",
        "printer_location": printer.get("location") or "",
        "serial_number": printer.get("serial_number") or "N/A",
        "last_updated": last_dt,
        "device_status": device_status
    }


# ============================================================================
# Cloned IT Support PLK Endpoints (/check_single, /check_range, /check_printer_db)
# ============================================================================

@app.post("/check_single")
async def check_single_it_endpoint(request: Request):
    """Check a single IP and return IT-formatted printer object."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    ip = body.get("ip", "").strip()
    if not ip:
        return {}

    # Probe device or lookup in DB
    dev = await printer_service.probe_device(ip)
    if dev:
        saved = upsert_printer(dev)
        return {ip: format_it_printer_response(saved)}
    else:
        existing = get_printer_by_ip(ip)
        if existing:
            return {ip: format_it_printer_response(existing)}
        return {
            ip: {
                "ip": ip,
                "status": "offline",
                "toner": None,
                "drum": None,
                "printer_name": "Unknown",
                "printer_location": "",
                "serial_number": "N/A",
                "last_updated": datetime.now().strftime("%d/%m/%Y %H:%M"),
                "device_status": None
            }
        }


@app.post("/check_range")
async def check_range_it_endpoint(request: Request):
    """Check an IP range and return dictionary of found printers."""
    try:
        body = await request.json()
    except Exception:
        body = {}

    base_ip = body.get("baseIp") or body.get("base", "")
    start = body.get("start", 1)
    end = body.get("end", 254)

    if not base_ip:
        return {}

    target = f"{base_ip}.{start}-{end}"
    results = await discovery_engine.run_discovery(network_or_target=target)

    res_dict = {}
    for p in results:
        res_dict[p["ip_address"]] = format_it_printer_response(p)
    return res_dict


@app.post("/check_printer_db")
async def check_printer_db_it_endpoint(request: Request):
    """Return all database printers formatted for the IT dashboard."""
    printers = list_printers()
    res_dict = {}
    for p in printers:
        res_dict[p["ip_address"]] = format_it_printer_response(p)
    return res_dict


# ============================================================================
# Cloned IT API Endpoints (/api/iplist, /api/logs, /api/settings, /api/favorites)
# ============================================================================

@app.get("/api/iplist")
async def get_iplist(mode: str = "printer_db"):
    """Return list of printer or blacklist IPs."""
    if mode == "printer_db":
        printers = list_printers()
        return [p["ip_address"] for p in printers]
    elif mode == "blacklist":
        return list(blacklist_ips)
    else:
        raise HTTPException(status_code=400, detail={"error": "Invalid mode"})


@app.post("/api/iplist")
async def add_to_iplist(request: Request):
    """Add IP or list of IPs to printer_db or blacklist."""
    try:
        body = await request.json()
    except Exception:
        body = {}

    mode = body.get("mode", "printer_db")
    ips_to_add = []
    if "ip" in body:
        ips_to_add.append(body["ip"].strip())
    elif "ips" in body and isinstance(body["ips"], list):
        ips_to_add.extend([i.strip() for i in body["ips"] if i.strip()])

    if mode == "printer_db":
        for ip in ips_to_add:
            upsert_printer({
                "ip_address": ip,
                "hostname": ip,
                "manufacturer": "FUJIFILM",
                "model": "Apeos 4620 SZ",
                "device_name": f"FUJIFILM Apeos 4620 SZ ({ip})",
                "status": "ONLINE"
            })
        return {"success": True, "message": f"เพิ่ม {len(ips_to_add)} IP ใน Database Printer สำเร็จ"}
    elif mode == "blacklist":
        for ip in ips_to_add:
            blacklist_ips.add(ip)
        return {"success": True, "message": f"เพิ่ม {len(ips_to_add)} IP ใน Blacklist สำเร็จ"}
    else:
        raise HTTPException(status_code=400, detail={"error": "Invalid mode"})


@app.delete("/api/iplist")
async def delete_from_iplist(request: Request):
    """Delete IP from printer_db or blacklist."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    ip = body.get("ip", "").strip()
    mode = body.get("mode", "printer_db")
    if not ip:
        raise HTTPException(status_code=400, detail="Missing ip")

    if mode == "printer_db":
        p = get_printer_by_ip(ip)
        if p:
            delete_printer(p["id"])
        return {"success": True, "message": f"ลบ {ip} จาก Database Printer แล้ว"}
    elif mode == "blacklist":
        if ip in blacklist_ips:
            blacklist_ips.remove(ip)
        return {"success": True, "message": f"ลบ {ip} จาก Blacklist แล้ว"}
    else:
        raise HTTPException(status_code=400, detail={"error": "Invalid mode"})


@app.post("/api/iplist/clear")
async def clear_iplist(request: Request):
    """Clear printer_db or blacklist."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    mode = body.get("mode", "printer_db")

    if mode == "printer_db":
        with get_connection() as conn:
            conn.cursor().execute("DELETE FROM printers;")
            conn.commit()
        return {"success": True, "message": "ล้างรายการ Database Printer ทั้งหมดแล้ว"}
    elif mode == "blacklist":
        blacklist_ips.clear()
        return {"success": True, "message": "ล้างรายการ Blacklist ทั้งหมดแล้ว"}
    else:
        raise HTTPException(status_code=400, detail={"error": "Invalid mode"})


@app.get("/api/logs")
async def get_all_logs(ip: Optional[str] = None, limit: int = 100):
    """Return historical supply logs in the IT web format."""
    # Build dictionary of ip -> { logs: [...] }
    result = {}
    printers = list_printers()

    with get_connection() as conn:
        cursor = conn.cursor()
        for p in printers:
            pip = p["ip_address"]
            if ip and pip != ip:
                continue

            # Query supply_history table if exists
            cursor.execute("""
                SELECT recorded_at AS datetime, toner, drum
                FROM supply_history
                WHERE ip_address = ?
                ORDER BY id ASC LIMIT 50
            """, (pip,))
            rows = cursor.fetchall()

            if rows:
                result[pip] = {"logs": [dict(r) for r in rows]}
            elif p.get("raw_data") and isinstance(p["raw_data"], dict) and "history_logs" in p["raw_data"]:
                result[pip] = {"logs": p["raw_data"]["history_logs"]}
            else:
                last_dt = p.get("last_seen") or datetime.now().strftime("%d/%m/%Y %H:%M")
                result[pip] = {
                    "logs": [
                        {"datetime": last_dt, "toner": p.get("toner_black", 0), "drum": p.get("drum_level", 0)}
                    ]
                }
    return result


@app.get("/api/settings")
async def get_app_settings():
    """Get app settings."""
    return app_settings


@app.post("/api/settings")
async def update_app_settings(request: Request):
    """Update app settings."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    app_settings.update(body)
    return {"success": True, "settings": app_settings}


@app.get("/api/favorites")
async def get_favorites_list():
    """Get favorites."""
    return list(favorite_ips)


@app.post("/api/favorites")
async def add_favorite_ip(request: Request):
    """Add/Toggle favorite IP."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    ip = body.get("ip") or body.get("id")
    if ip:
        if ip in favorite_ips:
            favorite_ips.remove(ip)
            return {"success": True, "message": f"ลบ {ip} จากรายการโปรดแล้ว", "isFavorite": False}
        else:
            favorite_ips.add(ip)
            return {"success": True, "message": f"เพิ่ม {ip} ในรายการโปรดแล้ว", "isFavorite": True}
    return {"success": False, "message": "Missing ip"}


@app.post("/api/favorites/clear")
async def clear_all_favorites():
    """Clear all favorites."""
    favorite_ips.clear()
    return {"success": True, "message": "ล้างรายการโปรดทั้งหมดแล้ว"}


# ============================================================================
# Standard REST Endpoints for Discovery, Monitoring & CLI
# ============================================================================

@app.get("/api/health")
async def get_health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "database": "connected",
        "polling_active": polling_worker.is_running,
        "local_subnets": get_local_subnets(),
        "stats": get_stats()
    }


@app.get("/api/stats")
async def get_dashboard_stats():
    """Get dashboard summary counts (Total, Online, Warning, Error, Offline)."""
    return get_stats()


@app.get("/api/printers")
async def get_all_printers(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("id"),
    order: Optional[str] = Query("asc")
):
    """Retrieve list of all discovered and saved printers."""
    printers = list_printers(search=search, status=status, sort_by=sort_by, order=order)
    for p in printers:
        p["isFavorite"] = p["ip_address"] in favorite_ips or str(p["id"]) in favorite_ips
    return printers


@app.get("/api/printers/{target}")
async def get_printer_detail(target: str):
    """Get full details of a specific printer by ID or IP."""
    printer = None
    if target.isdigit():
        printer = get_printer_by_id(int(target))
    if not printer:
        printer = get_printer_by_ip(target)

    if not printer:
        raise HTTPException(status_code=404, detail=f"Printer not found: {target}")

    printer["isFavorite"] = printer["ip_address"] in favorite_ips or str(printer["id"]) in favorite_ips
    return printer


@app.post("/api/printers/discover")
async def trigger_auto_discovery():
    """Trigger auto-discovery on the default local subnet."""
    if discovery_engine.is_scanning:
        return {"status": "scanning", "message": "Discovery is already running."}

    subnets = get_local_subnets()
    target_net = subnets[0] if subnets else "192.168.1.0/24"
    asyncio.create_task(discovery_engine.run_discovery(network_or_target=target_net))
    return {
        "status": "started",
        "network": target_net,
        "message": f"Discovery started on {target_net}"
    }


@app.post("/api/printers/{target}/refresh")
async def refresh_single_printer(target: str):
    """Force an immediate SNMP refresh for a specific printer."""
    printer = None
    if target.isdigit():
        printer = get_printer_by_id(int(target))
    if not printer:
        printer = get_printer_by_ip(target)

    ip = printer["ip_address"] if printer else target
    updated = await printer_service.probe_device(ip)
    if updated:
        saved = upsert_printer(updated)
        logger.refresh(ip, saved.get("status", "ONLINE"))
        return {"status": "success", "online": True, "printer": saved}
    else:
        saved = update_printer_status(ip, "OFFLINE")
        logger.refresh(ip, "OFFLINE")
        return {"status": "offline", "online": False, "printer": saved}


@app.get("/api/discovery/subnets")
async def get_detected_subnets():
    """Return local detected IPv4 subnets."""
    return {"subnets": get_local_subnets()}


@app.get("/api/discovery/status")
async def get_discovery_status():
    """Get active discovery scan progress."""
    return discovery_engine.scan_status


@app.post("/api/discovery/cancel")
async def cancel_discovery():
    """Cancel the active discovery scan."""
    cancelled = discovery_engine.cancel()
    return {"status": "cancelled" if cancelled else "not_scanning"}


@app.get("/api/export")
async def export_data(format: str = Query("json")):
    """Export all printer records as CSV or JSON."""
    printers = list_printers()

    if format.lower() == "csv":
        output = io.StringIO()
        fieldnames = [
            "id", "ip_address", "hostname", "mac_address", "manufacturer", "model",
            "serial_number", "device_name", "location", "status", "page_count",
            "toner_black", "drum_level", "firmware_version", "web_url", "last_seen"
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for p in printers:
            writer.writerow(p)

        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=printers_export.csv"}
        )

    return JSONResponse(content=printers)


# ============================================================================
# Page Routes (Dashboard & Setting)
# ============================================================================

@app.get("/")
async def serve_index():
    """Serve Main Dashboard."""
    index_path = os.path.join(BASE_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Printer Monitor is running."}


@app.get("/setting")
@app.get("/settings")
async def serve_setting():
    """Serve Settings Page."""
    setting_path = os.path.join(BASE_DIR, "setting.html")
    if os.path.exists(setting_path):
        return FileResponse(setting_path)
    return {"message": "setting.html not found."}


# ============================================================================
# Direct execution entry point
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=3000, reload=False, log_level="info")
