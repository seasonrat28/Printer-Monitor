# PROJECT: Enterprise Printer Monitoring System

คุณคือ Senior Full-Stack Engineer + Network/Infrastructure Engineer

ให้ลงมือสร้างระบบ **Enterprise Printer Monitoring System** สำหรับตรวจสอบและบริหารเครื่อง Printer ผ่าน Network โดยมีแนวคิดและความสามารถใกล้เคียง **Brother BRAdmin Professional 4** แต่ห้าม clone UI/branding ของ Brother โดยตรง ให้สร้าง Design และ Architecture ของเราเอง

## 1. เป้าหมายของระบบ

ระบบต้องสามารถ:

* Auto Discover Printer ใน Network
* ตรวจสอบ Printer ผ่าน IP
* Ping ตรวจ Online / Offline
* SNMP Monitoring
* อ่านข้อมูล Printer
* อ่าน Toner / Drum / Waste Toner
* อ่าน Page Counter
* อ่าน Model
* อ่าน Serial Number
* อ่าน Hostname
* อ่าน Location
* อ่าน MAC Address
* อ่าน Printer Status
* ตรวจสอบ Error
* เก็บ History
* ทำ Alert
* Dashboard แบบ Real-time
* Search / Filter / Sort
* Group Printer ตาม Site / Floor / Department
* Import / Export Printer
* Export CSV / Excel
* เปิด Web Management ของ Printer
* จัดการ SNMP Community
* รองรับ Printer หลายยี่ห้อ
* รองรับ Printer จำนวนมาก
* มีระบบ User / Role
* มี Audit Log

ระบบต้องออกแบบให้สามารถขยายจาก 100 เครื่องไปถึง 1,000+ เครื่องได้

---

# 2. TECHNOLOGY STACK

ใช้ Stack ดังนี้

## Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* shadcn/ui หรือ component library ที่เหมาะสม
* Lucide Icons
* Recharts
* TanStack Query
* React Router

## Backend

ใช้:

* Python
* FastAPI
* Pydantic
* SQLAlchemy
* Alembic
* asyncio

## Network Monitoring

ใช้:

* SNMP
* ICMP Ping

Python SNMP library ที่เหมาะสม เช่น:

* pysnmp

ต้องออกแบบ SNMP layer ให้สามารถเพิ่ม Vendor-specific MIB ได้ภายหลัง

## Database

Development:

* SQLite

Production:

* PostgreSQL

ต้องใช้ ORM และ Migration ตั้งแต่แรก ห้ามเขียน SQL กระจัดกระจาย

## Realtime

ใช้:

* WebSocket

Dashboard ต้องสามารถรับสถานะ Printer ที่เปลี่ยนแปลงโดยไม่ต้อง Reload หน้าเว็บ

---

# 3. PROJECT STRUCTURE

สร้าง Project Structure ที่เป็น Production-ready

ตัวอย่าง:

printer-monitor/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── layouts/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── stores/
│   │   ├── types/
│   │   └── utils/
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── monitoring/
│   │   ├── snmp/
│   │   ├── discovery/
│   │   ├── alerts/
│   │   ├── websocket/
│   │   └── main.py
│   │
│   ├── migrations/
│   ├── tests/
│   └── requirements.txt
│
├── scripts/
├── docs/
├── .env.example
├── docker-compose.yml
└── README.md

อย่าสร้างทุกอย่างไว้ในไฟล์เดียว

---

# 4. DATABASE DESIGN

สร้าง Database Schema สำหรับ:

## users

* id
* username
* password_hash
* display_name
* role
* is_active
* created_at
* updated_at

## printers

* id
* ip_address
* hostname
* mac_address
* model
* manufacturer
* serial_number
* location
* site
* floor
* department
* status
* last_seen
* snmp_enabled
* snmp_version
* snmp_community
* created_at
* updated_at

ห้ามเก็บ SNMP community แบบ plaintext ถ้าระบบ Production รองรับ encryption ให้ใช้ encryption

## printer_status_history

* id
* printer_id
* status
* error_message
* response_time
* checked_at

## printer_supplies

* id
* printer_id
* supply_type
* name
* level
* maximum
* status
* updated_at

ตัวอย่าง supply_type:

* toner
* drum
* waste_toner
* fuser
* maintenance_kit

## printer_counters

