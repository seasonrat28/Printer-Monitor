import os

log_path = r"d:\app\Printer-Monitor\backend\logs\printer_monitor.log"
with open(log_path, "r", encoding="utf-8") as f:
    lines = f.readlines()
    for line in lines[-100:]:
        if "202" in line:
            print(line.strip())
