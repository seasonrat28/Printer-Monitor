@echo off
cd /d "%~dp0"
echo Fetching Private SNMP data from FUJIFILM printer (10.119.34.59)...
backend\venv\Scripts\python.exe dump_fuji.py 10.119.34.59 > fuji_private_snmp.txt
echo.
echo Done! The result has been saved to fuji_private_snmp.txt
pause
