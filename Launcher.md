
# FINAL UPDATE — Windows Launcher ต้องทำงานโดยไม่ใช้ PowerShell

## IMPORTANT

เครื่อง Production ขององค์กรมี Endpoint Security / Antivirus ของ Sangfor และมี Policy ที่อาจบล็อกหรือจำกัดการใช้งาน PowerShell

ดังนั้น Printer Monitoring System **ห้ามพึ่งพา PowerShell ในการ Start / Stop / Restart / Status**

ต้องออกแบบ Launcher ใหม่ให้ทำงานด้วย:

```text
Windows CMD / .bat
+
Python
+
Node.js/npm
```

เป็นหลัก

## ห้ามทำ

ห้ามใช้:

```text
PowerShell
.ps1
powershell.exe
pwsh.exe
Set-ExecutionPolicy
Bypass
ExecutionPolicy Bypass
EncodedCommand
```

ห้ามพยายามหลบหรือ Bypass Policy ของ Sangfor / Antivirus / Endpoint Security

ถ้า Antivirus บล็อก Process ใด ให้แสดง Error และแนะนำให้ Administrator ขององค์กรอนุญาตโปรแกรมตาม Policy แทน

---

# 1. Launcher Architecture

ต้องเปลี่ยน Architecture เป็น:

```text
                    start.bat
                       │
                       ▼
              Python Launcher
                       │
             ┌─────────┴─────────┐
             │                   │
             ▼                   ▼
          Backend             Frontend
          Python              Node.js
             │                   │
             └─────────┬─────────┘
                       ▼
                    Browser
```

ไม่มี PowerShell อยู่ใน Flow นี้

---

# 2. Required Files

สร้าง:

```text
start.bat
stop.bat
restart.bat
status.bat
```

และใช้ Python Launcher:

```text
scripts/
├── launcher.py
├── start.py
├── stop.py
├── restart.py
└── status.py
```

ถ้าสามารถใช้ `launcher.py` ตัวเดียวจัดการทุกคำสั่งได้ จะยิ่งดี:

```text
scripts/
└── launcher.py
```

เช่น:

```bat
start.bat
→ python scripts\launcher.py start
```

```bat
stop.bat
→ python scripts\launcher.py stop
```

```bat
restart.bat
→ python scripts\launcher.py restart
```

```bat
status.bat
→ python scripts\launcher.py status
```

ให้เลือก Architecture ที่เหมาะสมกับโปรเจกต์จริง

---

# 3. start.bat

`start.bat` ต้องเป็นไฟล์ที่ผู้ใช้ดับเบิลคลิก

ตัวอย่างแนวคิด:

```bat
@echo off
chcp 65001 >nul
cd /d "%~dp0"

python scripts\launcher.py start

if errorlevel 1 (
    echo.
    echo Printer Monitoring failed to start.
    echo Check logs\launcher.log
)

pause
```

แต่ให้ Implement อย่างเหมาะสมจริง ไม่ต้องยึดตัวอย่างนี้แบบตรงตัว

สำคัญ:

ต้องใช้:

```text
%~dp0
```

เพื่อให้ Project ย้าย Folder ได้

ห้ามใช้ Absolute Path เช่น:

```text
C:\Users\...
D:\PrinterMonitoring\...
```

---

# 4. Python Launcher

Python Launcher ต้องรับ Command:

```text
start
stop
restart
status
```

ตัวอย่าง:

```text
python scripts\launcher.py start
python scripts\launcher.py stop
python scripts\launcher.py restart
python scripts\launcher.py status
```

ใช้ Python Standard Library เป็นหลัก:

```text
subprocess
socket
http.client
urllib
json
os
sys
time
pathlib
logging
signal
```

ไม่ควรเพิ่ม Dependency สำหรับ Launcher ถ้าไม่จำเป็น

---

# 5. Process Management

Python Launcher สามารถใช้:

```python
subprocess.Popen(...)
```

เพื่อ Start:

```text
Backend
Frontend
```

