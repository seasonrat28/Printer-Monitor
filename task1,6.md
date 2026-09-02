# Task Checklist — Phase 1 to Phase 6

> Enterprise Printer Monitoring System
> อัปเดตล่าสุด: 2026-09-03

---

## ✅ Phase 1: Backend Foundation

- [X] สร้าง FastAPI project structure (`backend/app/`)
- [X] ตั้งค่า SQLAlchemy + SQLite (`db/session.py`)
- [X] สร้าง Base model (`models/base.py`)
- [X] สร้าง `Printer` model (`models/printer.py`)
- [X] สร้าง `PrinterStatusHistory`, `PrinterSupplies`, `PrinterCounters` (`models/monitoring.py`)
- [X] สร้าง `Alert` model (`models/alert.py`)
- [X] สร้าง Pydantic schemas (`schemas/printer.py`)
- [X] สร้าง CRUD API endpoints (`api/endpoints/printers.py`)
  - [X] `GET /api/v1/printers` — list all
  - [X] `POST /api/v1/printers` — add printer
  - [X] `GET /api/v1/printers/{id}` — get one
  - [X] `DELETE /api/v1/printers/{id}` — delete
- [X] `app/main.py` register all models + routers

---

## ✅ Phase 2: SNMP Engine

- [X] ออกแบบ `SNMPAdapter` interface แบบ modular
- [X] สร้าง `StandardSNMPAdapter` (`snmp/standard.py`)
  - [X] `get_system_info()` — sysDescr, sysName
  - [X] `get_printer_status()` — hrPrinterStatus, hrPrinterDetectedErrorState
  - [X] `get_supplies()` — loop ตาราง supplies (toner, drum)
  - [X] `get_counters()` — total page count
- [X] รองรับ SNMP v1 / v2c

---

## ✅ Phase 3: Auto Discovery

- [X] สร้าง `scanner.py` (`discovery/scanner.py`)
  - [X] `scan_network(cidr)` — Ping Sweep ด้วย `aioping`
  - [X] `_snmp_probe(ip)` — กรองเฉพาะ printer จาก SNMP response
- [X] สร้าง API endpoint (`api/endpoints/discovery.py`)
  - [X] `POST /api/v1/discovery/scan` — รับ CIDR, return discovered printers

---

## ✅ Phase 4: Real-time Monitoring & Alerts

- [X] ตั้งค่า APScheduler (`monitoring/scheduler.py`)
- [X] สร้าง background tasks (`monitoring/tasks.py`)
  - [X] `poll_printer_status()` — ทุก 60 วินาที
  - [X] `poll_printer_supplies()` — ทุก 5 นาที
  - [X] `poll_printer_counters()` — ทุก 15 นาที
- [X] สร้าง Alert Engine (`alerts/engine.py`)
  - [X] ตรวจจับ supply < 10% → CRITICAL
  - [X] ตรวจจับ supply < 20% → WARNING
  - [X] ตรวจจับ printer offline → CRITICAL
- [X] สร้าง WebSocket Manager (`websocket/manager.py`)
  - [X] broadcast `STATUS_UPDATE`
  - [X] broadcast `SUPPLY_UPDATE`
  - [X] broadcast `ALERT_NEW`
- [X] Frontend: `WebSocketContext.tsx` — Global WS state
- [X] Frontend: `Dashboard.tsx` — KPI Cards + Recharts Pie Chart
- [X] Frontend: `PrintersList.tsx` — Real-time status table

---

## ✅ Phase 5: Enterprise Features

- [X] สร้าง `PrinterGroup` model (`models/group.py`)
  - [X] Many-to-many relationship กับ `Printer`
- [X] สร้าง `AuditLog` model (`models/audit.py`)
- [X] CSV Export: `GET /api/v1/printers/export/csv`
  - [X] บันทึก AuditLog ทุกครั้งที่ export
- [X] CSV Import: `POST /api/v1/printers/import/csv`
  - [X] Skip IP ที่มีอยู่แล้ว (no duplicate)
  - [X] บันทึก AuditLog พร้อมจำนวนที่ import

---

## ✅ Phase 6: Production & Docker

- [X] สร้าง `backend/Dockerfile`
- [X] สร้าง `frontend/Dockerfile` (multi-stage + Nginx)
- [X] สร้าง `docker-compose.yml` (backend + frontend + volume)
- [X] เขียน `README.md` คู่มือการใช้งาน
