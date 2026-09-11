import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.printer import Printer

db = SessionLocal()
printers = db.query(Printer).all()
for p in printers:
    print(f"ID: {p.id}, IP: {p.ip_address}, Model: {p.model}, SNMP: {p.snmp_enabled}, Scraper: {p.scraper_type}")
