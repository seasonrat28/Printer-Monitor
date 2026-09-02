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
    allow_origins=["*"], # For development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "Enterprise Printer Monitor API is running"}

from app.api.api import api_router
from app.db.session import engine
from app.models.base import Base
from app.models.user import User
from app.models.printer import Printer
from app.models.monitoring import PrinterStatusHistory, PrinterSupplies, PrinterCounters
from app.models.alert import Alert
from app.models.group import PrinterGroup
from app.models.audit import AuditLog
from app.monitoring.scheduler import start_scheduler

# Create tables for dev
Base.metadata.create_all(bind=engine)

@app.on_event("startup")
async def startup_event():
    start_scheduler()

app.include_router(api_router, prefix="/api/v1")

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
