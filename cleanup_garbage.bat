@echo off
cd d:\app\Printer-Monitor
backend\venv\Scripts\python.exe delete_garbage.py
echo "Deleted all garbage files!"
pause
del cleanup_garbage.bat