ต้องเก็บ PID:

```text
runtime/pids.json
```

ตัวอย่าง:

```json
{
  "backend_pid": 12345,
  "frontend_pid": 12346
}
```

---

# 6. ห้าม Kill Process แบบกว้าง

ห้ามใช้:

```bat
taskkill /IM python.exe /F
```

ห้าม:

```bat
taskkill /IM node.exe /F
```

เด็ดขาด

เพราะเครื่ององค์กรอาจมี Python หรือ Node Process อื่น

ต้อง Stop เฉพาะ Process ที่ Launcher สร้าง

สามารถใช้ PID ที่บันทึกไว้:

```text
runtime/pids.json
```

และตรวจสอบ Process ก่อน Terminate

---

# 7. Child Process Management

ต้องระวังว่า Backend และ Frontend อาจสร้าง Child Process

ออกแบบ Process Management ให้สามารถหยุด Process Tree ของโปรแกรมที่ Launcher เป็นเจ้าของได้ โดยไม่กระทบ Process อื่น

หากจำเป็นต้องใช้ Windows command เช่น:

```text
taskkill /PID <PID> /T
```

ให้ใช้เฉพาะ PID ที่ Launcher สร้างและตรวจสอบแล้ว

ห้ามใช้ `/IM`

---

# 8. Port Selection

Backend:

```text
9100-9120
```

Frontend:

```text
9121-9140
```

ต้องเลือก Port ที่ว่างอัตโนมัติ

ตัวอย่าง:

```text
9100 occupied
9101 occupied
9102 available
```

ใช้:

```text
9102
```

Frontend:

```text
9121 occupied
9122 available
```

ใช้:

```text
9122
```

---

# 9. Port Checking

ให้ Python ตรวจ Port ด้วย:

```python
socket
```

ไม่ต้องใช้ PowerShell เช่น:

```text
Test-NetConnection
```

ห้ามใช้ PowerShell ในการตรวจ Port

---

# 10. Runtime Port

บันทึก:

```text
runtime/ports.json
```

ตัวอย่าง:

```json
{
  "backend_host": "127.0.0.1",
  "backend_port": 9102,
  "frontend_host": "127.0.0.1",
  "frontend_port": 9122,
  "backend_url": "http://127.0.0.1:9102",
  "frontend_url": "http://127.0.0.1:9122"
}
```

---

# 11. Backend Start

ตรวจสอบโครงสร้าง Backend จริงก่อน

ห้ามสมมติว่า:

```text
app.main:app
```

ต้องค้นหา Entry Point จริง

จากนั้น Python Launcher ใช้:

```text
subprocess.Popen()
```

เพื่อ Start Backend

ตัวอย่างแนวคิด:

```text
.venv\Scripts\python.exe
```

หรือ Python Environment ที่โปรเจกต์ใช้จริง

หากโปรเจกต์ใช้ `uv` อยู่แล้ว ให้ตรวจสอบและใช้ระบบเดิม

---

# 12. Frontend Start

ตรวจสอบ `package.json`

ค้นหา Script จริง:

```text
dev
start
preview
```

จากนั้น Python Launcher ใช้:

```text
subprocess.Popen()
```

เพื่อ Start Frontend

ไม่ใช้ PowerShell

---

# 13. Environment Check

Launcher ต้องตรวจ:

```text
Python
Node.js
npm
```

ด้วย CMD/Python เท่านั้น

ตัวอย่าง:

```text
python --version
node --version
npm --version
```

หรือเรียกผ่าน Python:

```python
subprocess.run(...)
```

ห้ามใช้ PowerShell

---

# 14. Virtual Environment

ถ้ามี:

```text
.venv
```

ให้ใช้:

```text
.venv\Scripts\python.exe
```

โดยตรง

ไม่จำเป็นต้อง Activate Environment ผ่าน Shell

นี่สำคัญมาก เพราะสามารถเรียก Python ใน Virtual Environment โดยตรงได้