* id
* printer_id
* total_pages
* print_pages
* copy_pages
* scan_pages
* measured_at

## printer_errors

* id
* printer_id
* error_code
* error_message
* severity
* first_seen
* last_seen
* resolved_at

## alerts

* id
* printer_id
* type
* severity
* message
* threshold
* current_value
* status
* created_at
* resolved_at

## monitoring_jobs

เก็บข้อมูลการ Monitoring

## audit_logs

เก็บ:

* user
* action
* target
* timestamp
* IP address

---

# 5. SNMP ENGINE

สร้าง SNMP Engine แบบ Modular

ต้องรองรับ:

SNMP v1
SNMP v2c
SNMP v3

เริ่ม Implement:

SNMP v2c

แต่ Architecture ต้องรองรับ v1/v3 ในอนาคต

สร้าง Standard Printer MIB support ก่อน

ต้องสามารถอ่านข้อมูล เช่น:

* sysName
* sysDescr
* sysLocation
* sysUpTime
* printer status
* printer error
* toner level
* toner maximum
* page counter

ใช้ Standard MIB ก่อน

Vendor-specific MIB ต้องแยกเป็น Adapter

ตัวอย่าง:

backend/app/snmp/
base.py
standard.py
brother.py
fuji.py
hp.py
canon.py
ricoh.py

หากยังไม่มี OID ที่ยืนยันได้ของ Vendor ใด ห้ามเดา OID

ให้ทำ Adapter interface และ TODO ไว้แทน

---

# 6. PRINTER DISCOVERY

สร้างระบบ Auto Discovery

ผู้ใช้สามารถระบุ:

CIDR เช่น:

10.119.34.0/24

จากนั้นระบบต้อง:

1. ตรวจ IP
2. Ping
3. ตรวจ SNMP
4. อ่าน sysName
5. อ่าน sysDescr
6. ตรวจว่าเป็น Printer
7. Detect Manufacturer
8. Detect Model
9. เพิ่มเข้า Discovery Result

ตัวอย่าง:

10.119.34.10
FUJIFILM
Apeos 4620 SZ
Online

10.119.34.20
Brother
HL-L6415DW
Online

ผู้ใช้สามารถเลือก:

[ Add Selected Printers ]

เพื่อเพิ่มเข้า Monitoring

ต้องมี Timeout และ Concurrency Limit

ห้ามยิง Network แบบไม่มี Limit จนทำให้ Network หรือเครื่อง Printer รับโหลดไม่ไหว

---

# 7. MONITORING ENGINE

สร้าง Background Monitoring Worker

ตัวอย่าง:

ทุก 30 วินาที:

Ping Printer

ทุก 60 วินาที:

SNMP Status

ทุก 5 นาที:

Supplies

ทุก 10 นาที:

Counter

ต้องสามารถปรับ Interval ได้จาก Settings

เช่น:

STATUS_INTERVAL=30
SUPPLY_INTERVAL=300
COUNTER_INTERVAL=600

Monitoring ต้องไม่ Block API

---

# 8. PRINTER STATUS

กำหนด Status:

ONLINE
OFFLINE
WARNING
ERROR
UNKNOWN

ตัวอย่าง:

Ping OK + Printer Ready
→ ONLINE

Ping OK + Toner < 20%
→ WARNING

Printer Error
→ ERROR

Ping ไม่ตอบสนองต่อเนื่อง
→ OFFLINE

SNMP Timeout
→ UNKNOWN

ต้องป้องกัน False Offline

เช่นต้อง Fail ติดต่อกัน 2-3 ครั้งก่อนเปลี่ยนเป็น OFFLINE

---

# 9. DASHBOARD

สร้าง Dashboard ที่ดู Professional มาก

ไม่เอา UI แบบ Template ธรรมดา

ต้องเหมาะสำหรับ:

* IT Admin
* Network Admin
* Helpdesk
* นำเสนออาจารย์
* ใช้งานจริง

หน้า Dashboard ต้องมี:

Total Printers

Online

Offline

Warning

Error

Toner Low

Active Alerts

Printer Health

Network Health

Recent Events

---

# 10. PRINTER TABLE

สร้างหน้า:

/printers

แสดง:

Status
IP
Hostname
Manufacturer
Model
Location
Toner
Drum
Page Counter
Last Seen

ต้องมี:

