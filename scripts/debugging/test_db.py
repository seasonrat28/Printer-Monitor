import sqlite3

def test():
    conn = sqlite3.connect(r'd:\app\Printer-Monitor\backend\printer_monitor.db')
    cursor = conn.cursor()
    cursor.execute('SELECT ip_address, manufacturer, model, toner_level, drum_level FROM printers')
    print("IP | Manufacturer | Model | Toner | Drum")
    for row in cursor.fetchall():
        print(f"{row[0]} | {row[1]} | {row[2]} | {row[3]}")

if __name__ == '__main__':
    test()
