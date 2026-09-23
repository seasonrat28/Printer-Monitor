cd d:\app\Printer-Monitor\backend
call venv\Scripts\activate.bat
uvicorn app.main:app --host 0.0.0.0 --port 9100
pause
