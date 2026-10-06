# Printer Monitor

ระบบตรวจสอบและจัดการเครื่องพิมพ์ผ่านโปรโตคอล SNMP 

## คุณสมบัติหลัก (Features)
- 📊 **Dashboard 실시간:** ดูสถานะหมึกพิมพ์ กระดาษ และสถานะเครือข่ายของเครื่องพิมพ์แบบ Real-time
- 🔍 **Web Scraping:** ดึงข้อมูลจากเครื่องพิมพ์ผ่านหน้าเว็บ (HTTP) แทนระบบ SNMP ดั้งเดิม
- 🔔 **Alerts & Notifications:** แจ้งเตือนผ่านหน้า Dashboard เมื่อหมึกใกล้หมด (Toner ดำ, Drum เทา) หรือเครื่องพิมพ์มีปัญหา
- 📁 **CSV Import/Export:** นำเข้าและส่งออกข้อมูลเครื่องพิมพ์เพื่อความสะดวกในการจัดการ
- 🌓 **Dark Mode:** รองรับโหมดกลางคืนเพื่อถนอมสายตา
- 🔒 **Role-Based Access Control:** ควบคุมสิทธิ์การใช้งาน (Admin / Viewer)

## การติดตั้งและการใช้งาน (Installation & Usage)
อ้างอิงจากโฟลเดอร์ `docs/` สำหรับข้อมูลเพิ่มเติม:
- [สถาปัตยกรรมระบบ (Architecture)](./docs/architecture.md)
- [คู่มือ API (API Documentation)](./docs/api.md)
- [ข้อมูล SNMP (SNMP Implementation)](./docs/snmp.md)
- [การติดตั้งใช้งาน (Deployment Guide)](./docs/deployment.md)

## Windows Launcher (No PowerShell)

This project does not require PowerShell to start, ensuring compatibility with strict Endpoint Security systems (like Sangfor).

- **Start All (CMD Window):** `start_all.bat` (รันทั้ง 2 ระบบในหน้าต่างเดียว)
- **Start Hidden (No Window):** `start_hidden.vbs` (รันระบบซ่อนอยู่เบื้องหลัง)
- **Stop All:** `stop_all.bat` (สั่งปิดการทำงานทั้งหมด)

### Production Network Details
- **Monitoring Server:** `10.119.43.25`
- **Data Source:** `HTTP (Web Interface)`
- **Backend API:** `Port 8000`
- **Frontend App:** `Port 4173`

### Troubleshooting: Endpoint Security Block
If the launcher fails or the processes (`python.exe`, `node.exe`) are blocked by your antivirus/Sangfor endpoint security, please contact your organization administrator to whitelist or approve the application according to the security policy.

## สำหรับผู้พัฒนา (For Developers)

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
python -m app.main
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Production Deployment (Docker)

You can deploy the entire stack using Docker Compose:

```bash
docker-compose up -d --build
```

This will start:

- Backend API on port `8000`
- Frontend UI (Nginx) on port `80`
- SQLite Database persisted in a Docker Volume
