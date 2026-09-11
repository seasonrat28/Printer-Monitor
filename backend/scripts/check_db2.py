import sys
import os
from pathlib import Path

# Add backend dir to sys.path
sys.path.append(str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.printer import Printer

db = SessionLocal()
printer = db.query(Printer).filter(Printer.ip_address == "10.119.34.20").first()
print("10.119.34.20:")
print(f"  Fuser: {printer.fuser_level}")
print(f"  Laser: {printer.laser_unit_level}")
print(f"  PF MP: {printer.pf_kit_mp_level}")
print(f"  PF 1:  {printer.pf_kit_1_level}")
print(f"  Toner: {printer.toner_level}")
print(f"  Drum:  {printer.drum_level}")
