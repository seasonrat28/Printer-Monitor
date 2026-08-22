const express = require('express');
const snmp = require('net-snmp');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ให้ Express ให้บริการไฟล์ static (html, css, js) จากโฟลเดอร์ปัจจุบัน
app.use(express.static(__dirname));

// รายชื่อ IP เครื่องพิมพ์ Fuji Film Apeos 4620 SZ ในระบบจริง
const PRINTER_LIST = [

];

// OIDs มาตรฐานสำหรับ Fuji Film / Standard Printer MIB
const OIDS = {
  tonerMax: '1.3.6.1.2.1.43.11.1.1.8.1.1',     
  tonerCurrent: '1.3.6.1.2.1.43.11.1.1.9.1.1', 
  drumMax: '1.3.6.1.2.1.43.11.1.1.8.1.2',      
  drumCurrent: '1.3.6.1.2.1.43.11.1.1.9.1.2',  
  serialNumber: '1.3.6.1.2.1.43.5.1.1.17.1'    
};

function fetchPrinterSNMP(printer) {
  return new Promise((resolve) => {
    const session = snmp.createSession(printer.ip, 'public', { timeout: 2000 });
    const oidsToFetch = [OIDS.tonerMax, OIDS.tonerCurrent, OIDS.drumMax, OIDS.drumCurrent, OIDS.serialNumber];

    session.get(oidsToFetch, (error, varbinds) => {
      if (error) {
        resolve({
          ...printer,
          status: 'offline',
          toner: 0,
          drum: 0,
          serialNumber: 'Unknown',
          lastUpdated: new Date().toLocaleTimeString('th-TH')
        });
      } else {
        const tonerMax = varbinds[0].value;
        const tonerCur = varbinds[1].value;
        const drumMax = varbinds[2].value;
        const drumCur = varbinds[3].value;
        const sn = varbinds[4].value ? varbinds[4].value.toString() : 'N/A';

        const tonerPercent = tonerMax > 0 ? Math.round((tonerCur / tonerMax) * 100) : 0;
        const drumPercent = drumMax > 0 ? Math.round((drumCur / drumMax) * 100) : 0;

        let status = 'ready';
        if (tonerPercent <= 0) status = 'error';
        else if (tonerPercent <= 15) status = 'warning';

        resolve({
          ...printer,
          status: status,
          toner: tonerPercent,
          drum: drumPercent,
          serialNumber: sn,
          lastUpdated: new Date().toLocaleTimeString('th-TH')
        });
      }
      session.close();
    });
  });
}

// Route API
app.get('/api/printers', async (req, res) => {
  const promises = PRINTER_LIST.map(p => fetchPrinterSNMP(p));
  const results = await Promise.all(promises);
  res.json(results);
});

// Route หลักสำหรับเข้าหน้าเว็บ localhost
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`Server running at: http://localhost:${PORT}`);
  console.log(`==================================================`);
});