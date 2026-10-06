@echo off
echo =========================================
echo    Cleaning up old system logs
echo =========================================
echo.
echo Deleting log files older than 14 days in logs directory...
forfiles /P "d:\app\Printer-Monitor\logs" /S /M *.log /D -14 /C "cmd /c del @path"
echo Done!
pause
