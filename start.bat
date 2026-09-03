@echo off
chcp 65001 >nul
cd /d "%~dp0"

if exist "backend\venv\Scripts\python.exe" (
    "backend\venv\Scripts\python.exe" scripts\launcher.py start
) else (
    python scripts\launcher.py start
)

if errorlevel 1 (
    echo.
    echo Printer Monitoring failed to start.
    echo Check logs\launcher.log
)

pause
