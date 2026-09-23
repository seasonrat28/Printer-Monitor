@echo off
if "%1"=="h" goto begin
start mshta vbscript:createobject("wscript.shell").run("""%~nx0"" h",0)(window.close)&&exit
:begin

:: เรียกใช้ระบบ Launcher เพื่อสั่ง Start ระบบทั้งหมดอยู่เบื้องหลัง (ซ่อนหน้าจอ)
call start.bat

exit