ตัวอย่างแนวคิด:

```text
.venv\Scripts\python.exe
```

ดังนั้นไม่จำเป็นต้องทำ:

```text
activate.ps1
```

หรือ:

```text
Activate.ps1
```

---

# 15. Backend Dependencies

ตรวจสอบ:

```text
requirements.txt
pyproject.toml
uv.lock
```

ตามระบบจริงของโปรเจกต์

ถ้าต้องติดตั้ง Dependency ให้ทำด้วย Package Manager ที่โปรเจกต์ใช้

ไม่ใช้ PowerShell

---

# 16. Database Migration

ตรวจสอบระบบ Migration จริง

ถ้าใช้ Alembic:

```text
alembic upgrade head
```

สามารถเรียกผ่าน Python Environment โดยตรง

เช่น:

```text
.venv\Scripts\alembic.exe upgrade head
```

หรือวิธีที่เหมาะสมกับโปรเจกต์

ห้าม Reset Database

ห้าม Drop Database

---

# 17. Health Check

หลัง Backend Start:

ต้องตรวจ:

```text
/health
```

หรือ Endpoint จริงของโปรเจกต์

ใช้ Python:

```text
urllib
http.client
```

ได้

ห้ามใช้ PowerShell:

```text
Invoke-WebRequest
curl จาก PowerShell
```

ถ้า Health Check ผ่าน:

```text
[OK] Backend Ready
```

---

# 18. Frontend Health Check

ใช้ Python HTTP Request ตรวจ:

```text
http://127.0.0.1:<PORT>
```

ไม่ใช้ PowerShell

เมื่อพร้อม:

```text
[OK] Frontend Ready
```

---

# 19. Browser

เปิด Browser Default ของ Windows

สามารถใช้:

```python
webbrowser.open(url)
```

หรือ Windows command ที่เหมาะสม

ไม่ต้องใช้ PowerShell

ตัวอย่าง:

```text
http://127.0.0.1:9122
```

แต่ Port ต้องอ่านจาก:

```text
runtime/ports.json
```

ห้าม Hardcode

---

# 20. Logs

สร้าง:

```text
logs/
├── launcher.log
├── backend.log
└── frontend.log
```

Python Launcher ต้อง Redirect stdout/stderr ของ Backend และ Frontend ไปยัง:

```text
backend.log
frontend.log
```

ทำให้ไม่จำเป็นต้องเปิด CMD หลายหน้าต่าง

---

# 21. start.bat User Experience

ผู้ใช้ดับเบิลคลิก:

```text
start.bat
```

แล้วเห็น:

```text
========================================
       PRINTER MONITORING SYSTEM
========================================

Checking environment...
[OK] Python
[OK] Node.js
[OK] npm

Checking database...
[OK] Database

Selecting ports...
[OK] Backend  : 9102
[OK] Frontend : 9122

Starting backend...
[OK] Backend Ready

Starting frontend...
[OK] Frontend Ready

========================================
SYSTEM STATUS: RUNNING
========================================

Monitoring Server:
10.119.43.25

Printer Networks:
10.119.34.0/24
10.119.43.0/24

Frontend:
http://127.0.0.1:9122

Opening browser...
========================================
```

---

# 22. Do NOT Keep CMD Window Open

หลัง Start สำเร็จ

Backend และ Frontend ต้องทำงานเป็น Background Process

ไม่ควรเปิด CMD หลายหน้าต่างให้ผู้ใช้เห็น

สามารถใช้:

```text
subprocess.CREATE_NO_WINDOW
```

หรือวิธีที่เหมาะสมกับ Windows

แต่ต้องทดสอบว่าไม่ทำให้ Process ถูกปิดตาม Parent

สำคัญ:

ต้องแน่ใจว่า Backend และ Frontend ยังทำงานหลัง `start.bat` จบ

---

# 23. Sangfor Compatibility

เนื่องจากเครื่ององค์กรมี Sangfor Endpoint Security:

Launcher ต้อง:

