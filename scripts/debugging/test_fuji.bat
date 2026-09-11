@echo off
cd /d "%~dp0"
echo Fetching SNMP data from FUJIFILM printer (10.119.34.59)...
backend\venv\Scripts\python.exe dump_brother.py 10.119.34.59 > fuji_snmp.txt
echo.
echo Done! The result has been saved to fuji_snmp.txt
pause