Search

Filter:

Status
Manufacturer
Model
Site
Floor
Department

Sort:

IP
Name
Status
Toner
Last Seen

Pagination

Bulk Select

---

# 11. PRINTER DETAIL

สร้างหน้า:

/printers/:id

ต้องมี:

## Overview

Printer Status

IP

Hostname

Model

Manufacturer

Serial

MAC

Location

Site

Floor

Department

Last Seen

Response Time

## Supplies

Toner

Drum

Waste Toner

Fuser

Maintenance Kit

ใช้ Progress Bar

## Counters

Total Pages

Print

Copy

Scan

## Network

Ping

SNMP

Response Time

## History

แสดง Timeline

ตัวอย่าง:

01:10 Ready
00:58 Paper Jam
00:40 Ready
00:20 Toner Low

## Charts

Toner History

Status History

Page Counter History

---

# 12. ALERT SYSTEM

สร้าง Alert Engine

Default Rules:

Toner < 20%
→ WARNING

Toner < 10%
→ CRITICAL

Drum < 20%
→ WARNING

Printer Offline > 5 minutes
→ CRITICAL

Paper Jam
→ ERROR

Printer Error
→ ERROR

สร้างหน้า:

/alerts

ให้สามารถ:

Acknowledge

Resolve

Filter

Search

ดู Alert History

---

# 13. GROUP MANAGEMENT

สร้าง:

/groups

สามารถสร้าง Group:

สำนักงานใหญ่
โรงงาน
คลังสินค้า

และ:

ชั้น 1
ชั้น 2
ชั้น 3

หรือ:

IT
HR
Accounting

Printer หนึ่งเครื่องสามารถอยู่ใน Group ได้ตาม Design ที่เหมาะสม

---

# 14. SETTINGS

สร้างหน้า:

/settings

แบ่งเป็น:

General

Monitoring

SNMP

Alert

Users

System

ตัวอย่าง:

Monitoring Interval

SNMP Timeout

Retry Count

Offline Threshold

Toner Warning Threshold

Toner Critical Threshold

---

# 15. USER MANAGEMENT

Role:

ADMIN
OPERATOR
VIEWER

ADMIN:

ทำได้ทุกอย่าง

OPERATOR:

จัดการ Printer / Alert

VIEWER:

ดูอย่างเดียว

Password ต้อง Hash

ห้ามเก็บ Password plaintext

---

# 16. API

สร้าง REST API ที่เป็นระบบ

ตัวอย่าง:

GET /api/printers

GET /api/printers/{id}

POST /api/printers

PUT /api/printers/{id}

DELETE /api/printers/{id}

POST /api/discovery/scan

GET /api/discovery/results

POST /api/monitoring/start

POST /api/monitoring/stop

GET /api/alerts

POST /api/alerts/{id}/acknowledge

POST /api/alerts/{id}/resolve

GET /api/dashboard/stats

GET /api/printers/{id}/history

GET /api/printers/{id}/supplies

GET /api/printers/{id}/counters

ต้องมี API validation และ Error Handling

---

# 17. WEBSOCKET

สร้าง:

/ws

ส่ง Event เช่น:

printer.status.changed

printer.supply.changed

printer.error

alert.created

alert.resolved

dashboard.updated

Frontend ต้อง Update UI ทันที

---

# 18. WEB MANAGEMENT

หน้า Printer Detail ต้องมีปุ่ม:

Open Web Management

เมื่อกดให้เปิด:

http://PRINTER-IP

ใน Browser

ไม่ต้องพยายาม Login เข้า Printer อัตโนมัติ

---

# 19. IMPORT / EXPORT

สร้าง Import:

CSV

Excel

ตัวอย่าง CSV:

ip_address,hostname,location,site,department

Export:

CSV

Excel

PDF ถ้าทำได้

---

# 20. UI / UX

Design ต้องดูเหมือน Enterprise Network Monitoring System

แนวทาง:

Dark/Light mode

Responsive

Sidebar

Top Navigation

Dashboard Cards

Status Badge

Charts

Tables

Modal

Toast Notification

Loading State

Empty State

Error State

Skeleton Loading

ต้องรองรับภาษาไทย

Default UI ภาษาไทย

แต่ Code และ API ใช้ภาษาอังกฤษ

Font:

ใช้ Font ที่อ่านภาษาไทยสวย เช่น Sarabun หรือ Noto Sans Thai

---

# 21. COLOR STATUS

ใช้สีตามความหมาย:

Online = Green

Warning = Yellow

Error = Red

Offline = Gray

Unknown = Neutral

อย่าใช้สีมากเกินไปจน Dashboard ดูรก

---

# 22. SECURITY

ต้องคำนึงถึง:

Authentication

Authorization

Password Hashing

Input Validation

SQL Injection Protection

CORS

Rate Limiting

SNMP credential protection

Audit Log

อย่า expose SNMP Community ใน Frontend

อย่าใส่ Secret ใน Git

สร้าง:

.env.example

---

# 23. ERROR HANDLING

ระบบต้องไม่ Crash หาก Printer:

* ปิดเครื่อง
* IP หาย
* SNMP ปิด
* Timeout
* Return ข้อมูลไม่ครบ
* MIB ไม่รองรับ
* Network Error

ให้ระบบแสดง:

UNKNOWN

หรือ

UNSUPPORTED

แทนการ Crash

---

# 24. TESTING

สร้าง Tests สำหรับ:

SNMP Parser

Printer Detection

Status Calculation

Alert Rules

API

Database

Discovery

Monitoring

อย่างน้อยต้องมี Unit Tests สำคัญ

---

# 25. DOCKER

สร้าง:

docker-compose.yml

ประกอบด้วย:

frontend

backend

postgres

ถ้าจำเป็นให้เพิ่ม Redis

แต่ห้ามเพิ่ม Technology ที่ไม่จำเป็น

---

# 26. DEVELOPMENT MODE

ต้องสามารถรันได้ง่าย

ตัวอย่าง:

npm install

npm run dev

Backend:

python -m venv .venv

pip install -r requirements.txt

uvicorn app.main:app --reload

หรือเตรียม script ให้รันทั้งระบบด้วยคำสั่งเดียว

---

# 27. DEMO MODE

สำคัญมาก

สร้าง Demo Mode สำหรับกรณีไม่มี Printer จริง

เช่น:

DEMO_MODE=true

ระบบจะสร้าง Printer จำลอง:

FUJIFILM Apeos 4620 SZ
Brother HL-L6415DW
HP LaserJet
Canon imageRUNNER
Ricoh MFP

และสุ่ม:

Online

Offline

Warning

Toner

Drum

Page Counter

เพื่อให้สามารถเปิด Dashboard และนำเสนอได้โดยไม่ต้องมี Printer จริง

แต่ต้องแยก Demo Service ออกจาก Production Monitoring Service อย่างชัดเจน

---

# 28. LOGGING

Backend ต้องมี Structured Logging

ตัวอย่าง:

INFO Printer monitoring started

INFO SNMP poll success

WARNING SNMP timeout

WARNING Printer offline

ERROR SNMP error

ต้องไม่ Log Password หรือ SNMP credential

---

# 29. DOCUMENTATION

สร้าง README.md ภาษาไทย

ต้องอธิบาย:

1. Project คืออะไร
2. Architecture
3. Installation
4. Environment Variables
5. Database
6. SNMP
7. Discovery
8. Monitoring
9. Demo Mode
10. Production Mode
11. Troubleshooting

สร้าง:

docs/
architecture.md
snmp.md
api.md
deployment.md

---

# 30. IMPORTANT RULES

## ห้ามทำ

ห้ามสร้างแค่ Frontend Mockup

ห้าม Hardcode Printer จำนวนมากใน Frontend

ห้ามใช้ข้อมูล Mock เป็นข้อมูลหลักใน Production

ห้ามเดา SNMP OID ของ Vendor

ห้ามเขียนทุกอย่างในไฟล์เดียว

ห้ามใช้ setInterval ใน Frontend เป็นตัว Monitoring หลัก

ห้ามให้ Browser ยิง SNMP โดยตรง

ห้ามเก็บ Secret ใน Frontend

---

# 31. DEVELOPMENT STRATEGY

ให้ทำงานเป็น Phase

## PHASE 1

สร้าง:

Project

Frontend

Backend

Database

Authentication

Dashboard

Printer CRUD

Demo Mode

ต้องรันได้ก่อน

## PHASE 2

สร้าง:

SNMP Engine

Printer Polling

Status

Supplies

