"""
EnterprisePM Desktop Launcher (StarCat 11 Edition)
Provides a standalone desktop application window without browser chrome / URL bar.
Runs in Dual-Mode alongside the local web server.
"""

import os
import sys
import time
import socket
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

def is_port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(('127.0.0.1', port)) == 0

def get_active_frontend_url() -> str:
    # Prefer preview port 4173, then dev port 5173
    if is_port_in_use(4173):
        return "http://localhost:4173"
    elif is_port_in_use(5173):
        return "http://localhost:5173"
    return "http://localhost:4173"

def ensure_services_running():
    # If neither port 4173 nor 8000 are up, start services via tray_app or background cmd
    if not is_port_in_use(8000) or (not is_port_in_use(4173) and not is_port_in_use(5173)):
        backend_dir = BASE_DIR / "backend"
        frontend_dir = BASE_DIR / "frontend"
        
        if not is_port_in_use(8000):
            cmd_backend = f'cmd.exe /c "cd /d {backend_dir} && call venv\\Scripts\\activate.bat && uvicorn app.main:app --host 0.0.0.0 --port 8000"'
            subprocess.Popen(cmd_backend, creationflags=0x08000000)
            
        if not is_port_in_use(4173) and not is_port_in_use(5173):
            cmd_frontend = f'cmd.exe /c "cd /d {frontend_dir} && npm.cmd run preview -- --host 0.0.0.0"'
            subprocess.Popen(cmd_frontend, creationflags=0x08000000)
            
        # Give services a few seconds to bind ports
        for _ in range(10):
            time.sleep(0.5)
            if is_port_in_use(4173) or is_port_in_use(5173):
                break

def find_edge_or_chrome():
    candidates = [
        Path(os.environ.get("PROGRAMFILES(X86)", "C:/Program Files (x86)")) / "Microsoft/Edge/Application/msedge.exe",
        Path(os.environ.get("PROGRAMFILES", "C:/Program Files")) / "Microsoft/Edge/Application/msedge.exe",
        Path(os.environ.get("LOCALAPPDATA", "C:/Users/Default/AppData/Local")) / "Microsoft/Edge/Application/msedge.exe",
        Path(os.environ.get("PROGRAMFILES", "C:/Program Files")) / "Google/Chrome/Application/chrome.exe",
        Path(os.environ.get("PROGRAMFILES(X86)", "C:/Program Files (x86)")) / "Google/Chrome/Application/chrome.exe",
    ]
    for exe in candidates:
        if exe.exists():
            return str(exe)
    return None

def launch_desktop_window():
    ensure_services_running()
    url = get_active_frontend_url()
    
    # Try pywebview if installed
    try:
        import webview
        webview.create_window(
            title="EnterprisePM Console - StarCat 11 Edition",
            url=url,
            width=1440,
            height=900,
            min_size=(1024, 600),
            confirm_close=False,
            easy_drag=True
        )
        webview.start(gui="edgechromium")
        return
    except ImportError:
        pass
    except Exception as e:
        print(f"pywebview launch note: {e}")

    # Standalone App Window via Microsoft Edge / Chrome (Native Enterprise Window mode)
    browser_exe = find_edge_or_chrome()
    if browser_exe:
        user_data_dir = Path(os.environ.get("LOCALAPPDATA", "C:/Temp")) / "EnterprisePM" / "AppProfile"
        user_data_dir.mkdir(parents=True, exist_ok=True)
        
        args = [
            browser_exe,
            f"--app={url}",
            f"--user-data-dir={user_data_dir}",
            "--window-size=1440,900",
            "--window-position=center",
            "--disable-extensions",
            "--disable-component-update",
            "--no-first-run",
            "--no-default-browser-check"
        ]
        subprocess.Popen(args)
    else:
        import webbrowser
        webbrowser.open(url)

if __name__ == "__main__":
    launch_desktop_window()
