from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(
    title="Enterprise Printer Monitoring API",
    description="Backend API for managing and monitoring network printers",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"], # More strict origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "Enterprise Printer Monitor API is running"}

from app.api.api import api_router
from app.db.session import engine, SessionLocal
from app.models.base import Base
from app.models.user import User
from app.models.printer import Printer
from app.models.monitoring import PrinterStatusHistory, PrinterSupplies, PrinterCounters
from app.models.alert import Alert
from app.models.group import PrinterGroup
from app.models.audit import AuditLog
from app.models.settings import SystemSetting
from app.monitoring.scheduler import start_scheduler
from app.db.init_db import init_db

# Create tables for dev
Base.metadata.create_all(bind=engine)

@app.on_event("startup")
async def startup_event():
    # Initialize DB with default user
    db = SessionLocal()
    try:
        init_db(db)
    finally:
        db.close()
    start_scheduler()

app.include_router(api_router, prefix="/api/v1")

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
