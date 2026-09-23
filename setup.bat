@echo off
cd /d "%~dp0"

echo ========================================
echo Printer Monitor - Installation Setup
echo ========================================
echo.

echo [1/2] Installing Backend Dependencies...
cd backend
if not exist "venv\Scripts\python.exe" (
    echo Creating virtual environment...
    python -m venv venv
)
venv\Scripts\python.exe -m pip install -r requirements.txt
cd ..

echo.
echo [2/2] Installing Frontend and Desktop App Dependencies...
cd frontend
call npm install
cd ..

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo You can now double click start.bat
echo.
pause
