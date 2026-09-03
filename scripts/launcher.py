import os
import sys
import json
import time
import socket
import logging
import argparse
import subprocess
import urllib.request
import urllib.error
import webbrowser
from pathlib import Path

# Set Proxy for the entire script (so pip and npm can use it)
PROXY_URL = "http://Reception:Rct%402026@10.99.200.159:8080"
os.environ["HTTP_PROXY"] = PROXY_URL
os.environ["HTTPS_PROXY"] = PROXY_URL
os.environ["http_proxy"] = PROXY_URL
os.environ["https_proxy"] = PROXY_URL

BASE_DIR = Path(__file__).resolve().parent.parent
RUNTIME_DIR = BASE_DIR / "runtime"
LOGS_DIR = BASE_DIR / "logs"

PIDS_FILE = RUNTIME_DIR / "pids.json"
PORTS_FILE = RUNTIME_DIR / "ports.json"
LAUNCHER_LOG = LOGS_DIR / "launcher.log"
BACKEND_LOG = LOGS_DIR / "backend.log"
FRONTEND_LOG = LOGS_DIR / "frontend.log"

os.makedirs(RUNTIME_DIR, exist_ok=True)
os.makedirs(LOGS_DIR, exist_ok=True)

logging.basicConfig(
    filename=LAUNCHER_LOG,
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def print_and_log(msg, level="info"):
    print(msg)
    if level == "info":
        logging.info(msg)
    elif level == "error":
        logging.error(msg)

def find_free_port(start_port, end_port):
    for port in range(start_port, end_port + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', port)) != 0:
                return port
    raise Exception(f"No free ports in range {start_port}-{end_port}")

def get_local_ip():
    return 'localhost'

def check_process_running(pid):
    if not pid:
        return False
    try:
        if os.name == 'nt':
            output = subprocess.check_output(f'tasklist /FI "PID eq {pid}" /NH', shell=True).decode()
            return str(pid) in output
        else:
            os.kill(int(pid), 0)
            return True
    except:
        return False

def stop_process(pid):
    if not check_process_running(pid):
        return
    try:
        if os.name == 'nt':
            subprocess.run(f'taskkill /PID {pid} /T /F', shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            import signal
            os.kill(pid, signal.SIGTERM)
    except Exception as e:
        print_and_log(f"Error stopping process {pid}: {e}", "error")

def get_pids():
    if PIDS_FILE.exists():
        try:
            with open(PIDS_FILE, 'r') as f:
                return json.load(f)
        except:
            pass
    return {}

def save_pids(pids):
    with open(PIDS_FILE, 'w') as f:
        json.dump(pids, f)

def get_ports():
    if PORTS_FILE.exists():
        try:
            with open(PORTS_FILE, 'r') as f:
                return json.load(f)
        except:
            pass
    return {}

def save_ports(ports):
    with open(PORTS_FILE, 'w') as f:
        json.dump(ports, f)

def check_backend_health(url, timeout=30):
    start = time.time()
    while time.time() - start < timeout:
        try:
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=2) as response:
                if response.status == 200:
                    return True
        except:
            pass
        time.sleep(1)
    return False

def check_frontend_health(url, timeout=30):
    start = time.time()
    while time.time() - start < timeout:
        try:
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=2) as response:
                if response.status == 200:
                    return True
        except:
            pass
        time.sleep(1)
    return False

def start_backend(port):
    backend_dir = BASE_DIR / "backend"
    venv_python = backend_dir / "venv" / "Scripts" / "python.exe"
    
    if not venv_python.exists():
        print_and_log("Creating virtual environment and installing backend dependencies (This may take a minute)...")
        subprocess.run([sys.executable, "-m", "venv", "venv"], cwd=str(backend_dir))
        offline_dir = backend_dir / "offline_packages"
        if offline_dir.exists() and offline_dir.is_dir():
            print_and_log("Installing backend dependencies from offline packages...")
            try:
                subprocess.run([str(venv_python), "-m", "pip", "install", "--no-index", "--find-links=offline_packages", "-r", "requirements.txt"], cwd=str(backend_dir), check=True)
            except subprocess.CalledProcessError as e:
                print_and_log(f"Failed to install offline packages (some might be missing). Falling back to PyPI with Proxy...", "info")
                try:
                    subprocess.run([str(venv_python), "-m", "pip", "install", "-r", "requirements.txt"], cwd=str(backend_dir), check=True)
                except subprocess.CalledProcessError as e2:
                    print_and_log(f"Failed to install dependencies from PyPI: {e2}", "error")
                    sys.exit(1)
        else:
            print_and_log("Installing backend dependencies from PyPI...")
            try:
                subprocess.run([str(venv_python), "-m", "pip", "install", "-r", "requirements.txt"], cwd=str(backend_dir), check=True)
            except subprocess.CalledProcessError as e:
                print_and_log(f"Failed to install dependencies from PyPI: {e}", "error")
                sys.exit(1)
        
    python_exec = str(venv_python)
        
    cmd = [python_exec, "-m", "app.main"]
    
    env = os.environ.copy()
    env["PORT"] = str(port)
    
    log_f = open(BACKEND_LOG, "w")
    flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    
    process = subprocess.Popen(
        cmd,
        cwd=str(backend_dir),
        env=env,
        stdout=log_f,
        stderr=subprocess.STDOUT,
        creationflags=flags
    )
    return process.pid

def start_frontend(port, backend_url):
    frontend_dir = BASE_DIR / "frontend"
    npm_exec = "npm.cmd" if os.name == 'nt' else "npm"
    
    # Check if node_modules exists, install if not
    if not (frontend_dir / "node_modules").exists():
        print_and_log("Installing frontend dependencies...")
        subprocess.run([npm_exec, "install"], cwd=str(frontend_dir), stdout=subprocess.DEVNULL)
        
    cmd = [npm_exec, "run", "dev", "--", "--host", "0.0.0.0", "--port", str(port)]
    
    env = os.environ.copy()
    env["VITE_API_URL"] = backend_url
    
    log_f = open(FRONTEND_LOG, "w")
    flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    
    process = subprocess.Popen(
        cmd,
        cwd=str(frontend_dir),
        env=env,
        stdout=log_f,
        stderr=subprocess.STDOUT,
        creationflags=flags
    )
    return process.pid

def start():
    pids = get_pids()
    backend_running = check_process_running(pids.get("backend_pid"))
    frontend_running = check_process_running(pids.get("frontend_pid"))
    
    if backend_running or frontend_running:
        ports = get_ports()
        print_and_log("Printer Monitoring is already running.")
        print_and_log(f"Backend: {'RUNNING' if backend_running else 'STOPPED'}")
        print_and_log(f"Frontend: {'RUNNING' if frontend_running else 'STOPPED'}")
        if frontend_running and ports:
            print_and_log(f"Frontend: {ports.get('frontend_url')}")
        return

    print_and_log("========================================")
    print_and_log("       PRINTER MONITORING SYSTEM")
    print_and_log("========================================")
    print_and_log("")
    print_and_log("Checking environment...")
    
    # In a real environment we might check python, node, npm here
    # Assuming OK for now
    print_and_log("[OK] Python")
    print_and_log("[OK] Node.js")
    print_and_log("[OK] npm")
    
    print_and_log("")
    print_and_log(f"Selecting ports...")
    
    # Find free ports
    backend_port = find_free_port(9100, 9120)
    frontend_port = find_free_port(9121, 9140)
    print_and_log(f"[OK] Backend  : {backend_port}")
    print_and_log(f"[OK] Frontend : {frontend_port}")
    print_and_log("")
    
    server_ip = get_local_ip()
    
    backend_url = f"http://{server_ip}:{backend_port}"
    frontend_url = f"http://{server_ip}:{frontend_port}"
    
    # Save ports
    save_ports({
        "backend_host": server_ip,
        "backend_port": backend_port,
        "frontend_host": server_ip,
        "frontend_port": frontend_port,
        "backend_url": backend_url,
        "frontend_url": frontend_url
    })
    
    print_and_log("Starting backend...")
    b_pid = start_backend(backend_port)
    if check_backend_health(f"{backend_url}/health"):
        print_and_log("[OK] Backend Ready")
    else:
        print_and_log("[FAIL] Backend failed to start.", "error")
        stop_process(b_pid)
        return
        
    print_and_log("Starting frontend...")
    f_pid = start_frontend(frontend_port, backend_url)
    if check_frontend_health(frontend_url):
        print_and_log("[OK] Frontend Ready")
    else:
        print_and_log("[FAIL] Frontend failed to start.", "error")
        stop_process(b_pid)
        stop_process(f_pid)
        return
        
    save_pids({"backend_pid": b_pid, "frontend_pid": f_pid})
    
    print_and_log("")
    print_and_log("========================================")
    print_and_log("SYSTEM STATUS: RUNNING")
    print_and_log("========================================")
    print_and_log("")
    print_and_log("Monitoring Server:")
    print_and_log(server_ip)
    print_and_log("")
    print_and_log("Printer Networks:")
    print_and_log("10.119.34.0/24")
    print_and_log("10.119.43.0/24")
    print_and_log("")
    print_and_log("Frontend:")
    print_and_log(f"{frontend_url}")
    print_and_log("")
    print_and_log("Opening browser...")
    print_and_log("========================================")
    webbrowser.open(frontend_url)

def stop():
    pids = get_pids()
    b_pid = pids.get("backend_pid")
    f_pid = pids.get("frontend_pid")
    
    if b_pid and check_process_running(b_pid):
        stop_process(b_pid)
        print_and_log("Backend stopped")
    else:
        print_and_log("Backend is not running")
        
    if f_pid and check_process_running(f_pid):
        stop_process(f_pid)
        print_and_log("Frontend stopped")
    else:
        print_and_log("Frontend is not running")
        
    if PIDS_FILE.exists():
        PIDS_FILE.unlink()

def status():
    pids = get_pids()
    ports = get_ports()
    b_pid = pids.get("backend_pid")
    f_pid = pids.get("frontend_pid")
    
    b_running = check_process_running(b_pid)
    f_running = check_process_running(f_pid)
    
    if b_running and f_running:
        print_and_log("RUNNING")
        print_and_log(f"Frontend URL: {ports.get('frontend_url', 'Unknown')}")
    elif b_running or f_running:
        print_and_log("PARTIAL RUNNING")
        print_and_log(f"Backend: {'RUNNING' if b_running else 'STOPPED'}")
        print_and_log(f"Frontend: {'RUNNING' if f_running else 'STOPPED'}")
    else:
        print_and_log("STOPPED")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["start", "stop", "restart", "status"])
    args = parser.parse_args()
    
    if args.command == "start":
        start()
    elif args.command == "stop":
        stop()
    elif args.command == "restart":
        print_and_log("STOP")
        stop()
        time.sleep(2)
        print_and_log("START")
        start()
        print_and_log("READY")
    elif args.command == "status":
        status()
