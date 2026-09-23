@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo Adding modified files...
git add backend/app/scrapers/canon.py
git add frontend/src/pages/PrintersList.tsx
git add frontend/src/pages/AlertsPage.tsx
git add backend/app/monitoring/tasks.py

echo Committing...
git commit -m "Fix Canon ink parsing, update color printer detection, add IP to Alerts"

echo.
echo ========================================
echo   Commit successfully created!
echo ========================================
pause
