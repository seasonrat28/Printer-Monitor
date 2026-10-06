@echo off
echo =========================================
echo    Stopping Enterprise Printer Monitor
echo =========================================

echo Stopping Backend (Port 8000)...
FOR /F "tokens=5" %%a IN ('netstat -ano ^| findstr :8000') DO taskkill /F /PID %%a >nul 2>&1

echo Stopping Frontend (Port 4173)...
FOR /F "tokens=5" %%a IN ('netstat -ano ^| findstr :4173') DO taskkill /F /PID %%a >nul 2>&1

echo Stopping Tray App (if running)...
if not exist tray_app.pid goto skip_tray
set /p TRAY_PID=<tray_app.pid
taskkill /F /PID %TRAY_PID% >nul 2>&1
del tray_app.pid
:skip_tray
echo.
echo All services have been successfully stopped!
pause
