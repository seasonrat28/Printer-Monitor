import sqlite3
import json

conn = sqlite3.connect(r'd:\app\Printer-Monitor\backend\printer_monitor.db')
c = conn.cursor()
c.execute("SELECT ip_address, hostname, model FROM printers")
rows = c.fetchall()
conn.close()

with open(r'd:\app\Printer-Monitor\backend\db_dump.json', 'w') as f:
    json.dump(rows, f, indent=2)