* ไม่ใช้ PowerShell
* ไม่ใช้ `.ps1`
* ไม่ใช้ ExecutionPolicy Bypass
* ไม่ใช้ Encoded PowerShell
* ไม่พยายามหลบ Antivirus
* ไม่แก้ Security Policy
* ไม่ปิด Antivirus
* ไม่แก้ Firewall อัตโนมัติ
* ไม่ Disable Security Software

ต้องทำงานโดยใช้ Process ปกติ:

```text
cmd.exe
python.exe
node.exe
npm.exe
```

เท่านั้น

---

# 24. หาก Sangfor Block

ถ้า Sangfor บล็อก:

```text
python.exe
node.exe
npm.exe
```

Launcher ต้องไม่พยายาม Bypass

ให้บันทึก Error:

```text
ERROR: Process was blocked by endpoint security.

Process:
python.exe

Please contact your organization administrator
to approve the application according to security policy.
```

บันทึกใน:

```text
logs/launcher.log
```

---

# 25. Network Configuration

Production Monitoring Server:

```text
10.119.43.25
```

Printer Networks:

```text
10.119.34.0/24
10.119.43.0/24
```

Discovery:

```env
DISCOVERY_NETWORKS=10.119.34.0/24,10.119.43.0/24
```

SNMP:

```text
UDP 161
```

---

# 26. Discovery

ต้องรองรับ:

```text
10.119.34.0/24
10.119.43.0/24
```

พร้อมกัน

ต้องมี:

```text
Concurrency
Timeout
Retries
Rate Limiting
```

Default:

```env
DISCOVERY_CONCURRENCY=20
SNMP_TIMEOUT=3
SNMP_RETRIES=1
```

---

# 27. Monitoring

Printer:

```text
10.119.34.x
```

และ:

```text
10.119.43.x
```

ต้องถูก Monitor จาก:

```text
10.119.43.25
```

ผ่าน:

```text
SNMP
ICMP
```

ตามที่ Network องค์กรอนุญาต

---

# 28. Network Diagnostics

ห้ามใช้ PowerShell

สร้าง Network Diagnostics ด้วย Python

ตรวจ:

```text
Target IP
Ping
SNMP
Response Time
```

ตัวอย่าง:

```text
Network Diagnostics

Monitoring Server:
10.119.43.25

Target:
10.119.34.15

Ping:
PASS

SNMP:
PASS

Response:
124 ms
```

---

# 29. Configuration

`.env.example`:

```env
BACKEND_HOST=127.0.0.1
BACKEND_PORT_START=9100
BACKEND_PORT_END=9120

FRONTEND_HOST=127.0.0.1
FRONTEND_PORT_START=9121
FRONTEND_PORT_END=9140

OPEN_BROWSER=true

MONITOR_HOST=10.119.43.25

DISCOVERY_NETWORKS=10.119.34.0/24,10.119.43.0/24

DISCOVERY_CONCURRENCY=20

SNMP_PORT=161
SNMP_TIMEOUT=3
SNMP_RETRIES=1

OFFLINE_FAILURE_THRESHOLD=3

STATUS_INTERVAL=30
SUPPLIES_INTERVAL=300
COUNTERS_INTERVAL=600
```

ปรับชื่อ Variable ให้ตรงกับ Architecture จริงของโปรเจกต์

---

# 30. Required Launcher Commands

ต้องรองรับ:

```text
start.bat
stop.bat
restart.bat
status.bat
```

ตัวอย่าง:

```text
start.bat
```

→ Start ทุกอย่าง

```text
stop.bat
```

→ Stop ทุกอย่างที่ Launcher เป็นเจ้าของ

```text
restart.bat
```

→ Stop + Start

```text
status.bat
```

→ แสดงสถานะ

---

# 31. Multiple Instance

ถ้าเรียก:

```text
start.bat
```

ในขณะที่ระบบทำงานอยู่แล้ว

ต้องไม่ Start ซ้ำ

แสดง:

