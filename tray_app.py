import pystray
from PIL import Image, ImageDraw
import subprocess
import os
import sys
import time
import webbrowser
import socket
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

def create_image(status_color=(46, 204, 113)):
    """
    วาดไอคอนเครื่องพิมพ์ใน System Tray
    status_color: สีไฟสถานะ (เขียว = ปกติ, แดง = ปิด/หยุด, เหลือง = กำลังรีสตาร์ท)
    """
    image = Image.new('RGBA', (64, 64), color=(0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    
    # กระดาษด้านบน (สีขาว)
    d.rectangle([20, 8, 44, 24], fill=(255, 255, 255), outline=(200, 200, 200), width=2)
    d.line([26, 14, 38, 14], fill=(200, 200, 200), width=2)
    d.line([26, 18, 38, 18], fill=(200, 200, 200), width=2)
    
    # ตัวเครื่องปริ้นเตอร์ (สี Dark Slate Blue)
    d.rectangle([12, 24, 52, 48], fill=(30, 41, 59))
    d.rectangle([12, 24, 52, 48], outline=(71, 85, 105), width=2)
    
    # ช่องกระดาษออกด้านล่าง
    d.rectangle([18, 40, 46, 56], fill=(15, 23, 42))
    
    # กระดาษที่ออกมา (สีขาว)
    d.rectangle([22, 42, 42, 60], fill=(255, 255, 255))
    d.line([26, 48, 38, 48], fill=(200, 200, 200), width=2)
    d.line([26, 52, 38, 52], fill=(200, 200, 200), width=2)
    
    # ไฟสถานะ LED
    d.ellipse([42, 28, 48, 34], fill=status_color)
    
    return image

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def start_services():
    backend_dir = BASE_DIR / "backend"
    cmd_backend = f'cmd.exe /c "cd /d {backend_dir} && call venv\\Scripts\\activate.bat && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"'
    subprocess.Popen(cmd_backend, creationflags=0x08000000)
    
    frontend_dir = BASE_DIR / "frontend"
    cmd_frontend = f'cmd.exe /c "cd /d {frontend_dir} && npm.cmd run preview -- --host 0.0.0.0"'
    subprocess.Popen(cmd_frontend, creationflags=0x08000000)

def stop_services():
    # ปิด process พอร์ต 8000 และ 4173 ให้สะอาด
    os.system('FOR /F "tokens=5" %a IN (\'netstat -ano ^| findstr :8000\') DO taskkill /F /PID %a >nul 2>&1')
    os.system('FOR /F "tokens=5" %a IN (\'netstat -ano ^| findstr :4173\') DO taskkill /F /PID %a >nul 2>&1')

def notify(icon, title, message):
    try:
        icon.notify(message, title)
    except Exception:
        pass

# --- Cloudflare Tunnel Management ---
tunnel_proc = None
tunnel_url = None
TUNNEL_URL_FILE = BASE_DIR / "runtime" / "tunnel_url.txt"

def is_tunnel_running():
    global tunnel_proc
    if tunnel_proc and tunnel_proc.poll() is None:
        return True
    # ตรวจสอบว่ามี process cloudflared.exe ค้างอยู่หรือไม่
    try:
        res = subprocess.run(["tasklist", "/FI", "IMAGENAME eq cloudflared.exe"], capture_output=True, text=True)
        return "cloudflared.exe" in res.stdout
    except Exception:
        return False

def get_current_tunnel_url():
    global tunnel_url
    if tunnel_url:
        return tunnel_url
    if TUNNEL_URL_FILE.exists():
        try:
            return TUNNEL_URL_FILE.read_text(encoding="utf-8").strip()
        except Exception:
            pass
    return None

import threading
import re

def start_cloudflare_tunnel(icon):
    global tunnel_proc, tunnel_url
    cloudflared_exe = BASE_DIR / "cloudflared.exe"
    if not cloudflared_exe.exists():
        notify(icon, "Cloudflare Tunnel", "ไม่พบไฟล์ cloudflared.exe ในโฟลเดอร์โปรเจกต์")
        return

    notify(icon, "Cloudflare Tunnel", "กำลังเริ่มต้น Cloudflare Tunnel...")
    TUNNEL_URL_FILE.parent.mkdir(parents=True, exist_ok=True)
    if TUNNEL_URL_FILE.exists():
        try:
            TUNNEL_URL_FILE.unlink()
        except Exception:
            pass

    # สั่งรัน cloudflared tunnel ไปที่พอร์ต 4173 (Frontend Preview ซึ่งมี Proxy ไป backend อัตโนมัติ)
    cmd = [str(cloudflared_exe), "tunnel", "--url", "http://localhost:4173"]
    tunnel_proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        creationflags=0x08000000
    )

    def monitor_output():
        global tunnel_url
        url_found = None
        for line in iter(tunnel_proc.stdout.readline, ''):
            if not line:
                break
            match = re.search(r'https://[a-zA-Z0-9\-]+\.trycloudflare\.com', line)
            if match:
                url_found = match.group(0)
                tunnel_url = url_found
                try:
                    TUNNEL_URL_FILE.write_text(url_found, encoding="utf-8")
                    # คัดลอกลิงก์ไปยังคลิปบอร์ด Windows อัตโนมัติ
                    subprocess.run(["cmd.exe", "/c", f"echo {url_found}| clip"], creationflags=0x08000000)
                except Exception:
                    pass
                notify(icon, "Cloudflare Tunnel พร้อมใช้งาน", f"ลิงก์: {url_found}\n(คัดลอกลงคลิปบอร์ดแล้ว)")
                break

    threading.Thread(target=monitor_output, daemon=True).start()

def stop_cloudflare_tunnel(icon=None):
    global tunnel_proc, tunnel_url
    if tunnel_proc:
        try:
            tunnel_proc.terminate()
        except Exception:
            pass
        tunnel_proc = None
    os.system("taskkill /F /IM cloudflared.exe >nul 2>&1")
    tunnel_url = None
    if TUNNEL_URL_FILE.exists():
        try:
            TUNNEL_URL_FILE.unlink()
        except Exception:
            pass
    if icon:
        notify(icon, "Cloudflare Tunnel", "ปิด Cloudflare Tunnel เรียบร้อยแล้ว (คนภายนอกเข้าไม่ได้แล้ว)")

def on_toggle_tunnel(icon, item):
    if is_tunnel_running():
        stop_cloudflare_tunnel(icon)
    else:
        start_cloudflare_tunnel(icon)

def on_copy_tunnel_url(icon, item):
    url = get_current_tunnel_url()
    if url:
        subprocess.run(["cmd.exe", "/c", f"echo {url}| clip"], creationflags=0x08000000)
        notify(icon, "Cloudflare URL", f"คัดลอก {url} ลงคลิปบอร์ดแล้ว")
    else:
        notify(icon, "Cloudflare Tunnel", "ยังไม่พบ URL หรือ Tunnel ยังไม่ได้เปิด")

def on_open_tunnel_url(icon, item):
    url = get_current_tunnel_url()
    if url:
        webbrowser.open(url)
    else:
        notify(icon, "Cloudflare Tunnel", "Tunnel ยังไม่ได้เปิดทำงาน")

# --- Menu Actions ---

def get_local_lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def on_open_desktop_app(icon, item):
    launcher_py = BASE_DIR / "desktop_launcher.py"
    subprocess.Popen([sys.executable, str(launcher_py)], creationflags=0x08000000)

def on_copy_lan_url(icon, item):
    lan_ip = get_local_lan_ip()
    port = 4173 if is_port_in_use(4173) else 5173
    lan_url = f"http://{lan_ip}:{port}"
    subprocess.run(["cmd.exe", "/c", f"echo {lan_url}| clip"], creationflags=0x08000000)
    notify(icon, "LAN Access URL", f"คัดลอก {lan_url} ลงคลิปบอร์ดแล้ว ให้เครื่องอื่นในวงเปิดได้ทันที")

def on_open_dashboard(icon, item):
    port = 4173 if is_port_in_use(4173) else 5173
    webbrowser.open(f"http://localhost:{port}")

def on_open_api_docs(icon, item):
    webbrowser.open("http://localhost:8000/docs")

def on_restart_services(icon, item):
    icon.icon = create_image(status_color=(245, 158, 11))
    notify(icon, "Printer Monitor", "กำลังรีสตาร์ทระบบ...")
    stop_services()
    time.sleep(2)
    start_services()
    time.sleep(3)
    icon.icon = create_image(status_color=(46, 204, 113))
    notify(icon, "Printer Monitor", "ระบบรีสตาร์ทพร้อมใช้งานแล้ว")

def on_build_frontend(icon, item):
    notify(icon, "Printer Monitor", "กำลังคอมไพล์ Frontend (Build)...")
    frontend_dir = BASE_DIR / "frontend"
    res = subprocess.run(
        ["cmd.exe", "/c", f"cd /d {frontend_dir} && npm.cmd run build"],
        capture_output=True,
        text=True
    )
    if res.returncode == 0:
        notify(icon, "Printer Monitor", "Build Frontend สำเร็จแล้ว!")
    else:
        notify(icon, "Printer Monitor", "Build ไม่สำเร็จ กรุณาตรวจสอบ logs")

def on_clean_logs(icon, item):
    logs_dir = BASE_DIR / "logs"
    if logs_dir.exists():
        os.system(f'forfiles /P "{logs_dir}" /S /M *.log /D -14 /C "cmd /c del @path" 2>nul')
    notify(icon, "Printer Monitor", "ล้างไฟล์ Log เก่ากว่า 14 วันเรียบร้อยแล้ว")

def on_open_folder(icon, item):
    os.startfile(str(BASE_DIR))

def is_autostart_enabled():
    startup = Path(os.environ.get("APPDATA", "")) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"
    return (startup / "PrinterMonitor.lnk").exists()

def on_toggle_autostart(icon, item):
    startup = Path(os.environ.get("APPDATA", "")) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"
    shortcut_file = startup / "PrinterMonitor.lnk"
    
    if shortcut_file.exists():
        try:
            shortcut_file.unlink()
            notify(icon, "Printer Monitor", "ปิดการเปิดอัตโนมัติตอนเปิดเครื่องแล้ว")
        except Exception as e:
            notify(icon, "Printer Monitor", f"Error: {e}")
    else:
        vbs_script = Path(os.environ.get("TEMP", "")) / "CreateShortcut.vbs"
        tray_script = BASE_DIR / "manage.bat"
        content = f'''Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = "{shortcut_file}"
Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = "pythonw.exe"
oLink.Arguments = "\"{BASE_DIR / 'tray_app.py'}\""
oLink.WorkingDirectory = "{BASE_DIR}"
oLink.Description = "Enterprise Printer Monitor Tray"
oLink.Save
'''
        with open(vbs_script, "w") as f:
            f.write(content)
        subprocess.run(["cscript", "/nologo", str(vbs_script)])
        if vbs_script.exists():
            vbs_script.unlink()
        notify(icon, "Printer Monitor", "ตั้งค่าเปิดอัตโนมัติเมื่อเปิดเครื่อง (Auto-Start) เรียบร้อยแล้ว")

def on_exit(icon, item):
    icon.stop()
    stop_cloudflare_tunnel()
    stop_services()
    pid_file = BASE_DIR / "tray_app.pid"
    if pid_file.exists():
        try:
            pid_file.unlink()
        except Exception:
            pass

def build_menu():
    def get_copy_label(item):
        url = get_current_tunnel_url()
        if url:
            short = url.replace("https://", "")
            return f"📋 Copy: {short}"
        return "📋 Copy Public Link (กำลังรอลิงก์...)"

    return pystray.Menu(
        pystray.MenuItem("🖥️ Open Enterprise Console (Desktop App)", on_open_desktop_app, default=True),
        pystray.MenuItem("🌐 Open in Web Browser", on_open_dashboard),
        pystray.MenuItem("🔗 Copy LAN URL (สำหรับเครื่องอื่น)", on_copy_lan_url),
        pystray.MenuItem("📑 Open API Docs (Swagger)", on_open_api_docs),
        pystray.Menu.SEPARATOR,
        # Cloudflare Tunnel Controls
        pystray.MenuItem(
            lambda item: "🟢 Cloudflare Tunnel: ON (คลิกเพื่อปิด)" if is_tunnel_running() else "⚪ Cloudflare Tunnel: OFF (คลิกเพื่อเปิด)",
            on_toggle_tunnel
        ),
        pystray.MenuItem(
            get_copy_label,
            on_copy_tunnel_url
        ),
        pystray.MenuItem(
            "🚀 Open Public Link in Browser",
            on_open_tunnel_url
        ),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("🔄 Restart Services", on_restart_services),
        pystray.MenuItem("📦 Build Frontend", on_build_frontend),
        pystray.MenuItem("🧹 Clean Old Logs (14 Days)", on_clean_logs),
        pystray.MenuItem("📁 Open Project Folder", on_open_folder),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem(
            "⚡ Start on Windows Boot",
            on_toggle_autostart,
            checked=lambda item: is_autostart_enabled()
        ),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("❌ Exit & Stop Services", on_exit)
    )

if __name__ == "__main__":
    # บันทึก PID ไว้ใช้สำหรับจัดการ
    with open(BASE_DIR / "tray_app.pid", "w") as f:
        f.write(str(os.getpid()))

    # ปิดตัวเก่าที่ค้างอยู่ก่อน (ถ้ามี)
    stop_services()
    
    # เปิดเซิร์ฟเวอร์
    start_services()
    
    # รอ 3 วินาทีแล้วเปิดเบราว์เซอร์อัตโนมัติ
    time.sleep(3)
    webbrowser.open("http://localhost:4173")
    
    # รัน System Tray
    icon = pystray.Icon(
        "PrinterMonitor",
        create_image(status_color=(46, 204, 113)),
        "Enterprise Printer Monitor (Online)",
        build_menu()
    )
    icon.run()
