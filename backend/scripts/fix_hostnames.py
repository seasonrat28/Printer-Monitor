import sqlite3
import sys

conn = sqlite3.connect(r'd:\app\Printer-Monitor\backend\printer_monitor.db')
c = conn.cursor()
# Set hostname to null for any printer that has "FUJIFILM Apeos" in the hostname or model
c.execute("UPDATE printers SET hostname = NULL WHERE model LIKE '%FUJIFILM Apeos%' OR hostname LIKE '%FUJIFILM Apeos%'")
print(f"Cleared hostname for {c.rowcount} printers.")
conn.commit()
conn.close()
