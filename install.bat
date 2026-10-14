@echo off
echo ==================================================
echo Printer Monitor - One-Click Installer
echo ==================================================
echo.

:: 1. Check Python installation
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH!
    echo Please install Python 3.9+ and try again.
    pause
    exit /b
)
echo [OK] Python is installed.

:: 2. Check Node.js installation
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js 18+ and try again.
    pause
    exit /b
)
echo [OK] Node.js is installed.

echo.
echo [1/4] Setting up Python Virtual Environment (Backend)...
cd /d "%~dp0backend"
if not exist "venv" (
    python -m venv venv
    echo Virtual environment created.
) else (
    echo Virtual environment already exists.
)

echo.
echo [2/4] Installing Python Dependencies...
call venv\Scripts\activate.bat
python -m pip install --upgrade pip >nul
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [WARNING] Some Python packages might have failed to install.
) else (
    echo [OK] Python dependencies installed.
)
deactivate

echo.
echo [3/4] Installing Frontend Dependencies and Building...
cd /d "%~dp0frontend"
echo Running npm install... (This may take a few minutes)
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install frontend dependencies.
    pause
    exit /b
)
echo Running npm run build...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build frontend.
    pause
    exit /b
)
echo [OK] Frontend built successfully.

echo.
echo [4/4] Running Deployment Setup (Task Scheduler & Auto-Start)...
cd /d "%~dp0"
if exist "setup_deployment.bat" (
    call setup_deployment.bat
) else (
    echo [WARNING] setup_deployment.bat not found. Skipping auto-start setup.
)

echo.
echo ==================================================
echo INSTALLATION COMPLETE! 🎉
echo ==================================================
echo You can now double-click "tray_app.py" (or wait for the auto-start on next boot)
echo to launch the Printer Monitor.
echo.
pause
