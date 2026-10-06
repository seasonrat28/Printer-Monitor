import pystray
from PIL import Image, ImageDraw
import subprocess
import os
import webbrowser

def create_image():
    # สร้างพื้นหลังโปร่งใส
    image = Image.new('RGBA', (64, 64), color=(0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    
    # วาดกระดาษด้านบน (สีขาว)
    d.rectangle([20, 8, 44, 24], fill=(255, 255, 255), outline=(200, 200, 200), width=2)
    d.line([26, 14, 38, 14], fill=(200, 200, 200), width=2)
    d.line([26, 18, 38, 18], fill=(200, 200, 200), width=2)
    
    # วาดตัวเครื่องปริ้นเตอร์ (สีน้ำเงิน)
    d.rectangle([12, 24, 52, 48], fill=(41, 128, 185))
    
    # วาดช่องกระดาษออกด้านล่าง (สีเทาเข้ม)
    d.rectangle([18, 40, 46, 56], fill=(52, 73, 94))
    
    # วาดกระดาษที่ออกมา (สีขาว)
    d.rectangle([22, 42, 42, 60], fill=(255, 255, 255))
    d.line([26, 48, 38, 48], fill=(200, 200, 200), width=2)
    d.line([26, 52, 38, 52], fill=(200, 200, 200), width=2)
    
    # วาดปุ่มกดบนเครื่อง
    d.ellipse([42, 28, 46, 32], fill=(46, 204, 113))
    
    return image

def start_services():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # คำสั่งรัน Backend แบบไม่มีหน้าต่าง (CREATE_NO_WINDOW)
    backend_dir = os.path.join(base_dir, "backend")
    cmd_backend = f'cmd.exe /c "cd /d {backend_dir} && call venv\\Scripts\\activate.bat && uvicorn app.main:app --host 0.0.0.0 --port 8000"'
    subprocess.Popen(cmd_backend, creationflags=0x08000000)
    
    # คำสั่งรัน Frontend แบบไม่มีหน้าต่าง
    frontend_dir = os.path.join(base_dir, "frontend")
    cmd_frontend = f'cmd.exe /c "cd /d {frontend_dir} && npm.cmd run preview -- --host 0.0.0.0"'
    subprocess.Popen(cmd_frontend, creationflags=0x08000000)

def stop_services():
    # ค้นหาและปิดพอร์ต 8000 กับ 4173 ให้สะอาด
    os.system('FOR /F "tokens=5" %a IN (\'netstat -ano ^| findstr :8000\') DO taskkill /F /PID %a >nul 2>&1')
    os.system('FOR /F "tokens=5" %a IN (\'netstat -ano ^| findstr :4173\') DO taskkill /F /PID %a >nul 2>&1')

def on_open_browser(icon, item):
    webbrowser.open("http://localhost:4173")

import time

def on_exit(icon, item):
    icon.stop()
    stop_services()

if __name__ == "__main__":
    # บันทึก PID ไว้ใช้สำหรับปิดโปรแกรมแบบเจาะจง
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "tray_app.pid"), "w") as f:
        f.write(str(os.getpid()))

    # ปิดตัวเก่าที่ค้างอยู่ก่อน (ถ้ามี)
    stop_services()
    
    # เปิดเซิร์ฟเวอร์
    start_services()
    
    # รอให้เซิร์ฟเวอร์โหลดเสร็จ 3 วินาที แล้วเด้งเปิดเบราว์เซอร์อัตโนมัติ
    time.sleep(3)
    webbrowser.open("http://localhost:4173")
    
    # สร้างเมนูคลิกขวาที่ System Tray
    menu = pystray.Menu(
        pystray.MenuItem("🌐 Open Printer Monitor", on_open_browser),
        pystray.MenuItem("❌ Exit & Stop Services", on_exit)
    )
    
    # แสดงไอคอนที่มุมขวาล่าง
    icon = pystray.Icon("PrinterMonitor", create_image(), "Printer Monitor (Running)", menu)
    icon.run()
