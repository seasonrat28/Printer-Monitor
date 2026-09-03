"""
Backup Utility for Printer Monitor Database
Run: python -m app.db.backup
"""
import shutil
import os
from datetime import datetime

def create_backup(db_path: str = "./printer_monitor.db", backup_dir: str = "./backups"):
    os.makedirs(backup_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(backup_dir, f"printer_monitor_{timestamp}.db")
    shutil.copy2(db_path, backup_path)
    print(f"✅ Backup created: {backup_path}")
    _cleanup_old_backups(backup_dir, keep=10)
    return backup_path

def _cleanup_old_backups(backup_dir: str, keep: int = 10):
    backups = sorted([
        os.path.join(backup_dir, f) for f in os.listdir(backup_dir)
        if f.startswith("printer_monitor_") and f.endswith(".db")
    ])
    while len(backups) > keep:
        old = backups.pop(0)
        os.remove(old)
        print(f"🗑  Removed old backup: {old}")

if __name__ == "__main__":
    create_backup()
