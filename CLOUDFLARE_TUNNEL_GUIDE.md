# 🌐 คู่มือ: วิธีเปิดเว็บในเครื่องให้คนภายนอกเข้าใช้งาน (ผ่าน Cloudflare Tunnel)

> **ข้อดี:** ไม่ต้องตั้งค่า Forward Port บน Router, ไม่ต้องมี Public IP, ฟรี 100%, ใช้งานได้ทั้งเน็ตบ้าน เน็ตหอพัก และเน็ตมือถือ

---

## 📌 ขั้นตอนที่ 1: เตรียมโปรแกรม `cloudflared.exe`

1. ดาวน์โหลดไฟล์โปรแกรมสำหรับ Windows (Direct Download):
   👉 [คลิกเพื่อดาวน์โหลด cloudflared-windows-amd64.exe](https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe)
2. เมื่อดาวน์โหลดเสร็จแล้ว ให้ **เปลี่ยนชื่อไฟล์เป็น `cloudflared.exe`**
3. นำไฟล์ `cloudflared.exe` ไปวางไว้ในโฟลเดอร์โปรเจกต์ของคุณ

---

## 📌 ขั้นตอนที่ 2: ตรวจสอบพอร์ต (Port) ของเว็บที่รันอยู่

ตรวจสอบว่าเว็บหรือแอพของคุณรันอยู่ที่พอร์ต (Port) อะไร เช่น:
- **React / Vite Dev Server:** `http://localhost:5173`
- **React / Vite Preview Server:** `http://localhost:4173`
- **Node.js / Express / Next.js:** `http://localhost:3000`
- **Python (FastAPI / Django / Flask):** `http://localhost:8000` หรือ `5000`

---

## 📌 ขั้นตอนที่ 3: เปิดหน้าต่าง Terminal หรือ PowerShell

1. เปิดโฟลเดอร์ที่มีไฟล์ `cloudflared.exe` วางอยู่
2. คลิกที่ช่อง Address Bar (แถบที่อยู่ด้านบนของ File Explorer)
3. พิมพ์คำว่า `powershell` หรือ `cmd` แล้วกด **Enter**

---

## 📌 ขั้นตอนที่ 4: พิมพ์คำสั่งเพื่อเปิดใช้งาน

พิมพ์คำสั่งด้านล่างนี้ลงไป (เปลี่ยนเลขพอร์ตตามระบบของคุณ เช่น `3000` หรือ `5173`):

```powershell
.\cloudflared.exe tunnel --url http://localhost:3000
```

> **ตัวอย่าง:** หากเว็บรันอยู่ที่พอร์ต 5173 ให้ใช้คำสั่ง:
> `.\cloudflared.exe tunnel --url http://localhost:5173`

---

## 📌 ขั้นตอนที่ 5: นำลิงก์ส่งให้คนอื่นเข้าใช้งาน

1. รอประมาณ 3-5 วินาที ในหน้าต่าง Terminal จะแสดงข้อความหลายบรรทัด
2. ให้มองหาบรรทัดที่มีข้อความลักษณะนี้:
   ```text
   Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):
   https://random-word-name.trycloudflare.com
   ```
3. **คัดลอกลิงก์ `https://...trycloudflare.com`** นั้นส่งให้คนอื่นเข้าเปิดในมือถือหรือคอมเครื่องไหนก็ได้ทันที

---

## 💡 สิ่งที่ควรรู้และวิธีปิดการทำงาน

- **การปิดใช้งาน:** กดปุ่ม `Ctrl + C` ในหน้าต่าง Terminal ลิงก์จะปิดตัวลงทันที
- **การเปลี่ยนลิงก์:** โหมด Quick Tunnel แบบฟรีนี้ ลิงก์ URL จะถูกสุ่มใหม่ทุกครั้งที่เปิดคำสั่งขึ้นมาใหม่

---

## 🛠️ วิธีแก้ปัญหาที่พบบ่อย

### 1. เปิดลิงก์แล้วขึ้นหน้าขาว: "Blocked request. This host is not allowed"
เกิดจากระบบความปลอดภัยของ Web Framework บางตัวบล็อก Host Header ภายนอก:

- **กรณีใช้ Vite (`vite.config.js` หรือ `vite.config.ts`):**  
  ให้เพิ่ม `allowedHosts: true` ดังนี้:
  ```javascript
  import { defineConfig } from 'vite'
  import react from '@vitejs/plugin-react'

  export default defineConfig({
    plugins: [react()],
    server: {
      allowedHosts: true
    },
    preview: {
      allowedHosts: true
    }
  })
  ```
  *(เมื่อบันทึกไฟล์แล้ว ให้ปิดแล้วรัน Vite ใหม่อีกครั้ง)*

- **กรณีใช้ Django (`settings.py`):**  
  ```python
  ALLOWED_HOSTS = ['*']
  ```

- **กรณีใช้ Next.js:**  
  สามารถเข้าใช้งานได้ทันที ไม่ติดปัญหานี้