```text
Printer Monitoring is already running.

Backend:
RUNNING

Frontend:
RUNNING

Frontend:
http://127.0.0.1:9122
```

---

# 32. Project Structure

โครงสร้างสุดท้ายควรประมาณ:

```text
PrinterMonitoring/
│
├── start.bat
├── stop.bat
├── restart.bat
├── status.bat
│
├── .env.example
├── README.md
├── PLAN.md
│
├── backend/
├── frontend/
│
├── scripts/
│   └── launcher.py
│
├── runtime/
│   ├── ports.json
│   ├── pids.json
│   └── launcher.lock
│
├── logs/
│   ├── launcher.log
│   ├── backend.log
│   └── frontend.log
│
└── tests/
```

ไม่จำเป็นต้องสร้าง:

```text
scripts/*.ps1
```

---

# 33. README

เพิ่ม:

```markdown
## Windows Launcher

This project does not require PowerShell to start.

Start:

start.bat

Stop:

stop.bat

Restart:

restart.bat

Status:

status.bat
```

เพิ่ม Production Network:

```text
Monitoring Server:
10.119.43.25

Printer Networks:
10.119.34.0/24
10.119.43.0/24

SNMP:
UDP 161

Backend:
9100-9120

Frontend:
9121-9140
```

เพิ่ม Troubleshooting สำหรับกรณี Sangfor Block

---

# 34. Testing

ต้องทดสอบจริง:

## Test 1

```text
start.bat
```

Expected:

```text
Backend READY
Frontend READY
Browser OPEN
```

## Test 2

```text
status.bat
```

Expected:

```text
RUNNING
```

## Test 3

```text
start.bat
```

ซ้ำ

Expected:

```text
Already Running
```

## Test 4

```text
stop.bat
```

Expected:

```text
Backend stopped
Frontend stopped
```

## Test 5

```text
restart.bat
```

Expected:

```text
STOP
START
READY
```

## Test 6

Port Conflict:

```text
9100 occupied
```

Expected:

```text
9101
```

หรือ Port ถัดไปที่ว่าง

## Test 7

Port Conflict:

```text
9121 occupied
```

Expected:

```text
9122
```

หรือ Port ถัดไปที่ว่าง

## Test 8

ตรวจสอบว่าไม่มี:

```text
powershell.exe
pwsh.exe
.ps1
ExecutionPolicy
```

อยู่ใน Launcher

## Test 9

ย้าย Project Folder แล้ว:

```text
start.bat
```

ต้องทำงาน

---

# 35. Final Verification

ก่อนสรุปงาน ให้ค้นหาทั้ง Repository:

```text
powershell
pwsh
.ps1
ExecutionPolicy
```

ถ้าพบใน Launcher Code ให้แก้

ยกเว้นเอกสารที่กล่าวถึงว่า "ไม่ใช้ PowerShell" ได้

ต้องตรวจสอบด้วยว่าไม่มี:

```text
taskkill /IM python.exe
taskkill /IM node.exe
```

---

# 36. Final Report

เมื่อทำเสร็จ ห้ามตอบเพียง:

```text
Done
```

ให้รายงาน:

```text
Files Created
Files Modified

Launcher:
start.bat
stop.bat
restart.bat
status.bat

PowerShell Dependency:
NONE

Backend:
Port Range 9100-9120

Frontend:
Port Range 9121-9140

Monitoring Server:
10.119.43.25

Printer Networks:
10.119.34.0/24
10.119.43.0/24

Tests:
Start       PASS/FAIL
Stop        PASS/FAIL
Restart     PASS/FAIL
Status      PASS/FAIL
Port Conflict PASS/FAIL
Multi-CIDR  PASS/FAIL
No PowerShell PASS/FAIL
```

**เริ่มจากตรวจสอบ Repository ปัจจุบันก่อน แล้ว Implement Launcher แบบ CMD + Python โดยไม่ใช้ PowerShell และต้องทดสอบการทำงานจริง**
