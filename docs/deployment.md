# Deployment Guide

## Prerequisites
- Docker & Docker Compose
- Network access to printers via SNMP (UDP Port 161)

## Running with Docker Compose

```bash
cd Printer-Monitor
docker-compose up -d
```

## Environment Variables
Create a `.env` file in the root directory:
```env
SECRET_KEY=super_secret_key
DATABASE_URL=sqlite:///./data/printer_monitor.db
LINE_NOTIFY_TOKEN=your_token
```

## Updating
```bash
git pull
docker-compose build
docker-compose up -d
```
