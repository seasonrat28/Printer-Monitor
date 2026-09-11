@echo off
cd /d "%~dp0\backend"
echo Stamping database to fix out-of-sync state...
venv\Scripts\alembic.exe stamp bffc67d74211
echo Generating new migration for status_message...
venv\Scripts\alembic.exe revision --autogenerate -m "add status_message"
echo Applying migration...
venv\Scripts\alembic.exe upgrade head
echo Done!
ping 127.0.0.1 -n 11 > nul
