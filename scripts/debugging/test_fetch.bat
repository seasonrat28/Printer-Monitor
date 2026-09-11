@echo off
cd /d "%~dp0"
echo Downloading old app HTML...
backend\venv\Scripts\python.exe fetch_html.py
pause
