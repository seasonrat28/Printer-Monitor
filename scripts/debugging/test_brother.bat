@echo off
cd /d "%~dp0"
echo Fetching SNMP data from Brother printer (10.119.34.70)...
backend\venv\Scripts\python.exe dump_brother.py 10.119.34.70 > brother_snmp.txt
echo.
echo Done! The result has been saved to brother_snmp.txt
pause
