import sys
import os
import random
from datetime import datetime, timedelta

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.models.printer import Printer
from app.models.alert import Alert
from app.models.monitoring import PrinterSupplies, PrinterCounter, PrinterStatusHistory

def seed_data():
    db = SessionLocal()
    
    printers = db.query(Printer).all()
    if not printers:
        print("No printers found in DB. Please add printers first.")
        return
        
    print(f"Generating mock data for {len(printers)} printers...")
    
    now = datetime.utcnow()
    
    # 1. Generate Alerts
    db.query(Alert).delete() # clear old alerts
    
    for printer in printers:
        # Create some random unresolved alerts
        if random.random() < 0.3:
            alert = Alert(
                printer_id=printer.id,
                alert_type="STATUS",
                severity="CRITICAL",
                message="เครื่องพิมพ์ขาดการเชื่อมต่อ (Offline)",
                is_resolved=False,
                created_at=now - timedelta(hours=random.randint(1, 24))
            )
            db.add(alert)
            printer.status = "OFFLINE"
            
        elif random.random() < 0.3:
            alert = Alert(
                printer_id=printer.id,
                alert_type="SUPPLY",
                severity="WARNING",
                message="หมึกดำเหลือน้อย (Toner < 20%)",
                is_resolved=False,
                created_at=now - timedelta(minutes=random.randint(10, 300))
            )
            db.add(alert)
            printer.status = "WARNING"
            printer.toner_level = random.randint(5, 19)
        else:
            printer.status = "ONLINE"
            printer.toner_level = random.randint(40, 100)
            
    # 2. Generate History Data (last 30 days)
    db.query(PrinterSupplies).delete()
    db.query(PrinterCounter).delete()
    db.query(PrinterStatusHistory).delete()
    
    for printer in printers:
        start_pages = random.randint(5000, 20000)
        current_pages = start_pages
        
        start_toner = random.randint(80, 100)
        current_toner = start_toner
        
        for day in range(30, -1, -1):
            date = now - timedelta(days=day)
            
            # Print jobs
            daily_pages = random.randint(0, 150)
            current_pages += daily_pages
            
            # Toner decrease
            current_toner -= random.uniform(0.5, 2.5)
            if current_toner < 0:
                current_toner = 100 # replaced toner
                
            # Add counter
            db.add(PrinterCounter(
                printer_id=printer.id,
                total_pages=current_pages,
                color_pages=int(current_pages * 0.3),
                bw_pages=int(current_pages * 0.7),
                measured_at=date
            ))
            
            # Add supply
            db.add(PrinterSupplies(
                printer_id=printer.id,
                name="Black Toner",
                color="Black",
                type="Toner",
                level=max(0, int(current_toner)),
                maximum=100,
                measured_at=date
            ))
            
            # Add status history randomly
            if random.random() < 0.1:
                db.add(PrinterStatusHistory(
                    printer_id=printer.id,
                    status=random.choice(["ONLINE", "WARNING", "OFFLINE"]),
                    status_message="Status change",
                    checked_at=date
                ))
                
    db.commit()
    print("Mock data seeded successfully!")

if __name__ == "__main__":
    seed_data()