Counter

## PHASE 3

สร้าง:

Auto Discovery

CIDR Scanner

SNMP Discovery

## PHASE 4

สร้าง:

Alert Engine

History

Charts

WebSocket

## PHASE 5

สร้าง:

Groups

Import / Export

User Management

Audit Logs

## PHASE 6

สร้าง:

Docker

Production Configuration

Testing

Documentation

---

# 32. WORKFLOW ที่ต้องการ

เมื่อ User เปิดระบบ:

Login

↓

Dashboard

↓

ดูจำนวน Printer

↓

กด Devices

↓

Search / Filter

↓

กด Printer

↓

ดูรายละเอียด

↓

ดู Toner / Drum / Counter

↓

ดู History

↓

ถ้ามีปัญหา

↓

สร้าง Alert

↓

Dashboard Update แบบ Real-time

---

# 33. ACCEPTANCE CRITERIA

ถือว่างานเสร็จเมื่อ:

[ ] Frontend รันได้

[ ] Backend รันได้

[ ] Database ทำงาน

[ ] Login ทำงาน

[ ] Dashboard ทำงาน

[ ] Printer CRUD ทำงาน

[ ] Demo Mode ทำงาน

[ ] สามารถเพิ่ม Printer ด้วย IP

[ ] สามารถ Ping Printer

[ ] สามารถ SNMP Poll Printer

[ ] สามารถอ่าน Printer Status

[ ] สามารถอ่าน Supplies

[ ] สามารถอ่าน Counter

[ ] Auto Discovery ทำงาน

[ ] Alert ทำงาน

[ ] History ทำงาน

[ ] WebSocket ทำงาน

[ ] Search ทำงาน

[ ] Filter ทำงาน

[ ] Group ทำงาน

[ ] Import/Export ทำงาน

[ ] Role Permission ทำงาน

[ ] Audit Log ทำงาน

[ ] Docker ทำงาน

[ ] README ครบ

[ ] ไม่มี Critical Error

---

# 34. วิธีการทำงานของ CLI

อย่าถามคำถามที่ไม่จำเป็น

ให้ตรวจสอบ Repository ปัจจุบันก่อน

ถ้ามี Project เดิมอยู่แล้ว:

1. อ่านโครงสร้าง Project
2. ตรวจสอบ Technology เดิม
3. ตรวจสอบโค้ดเดิม
4. Reuse สิ่งที่ดี
5. ห้ามลบของเดิมโดยไม่จำเป็น
6. Refactor เมื่อจำเป็น
7. ทำให้ระบบเดิมยังใช้งานได้

ถ้ายังไม่มี Project:

สร้าง Project ใหม่ตาม Specification นี้

ก่อนเริ่ม Coding ให้สร้าง:

PLAN.md

อธิบาย:

* Architecture
* Database
* API
* Monitoring Flow
* SNMP Flow
* Folder Structure
* Development Phases

จากนั้นเริ่มลงมือสร้างจริง

---

# 35. FINAL REQUIREMENT

ผมไม่ได้ต้องการเพียง Design

ผมต้องการ **ระบบที่รันได้จริง**

ดังนั้น:

อ่าน Requirement ทั้งหมด

ตรวจสอบ Project

วางแผน

สร้าง Files

เขียน Code

ติดตั้ง Dependencies

Run Build

Run Tests

แก้ Error

Run Application

ตรวจสอบ API

ตรวจสอบ Frontend

ตรวจสอบ Database

จากนั้นสรุป:

* สิ่งที่สร้าง
* วิธี Run
* Default Login
* Port
* Environment Variables
* สิ่งที่ยังไม่รองรับ
* วิธีเชื่อม Printer จริง

หากมีส่วนใดที่ยังไม่สามารถทำงานกับ Printer จริงได้เนื่องจากไม่มี OID/MIB ที่ยืนยันได้ **อย่าสร้างข้อมูลปลอมเพื่อหลอกว่าใช้งานได้** ให้สร้าง Interface/Adapter รองรับไว้ และระบุชัดเจนว่าส่วนใดต้องเพิ่ม Vendor MIB ภายหลัง

เป้าหมายคือ:

**Production-ready Printer Monitoring Platform ที่มีแนวคิดใกล้เคียง BRAdmin Professional 4 แต่เป็นระบบของเราเอง**
