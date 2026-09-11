@echo off
chcp 65001 >nul
cd /d "%~dp0"

if exist "backend\venv\Scripts\python.exe" (
    "backend\venv\Scripts\python.exe" scripts\launcher.py restart
) else (
    python scripts\launcher.py restart
)

ping 127.0.0.1 -n 11 > nul
