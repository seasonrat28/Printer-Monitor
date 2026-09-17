@echo off
:: ลบคำสั่ง pause หรือการแสดงผลที่ทำให้ค้างออก
:: สั่งรัน Backend และ Frontend แบบซ่อนหน้าต่าง Command Prompt เพื่อให้รันเป็น Background
if "%1"=="h" goto begin
start mshta vbscript:createobject("wscript.shell").run("""%~nx0"" h",0)(window.close)&&exit
:begin

:: 1. รัน Backend ในโฟลเดอร์ backend
cd backend
call venv\Scripts\activate
start /b python -m app.main

:: 2. รัน Frontend ในโฟลเดอร์ frontend
cd ..
cd frontend
start /b npm run dev

exit
