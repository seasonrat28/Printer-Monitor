@echo off
cd /d "%~dp0"
echo Scanning printer 10.119.34.70 for all hidden supplies (this may take a few minutes)...
backend\venv\Scripts\python.exe find_supplies.py 10.119.34.70
echo.
echo Done! Please check found_supplies2.txt
pause
