import os
import shutil

root_dir = r"d:\app\Printer-Monitor"
debug_dir = os.path.join(root_dir, "scripts", "debugging")

os.makedirs(debug_dir, exist_ok=True)

files_to_delete = [
    "type", "vite", "frontend@0.0.0", "printer_status.html",
    "brother_snmp.txt", "fuji_snmp.txt", "fuji_private_snmp.txt",
    "found_supplies.txt", "found_supplies2.txt"
]

files_to_move = [
    "dump_brother.py", "dump_fuji.py", "fetch_html.py", "find_supplies.py", "test_db.py",
    "test_brother.bat", "test_fetch.bat", "test_find_supplies.bat", "test_fuji.bat", "test_fuji_private.bat"
]

for f in files_to_delete:
    p = os.path.join(root_dir, f)
    if os.path.exists(p):
        print(f"Deleting {f}")
        try:
            if os.path.isdir(p):
                shutil.rmtree(p)
            else:
                os.remove(p)
        except Exception as e:
            print(f"Failed to delete {f}: {e}")

for f in files_to_move:
    p = os.path.join(root_dir, f)
    if os.path.exists(p):
        print(f"Moving {f}")
        try:
            shutil.move(p, os.path.join(debug_dir, f))
        except Exception as e:
            print(f"Failed to move {f}: {e}")
