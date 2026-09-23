"""
Run this script manually to compact the WAL file and reclaim disk space.
Usage: python scripts/wal_checkpoint.py
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'printer_monitor.db')
DB_PATH = os.path.abspath(DB_PATH)

print(f"Connecting to: {DB_PATH}")
wal_path = DB_PATH + '-wal'

if os.path.exists(wal_path):
    size_before = os.path.getsize(wal_path) / (1024 * 1024)
    print(f"WAL file size before checkpoint: {size_before:.2f} MB")
else:
    print("WAL file not found (already clean)")

conn = sqlite3.connect(DB_PATH, timeout=30)
cursor = conn.cursor()

# Run WAL checkpoint — TRUNCATE resets the WAL file to 0 bytes
cursor.execute("PRAGMA wal_checkpoint(TRUNCATE)")
result = cursor.fetchall()
print(f"Checkpoint result (busy, log, checkpointed): {result}")

cursor.execute("PRAGMA optimize")
cursor.execute("VACUUM")
print("VACUUM complete")

conn.close()

if os.path.exists(wal_path):
    size_after = os.path.getsize(wal_path) / (1024 * 1024)
    print(f"WAL file size after checkpoint: {size_after:.2f} MB")
else:
    print("WAL file removed (all pages checkpointed)")
