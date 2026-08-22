"""Database Service for Printer Management System.
Handles SQLite persistence for discovered printer devices and system/discovery event logs.
"""

import json
import os
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "printers.db")


def get_connection() -> sqlite3.Connection:
    """Create a database connection with row factory enabled and WAL mode."""
    conn = sqlite3.connect(DB_PATH, timeout=20.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    return conn


def init_db() -> None:
    """Initialize database tables and indexes."""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Printers table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS printers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ip_address TEXT UNIQUE NOT NULL,
                hostname TEXT DEFAULT '',
                mac_address TEXT DEFAULT '',
                manufacturer TEXT DEFAULT 'Unknown',
                model TEXT DEFAULT 'Standard Printer',
                serial_number TEXT DEFAULT 'N/A',
                device_name TEXT DEFAULT '',
                location TEXT DEFAULT '',
                status TEXT DEFAULT 'UNKNOWN',
                page_count INTEGER DEFAULT 0,
                toner_black INTEGER DEFAULT 0,
                drum_level INTEGER DEFAULT 0,
                firmware_version TEXT DEFAULT '',
                snmp_version TEXT DEFAULT 'v2c',
                web_url TEXT DEFAULT '',
                raw_data TEXT DEFAULT '{}',
                last_seen TEXT,
                created_at TEXT,
                updated_at TEXT
            );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_printers_ip ON printers(ip_address);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_printers_status ON printers(status);")

        # Logs table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                event_type TEXT NOT NULL,
                ip_address TEXT DEFAULT '',
                message TEXT NOT NULL,
                details TEXT DEFAULT ''
            );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_ip ON logs(ip_address);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_event ON logs(event_type);")

        conn.commit()


def row_to_dict(row: Optional[sqlite3.Row]) -> Optional[Dict[str, Any]]:
    """Convert an sqlite3.Row to a standard python dict with UI aliases."""
    if row is None:
        return None
    d = dict(row)
    if "raw_data" in d and isinstance(d["raw_data"], str):
        try:
            d["raw_data"] = json.loads(d["raw_data"])
        except Exception:
            d["raw_data"] = {}

    # Attach UI compatibility aliases
    d["ip"] = d.get("ip_address", "")
    d["name"] = d.get("device_name") or f"{d.get('manufacturer', '')} {d.get('model', '')}".strip() or "Printer"
    d["serial"] = d.get("serial_number", "N/A")
    d["toner"] = d.get("toner_black", 0)
    d["drum"] = d.get("drum_level", 0)
    d["pageCount"] = d.get("page_count", 0)
    return d


def upsert_printer(data: Dict[str, Any]) -> Dict[str, Any]:
    """Insert or update a printer device by IP address."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    ip = data.get("ip_address", "").strip()
    if not ip:
        raise ValueError("ip_address is required for printer record")

    raw_data_str = json.dumps(data.get("raw_data", {}), ensure_ascii=False) if isinstance(data.get("raw_data"), dict) else "{}"

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM printers WHERE ip_address = ?", (ip,))
        existing = cursor.fetchone()

        if existing:
            # Update existing
            cursor.execute("""
                UPDATE printers SET
                    hostname = COALESCE(NULLIF(?, ''), hostname),
                    mac_address = COALESCE(NULLIF(?, ''), mac_address),
                    manufacturer = COALESCE(NULLIF(?, ''), manufacturer),
                    model = COALESCE(NULLIF(?, ''), model),
                    serial_number = COALESCE(NULLIF(?, ''), serial_number),
                    device_name = COALESCE(NULLIF(?, ''), device_name),
                    location = COALESCE(NULLIF(?, ''), location),
                    status = COALESCE(NULLIF(?, ''), status),
                    page_count = CASE WHEN ? >= 0 THEN ? ELSE page_count END,
                    toner_black = CASE WHEN ? >= 0 THEN ? ELSE toner_black END,
                    drum_level = CASE WHEN ? >= 0 THEN ? ELSE drum_level END,
                    firmware_version = COALESCE(NULLIF(?, ''), firmware_version),
                    snmp_version = COALESCE(NULLIF(?, ''), snmp_version),
                    web_url = COALESCE(NULLIF(?, ''), web_url),
                    raw_data = ?,
                    last_seen = ?,
                    updated_at = ?
                WHERE ip_address = ?
            """, (
                data.get("hostname", ""),
                data.get("mac_address", ""),
                data.get("manufacturer", ""),
                data.get("model", ""),
                data.get("serial_number", ""),
                data.get("device_name", ""),
                data.get("location", ""),
                data.get("status", "UNKNOWN"),
                data.get("page_count", -1), data.get("page_count", -1),
                data.get("toner_black", -1), data.get("toner_black", -1),
                data.get("drum_level", -1), data.get("drum_level", -1),
                data.get("firmware_version", ""),
                data.get("snmp_version", "v2c"),
                data.get("web_url", f"http://{ip}"),
                raw_data_str,
                data.get("last_seen", now),
                now,
                ip
            ))
        else:
            # Insert new
            cursor.execute("""
                INSERT INTO printers (
                    ip_address, hostname, mac_address, manufacturer, model,
                    serial_number, device_name, location, status, page_count,
                    toner_black, drum_level, firmware_version, snmp_version,
                    web_url, raw_data, last_seen, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                ip,
                data.get("hostname", ""),
                data.get("mac_address", ""),
                data.get("manufacturer", "Unknown"),
                data.get("model", "Standard Printer"),
                data.get("serial_number", "N/A"),
                data.get("device_name", data.get("model", "Printer")),
                data.get("location", ""),
                data.get("status", "ONLINE"),
                max(0, data.get("page_count", 0)),
                max(0, data.get("toner_black", 0)),
                max(0, data.get("drum_level", 0)),
                data.get("firmware_version", ""),
                data.get("snmp_version", "v2c"),
                data.get("web_url", f"http://{ip}"),
                raw_data_str,
                data.get("last_seen", now),
                now,
                now
            ))
        conn.commit()

        cursor.execute("SELECT * FROM printers WHERE ip_address = ?", (ip,))
        row = cursor.fetchone()
        return row_to_dict(row)


