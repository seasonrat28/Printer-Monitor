@echo off
echo =======================================
echo Force Killing All Printer Monitor Services
echo =======================================

echo 1. Killing Python Backend (Uvicorn / FastAPI)...
taskkill /F /IM python.exe /T >nul 2>&1
taskkill /F /IM pythonw.exe /T >nul 2>&1

echo 2. Killing Node Frontend (Vite / React)...
taskkill /F /IM node.exe /T >nul 2>&1

echo 3. Cleaning up network ports...
FOR /F "tokens=5" %%a IN ('netstat -ano ^| findstr :8000') DO taskkill /F /PID %%a >nul 2>&1
FOR /F "tokens=5" %%a IN ('netstat -ano ^| findstr :4173') DO taskkill /F /PID %%a >nul 2>&1

echo.
echo All services stopped successfully!
echo You can now restart the application.
timeout /t 3 >nul
