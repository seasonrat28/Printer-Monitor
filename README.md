# Printer Monitor

ระบบตรวจสอบและจัดการเครื่องพิมพ์ผ่านโปรโตคอล SNMP 

## คุณสมบัติหลัก (Features)
- 📊 **Dashboard 실시간:** ดูสถานะหมึกพิมพ์ กระดาษ และสถานะเครือข่ายของเครื่องพิมพ์แบบ Real-time
- 🔍 **SNMP Polling:** ดึงข้อมูลจากเครื่องพิมพ์ทุกรุ่นที่รองรับมาตรฐาน SNMP
- 🔔 **Alerts & Notifications:** แจ้งเตือนผ่าน LINE Notify / Email เมื่อหมึกใกล้หมดหรือเครื่องพิมพ์มีปัญหา
- 📁 **CSV Import/Export:** นำเข้าและส่งออกข้อมูลเครื่องพิมพ์เพื่อความสะดวกในการจัดการ
- 🌓 **Dark Mode:** รองรับโหมดกลางคืนเพื่อถนอมสายตา
- 🔒 **Role-Based Access Control:** ควบคุมสิทธิ์การใช้งาน (Admin / Viewer)

## การติดตั้งและการใช้งาน (Installation & Usage)
อ้างอิงจากโฟลเดอร์ `docs/` สำหรับข้อมูลเพิ่มเติม:
- [สถาปัตยกรรมระบบ (Architecture)](./docs/architecture.md)
- [คู่มือ API (API Documentation)](./docs/api.md)
- [ข้อมูล SNMP (SNMP Implementation)](./docs/snmp.md)
- [การติดตั้งใช้งาน (Deployment Guide)](./docs/deployment.md)

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
