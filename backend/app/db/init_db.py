from sqlalchemy.orm import Session
from app.models.user import User
from app.core.security import get_password_hash
from app.core.config import settings

def init_db(db: Session) -> None:
    # Check if admin user exists
    admin = db.query(User).filter(User.username == "admin").first()
    if not admin:
        admin_user = User(
            username="admin",
            password_hash=get_password_hash("admin"),
            display_name="System Administrator",
            role="ADMIN",
            is_active=True
        )
        db.add(admin_user)
        db.commit()

    if settings.DEMO_MODE:
        from app.models.printer import Printer
        import uuid
        
        # Check if demo printers exist
        demo_exists = db.query(Printer).filter(Printer.ip_address.like("192.168.99.%")).first()
        if not demo_exists:
            printers = [
                {"ip_address": "192.168.99.1", "hostname": "printer-fuji", "model": "Apeos 4620 SZ", "manufacturer": "FUJIFILM", "status": "ONLINE", "location": "Floor 1"},
                {"ip_address": "192.168.99.2", "hostname": "printer-brother", "model": "HL-L6415DW", "manufacturer": "Brother", "status": "ONLINE", "location": "Floor 1"},
                {"ip_address": "192.168.99.3", "hostname": "printer-hp", "model": "LaserJet", "manufacturer": "HP", "status": "WARNING", "location": "Floor 2"},
                {"ip_address": "192.168.99.4", "hostname": "printer-canon", "model": "imageRUNNER", "manufacturer": "Canon", "status": "OFFLINE", "location": "Floor 3"},
                {"ip_address": "192.168.99.5", "hostname": "printer-ricoh", "model": "MFP", "manufacturer": "Ricoh", "status": "ONLINE", "location": "Warehouse"},
            ]
            
            for p in printers:
                db_printer = Printer(
                    ip_address=p["ip_address"],
                    hostname=p["hostname"],
                    model=p["model"],
                    manufacturer=p["manufacturer"],
                    status=p["status"],
                    location=p["location"],
                    mac_address=f"00:11:22:33:44:{p['ip_address'][-2:].zfill(2)}",
                    serial_number=str(uuid.uuid4())[:8].upper()
                )
                db.add(db_printer)
            db.commit()
