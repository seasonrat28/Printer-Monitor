@echo off
echo ==================================================
echo Printer Monitor Deployment Setup Script
echo ==================================================

echo.
echo [1] Setting up Task Scheduler for Log Cleanup...
schtasks /delete /tn "PrinterMonitor_CleanupLogs" /f >nul 2>&1
schtasks /create /tn "PrinterMonitor_CleanupLogs" /tr "d:\app\Printer-Monitor\cleanup_logs.bat" /sc weekly /d SUN /st 02:00 /ru SYSTEM /f
if %errorlevel% equ 0 (
    echo [OK] Task Scheduler configured successfully.
) else (
    echo [ERROR] Failed to configure Task Scheduler. Make sure you run this as Administrator!
)

echo.
echo [2] Setting up Auto-Start on Windows Boot...
set SCRIPT="%TEMP%\CreateShortcut.vbs"
echo Set oWS = WScript.CreateObject("WScript.Shell") > %SCRIPT%
echo sLinkFile = "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\PrinterMonitor.lnk" >> %SCRIPT%
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> %SCRIPT%
echo oLink.TargetPath = "d:\app\Printer-Monitor\start_tray.bat" >> %SCRIPT%
echo oLink.WorkingDirectory = "d:\app\Printer-Monitor" >> %SCRIPT%
echo oLink.Description = "Enterprise Printer Monitor System Tray" >> %SCRIPT%
echo oLink.Save >> %SCRIPT%

cscript /nologo %SCRIPT%
del %SCRIPT%

echo [OK] Auto-Start shortcut created successfully in Startup folder.

echo.
echo ==================================================
echo Deployment Setup Complete!
echo You can now safely close this window.
echo ==================================================
pause
