# Enterprise Printer Monitoring System

A scalable, real-time printer monitoring system similar to Brother BRAdmin Professional 4, built with FastAPI, WebSockets, Python `pysnmp`, and React (Vite).

## Features
- **Auto Discovery**: CIDR Ping Sweep and SNMP detection.
- **Monitoring**: Background jobs polling SNMP status, supplies (toner/drum), and counters.
- **Real-time Alerts**: WebSockets immediately broadcast low toner warnings and offline statuses.
- **Enterprise Ready**: Groups management, Audit Logging, and Import/Export capabilities.

## Requirements
- Python 3.10+
- Node.js 18+
- Docker & Docker Compose (for Production Deployment)

## Quick Start (Development)

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Production Deployment (Docker)
You can deploy the entire stack using Docker Compose:
```bash
docker-compose up -d --build
```
This will start:
- Backend API on port `8000`
- Frontend UI (Nginx) on port `80`
- SQLite Database persisted in a Docker Volume
