@echo off
echo =========================================
echo    Starting Enterprise Printer Monitor
echo =========================================

echo [1] Starting Backend Server (Port 8000)...
cd /d d:\app\Printer-Monitor\backend
call venv\Scripts\activate.bat
start /B "" uvicorn app.main:app --host 0.0.0.0 --port 8000

echo [2] Starting Frontend Preview (Port 4173)...
cd /d d:\app\Printer-Monitor\frontend
start /B "" npm.cmd run preview -- --host 0.0.0.0

echo.
echo =========================================
echo    All systems are running in this window!
echo    Frontend is available at: http://localhost:4173
echo =========================================
echo (Note: Logs from both backend and frontend will appear here)
echo To stop all servers, just close this CMD window.
echo.
pause
