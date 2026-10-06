Set WshShell = CreateObject("WScript.Shell")
' รัน Backend ซ่อนหน้าต่าง
WshShell.Run "cmd /c cd /d d:\app\Printer-Monitor\backend && call venv\Scripts\activate.bat && uvicorn app.main:app --host 0.0.0.0 --port 8000", 0, False

' รัน Frontend ซ่อนหน้าต่าง
WshShell.Run "cmd /c cd /d d:\app\Printer-Monitor\frontend && npm.cmd run preview -- --host 0.0.0.0", 0, False

Set WshShell = Nothing
