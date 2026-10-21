import os
from pathlib import Path

BASE_DIR = Path(r"d:\app\Printer-Monitor")

# Files to remove
files_to_delete = [
    "git_status.bat",
    "push_changes.bat",
    "push_to_github.bat",
    "kill_all.bat",
    "kill_services.bat",
    "cleanup_garbage.bat",
    "cleanup_logs.bat",
    "run_lh.bat",
    "build_frontend.bat",
    "setup_deployment.bat",
    "start_tray.bat",
]

print("Starting cleanup of redundant .bat files...")
for fname in files_to_delete:
    fpath = BASE_DIR / fname
    if fpath.exists():
        try:
            os.remove(fpath)
            print(f"[DELETED] {fname}")
        except Exception as e:
            print(f"[ERROR] {fname}: {e}")
    else:
        print(f"[NOT FOUND] {fname}")

print("Cleanup completed!")
