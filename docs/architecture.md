# System Architecture

## Overview
Printer-Monitor is a client-server web application for monitoring network printers via SNMP. 

## Tech Stack
**Frontend:** React (Vite), TailwindCSS, Recharts (for dashboards), React Router
**Backend:** FastAPI, SQLAlchemy (SQLite/PostgreSQL), PySNMP (for SNMP polling), WebSockets
**Deployment:** Docker Compose

## Core Components
- **API Server:** Provides REST endpoints for CRUD operations and WebSockets for real-time dashboard updates.
- **SNMP Poller:** A background scheduler (APScheduler) polls registered printers at regular intervals (default 5 mins) to fetch toner levels, paper status, and device info.
- **Database:** Relational schema storing Users, Printers, PrinterGroups, History, Alerts, and SystemSettings.

## Authentication
JWT-based authentication with Role-Based Access Control (Admin vs. Viewer).
