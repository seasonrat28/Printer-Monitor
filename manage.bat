@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Enterprise Printer Monitor - Control Center

:MENU
cls
echo ========================================================
echo        Enterprise Printer Monitor - Control Center
echo ========================================================
echo.
echo   [1] Start System (Single Window)
echo   [2] Start Background (Hidden Mode)
echo   [3] Start Tray App (System Tray Icon)
echo   [4] Stop All Services (Force Stop)
echo.
echo   [5] Build Frontend (Rebuild Dist)
echo   [6] Clean Old Logs (Older than 14 Days)
echo   [7] Setup Windows Auto-Start
echo.
echo   [0] Exit
echo.
echo ========================================================
set /p CHOICE="Select option [0-7]: "

if "%CHOICE%"=="1" goto START_NORMAL
if "%CHOICE%"=="2" goto START_HIDDEN
if "%CHOICE%"=="3" goto START_TRAY
if "%CHOICE%"=="4" goto STOP_SERVICES
if "%CHOICE%"=="5" goto BUILD_FRONTEND
if "%CHOICE%"=="6" goto CLEAN_LOGS
if "%CHOICE%"=="7" goto SETUP_AUTOSTART
if "%CHOICE%"=="0" exit /b
goto MENU

:START_NORMAL
cls
echo =========================================
echo    Starting Enterprise Printer Monitor
echo =========================================
echo.
echo [1] Starting Backend Server (Port 8000)...
cd /d "%~dp0backend"
call venv\Scripts\activate.bat
start /B "" uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

echo [2] Starting Frontend Preview (Port 4173)...
cd /d "%~dp0frontend"
start /B "" npm.cmd run preview -- --host 0.0.0.0

cd /d "%~dp0"
echo.
echo =========================================
echo    All systems are running in this window!
echo    Frontend is available at: http://localhost:4173
echo =========================================
echo To stop all servers, close this window or choose Stop in menu.
echo.
pause
goto MENU

:START_HIDDEN
cls
echo Starting all services in background...
start "" wscript.exe "%~dp0start_hidden.vbs"
timeout /t 2 >nul
echo Done! Services are running in background.
timeout /t 2 >nul
goto MENU

:START_TRAY
cls
echo Starting System Tray Application...
cd /d "%~dp0"
start "" pythonw tray_app.py
timeout /t 2 >nul
echo Done! Check the system tray icon near your clock.
timeout /t 2 >nul
goto MENU

:STOP_SERVICES
cls
echo =========================================
echo    Stopping Enterprise Printer Monitor
echo =========================================
echo.
echo 1. Stopping Backend (Port 8000)...
FOR /F "tokens=5" %%a IN ('netstat -ano ^| findstr :8000') DO taskkill /F /PID %%a >nul 2>&1

echo 2. Stopping Frontend (Port 4173)...
FOR /F "tokens=5" %%a IN ('netstat -ano ^| findstr :4173') DO taskkill /F /PID %%a >nul 2>&1

echo 3. Stopping Tray App (if running)...
if exist "%~dp0tray_app.pid" (
    set /p TRAY_PID=<"%~dp0tray_app.pid"
    taskkill /F /PID !TRAY_PID! >nul 2>&1
    del "%~dp0tray_app.pid"
)
echo.
echo All services have been stopped successfully!
pause
goto MENU

:BUILD_FRONTEND
cls
echo ========================================================
echo   Building Frontend
echo ========================================================
cd /d "%~dp0frontend"
call npm.cmd run build
cd /d "%~dp0"
echo.
echo Build finished!
pause
goto MENU

:CLEAN_LOGS
cls
echo =========================================
echo    Cleaning up old system logs
echo =========================================
echo.
echo Deleting log files older than 14 days in logs directory...
if exist "%~dp0logs" (
    forfiles /P "%~dp0logs" /S /M *.log /D -14 /C "cmd /c del @path" 2>nul
)
echo Done!
pause
goto MENU

:SETUP_AUTOSTART
cls
echo ==================================================
echo   Setting up Auto-Start on Windows Boot
echo ==================================================
set SCRIPT="%TEMP%\CreateShortcut.vbs"
echo Set oWS = WScript.CreateObject("WScript.Shell") > %SCRIPT%
echo sLinkFile = "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\PrinterMonitor.lnk" >> %SCRIPT%
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> %SCRIPT%
echo oLink.TargetPath = "%~dp0start_all.bat" >> %SCRIPT%
echo oLink.WorkingDirectory = "%~dp0" >> %SCRIPT%
echo oLink.Description = "Enterprise Printer Monitor" >> %SCRIPT%
echo oLink.Save >> %SCRIPT%
cscript /nologo %SCRIPT%
del %SCRIPT%
echo.
echo [OK] Auto-Start shortcut created successfully in Startup folder.
pause
goto MENU