def get_printer_by_id(printer_id: int) -> Optional[Dict[str, Any]]:
    """Retrieve a single printer by its ID."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM printers WHERE id = ?", (printer_id,))
        return row_to_dict(cursor.fetchone())


def get_printer_by_ip(ip: str) -> Optional[Dict[str, Any]]:
    """Retrieve a single printer by IP address."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM printers WHERE ip_address = ?", (ip.strip(),))
        return row_to_dict(cursor.fetchone())


def list_printers(
    search: Optional[str] = None,
    status: Optional[str] = None,
    sort_by: Optional[str] = None,
    order: str = "asc"
) -> List[Dict[str, Any]]:
    """List printers with optional search, status filter, and sorting."""
    query = "SELECT * FROM printers WHERE 1=1"
    params = []

    if search:
        s = f"%{search.strip()}%"
        query += " AND (ip_address LIKE ? OR hostname LIKE ? OR manufacturer LIKE ? OR model LIKE ? OR serial_number LIKE ? OR location LIKE ? OR device_name LIKE ?)"
        params.extend([s, s, s, s, s, s, s])

    if status and status.upper() != "ALL":
        query += " AND UPPER(status) = ?"
        params.append(status.strip().upper())

    # Sorting
    allowed_sort = {
        "id": "id",
        "ip": "ip_address",
        "ip_address": "ip_address",
        "name": "device_name",
        "model": "model",
        "status": "status",
        "page_count": "page_count",
        "toner": "toner_black",
        "last_seen": "last_seen",
        "updated_at": "updated_at"
    }
    col = allowed_sort.get(sort_by, "id")
    direction = "DESC" if order.lower() == "desc" else "ASC"
    query += f" ORDER BY {col} {direction}"

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [row_to_dict(r) for r in rows]


def update_printer_status(ip: str, status: str, updates: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    """Update printer status and optional SNMP metrics."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    updates = updates or {}

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM printers WHERE ip_address = ?", (ip,))
        curr = cursor.fetchone()
        if not curr:
            return None

        fields = ["status = ?", "updated_at = ?"]
        values = [status, now]

        if status in ("ONLINE", "WARNING", "ERROR"):
            fields.append("last_seen = ?")
            values.append(now)

        for k in ["page_count", "toner_black", "drum_level", "firmware_version", "hostname", "device_name", "location", "serial_number", "web_url"]:
            if k in updates and updates[k] is not None:
                fields.append(f"{k} = ?")
                values.append(updates[k])

        if "raw_data" in updates and isinstance(updates["raw_data"], dict):
            fields.append("raw_data = ?")
            values.append(json.dumps(updates["raw_data"], ensure_ascii=False))

        values.append(ip)
        sql = f"UPDATE printers SET {', '.join(fields)} WHERE ip_address = ?"
        cursor.execute(sql, values)
        conn.commit()

        cursor.execute("SELECT * FROM printers WHERE ip_address = ?", (ip,))
        return row_to_dict(cursor.fetchone())


def delete_printer(printer_id: int) -> bool:
    """Delete a printer device from database."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM printers WHERE id = ?", (printer_id,))
        conn.commit()
        return cursor.rowcount > 0


def log_event(
    event_type: str,
    ip_address: Optional[str] = None,
    message: str = "",
    details: Optional[Any] = None
) -> int:
    """Record an event into the logs table."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    det_str = json.dumps(details, ensure_ascii=False) if isinstance(details, (dict, list)) else (str(details) if details else "")
    ip = (ip_address or "").strip()

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO logs (timestamp, event_type, ip_address, message, details)
            VALUES (?, ?, ?, ?, ?)
        """, (now, event_type, ip, message, det_str))
        conn.commit()
        return cursor.lastrowid


def get_logs(
    ip_address: Optional[str] = None,
    event_type: Optional[str] = None,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """Retrieve event logs with optional filtering."""
    query = "SELECT * FROM logs WHERE 1=1"
    params = []

    if ip_address:
        query += " AND ip_address = ?"
        params.append(ip_address.strip())

    if event_type:
        query += " AND event_type = ?"
        params.append(event_type.strip())

    query += " ORDER BY id DESC LIMIT ?"
    params.append(max(1, min(limit, 500)))

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(r) for r in rows]


def get_stats() -> Dict[str, int]:
    """Calculate dashboard statistics."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN UPPER(status) = 'ONLINE' THEN 1 ELSE 0 END) AS online,
                SUM(CASE WHEN UPPER(status) = 'OFFLINE' THEN 1 ELSE 0 END) AS offline,
                SUM(CASE WHEN UPPER(status) = 'WARNING' THEN 1 ELSE 0 END) AS warning,
                SUM(CASE WHEN UPPER(status) = 'ERROR' THEN 1 ELSE 0 END) AS error,
                SUM(CASE WHEN UPPER(status) = 'UNKNOWN' THEN 1 ELSE 0 END) AS unknown
            FROM printers
        """)
        row = cursor.fetchone()
        if not row:
            return {"total": 0, "online": 0, "offline": 0, "warning": 0, "error": 0, "unknown": 0}
        return {
            "total": row["total"] or 0,
            "online": row["online"] or 0,
            "offline": row["offline"] or 0,
            "warning": row["warning"] or 0,
            "error": row["error"] or 0,
            "unknown": row["unknown"] or 0
        }


# Initialize tables when module is imported
init_db()
