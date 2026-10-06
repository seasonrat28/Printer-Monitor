"""Update password for printer 10.119.34.163 in DB"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from app.db.session import SessionLocal
from app.models.printer import Printer

db = SessionLocal()
p = db.query(Printer).filter(Printer.ip_address == "10.119.34.163").first()
if p:
    old_pwd = p.snmp_community
    p.snmp_community = "Admin@5218"
    db.commit()
    db.refresh(p)
    print(f"[OK] Updated 10.119.34.163 password: '{old_pwd}' -> '{p.snmp_community}'")
else:
    print("[ERROR] Printer 10.119.34.163 not found in DB")
db.close()
