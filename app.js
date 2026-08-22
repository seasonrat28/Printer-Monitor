// --- Global State ---
let printers = [];
let settings = JSON.parse(localStorage.getItem('app_settings')) || {
  tonerThreshold: 15,
  refreshInterval: 30,
  theme: 'light',
  apiUrl: '/api/printers' // ดึงจาก localhost พอร์ตเดียวกัน
};

let autoRefreshTimer = null;

// --- DOM Elements ---
const printerGrid = document.getElementById('printerGrid');
const searchInput = document.getElementById('searchInput');
const filterStatus = document.getElementById('filterStatus');
const filterLocation = document.getElementById('filterLocation');
const themeToggle = document.getElementById('themeToggle');

// Modals
const modalAddPrinter = document.getElementById('modalAddPrinter');
const modalScan = document.getElementById('modalScan');
const modalSettings = document.getElementById('modalSettings');

// Counters
const countTotal = document.getElementById('countTotal');
const countReady = document.getElementById('countReady');
const countWarning = document.getElementById('countWarning');
const countError = document.getElementById('countError');

// --- Real Data API Fetching ---
async function fetchRealPrinterData() {
  try {
    const response = await fetch(settings.apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    // คงค่า Favorite จาก LocalStorage ไว้
    const savedFavorites = JSON.parse(localStorage.getItem('printer_favorites')) || {};
    printers = data.map(p => ({
      ...p,
      isFavorite: !!savedFavorites[p.id]
    }));

    renderDashboard();
  } catch (error) {
    console.error('ไม่สามารถดึงข้อมูล SNMP จาก Server ได้:', error);
    if (printerGrid && printers.length === 0) {
      printerGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--danger);">
          <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 1rem;"></i>
          <p>ไม่สามารถเชื่อมต่อกับ Backend API (${settings.apiUrl}) ได้</p>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem;">โปรดตรวจสอบว่าได้สั่งรัน node server.js แล้วหรือยัง</p>
        </div>
      `;
    }
  }
}

// --- UI Rendering ---

function getStatusBadge(status) {
  switch (status) {
    case 'ready':
      return '<span class="badge ready"><i class="fa-solid fa-circle-check"></i> พร้อมใช้งาน</span>';
    case 'warning':
      return '<span class="badge warning"><i class="fa-solid fa-triangle-exclamation"></i> หมึกใกล้หมด</span>';
    case 'error':
      return '<span class="badge error"><i class="fa-solid fa-circle-xmark"></i> หมึกหมด / มีปัญหา</span>';
    default:
      return '<span class="badge offline"><i class="fa-solid fa-power-off"></i> ออฟไลน์</span>';
  }
}

function getProgressColorClass(percent) {
  if (percent <= settings.tonerThreshold) return 'red';
  if (percent <= 30) return 'amber';
  return 'green';
}

function renderDashboard() {
  if (!printerGrid) return;
  printerGrid.innerHTML = '';

  const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
  const statusFilter = filterStatus ? filterStatus.value : 'all';
  const locationFilter = filterLocation ? filterLocation.value : 'all';

  let readyCount = 0, warningCount = 0, errorCount = 0;

  // Filter & Count
  const filtered = printers.filter(printer => {
    if (printer.status === 'ready') readyCount++;
    if (printer.status === 'warning') warningCount++;
    if (printer.status === 'error' || printer.status === 'offline') errorCount++;

    const matchSearch = printer.name.toLowerCase().includes(searchTerm) || 
                        printer.ip.includes(searchTerm) || 
                        (printer.location && printer.location.toLowerCase().includes(searchTerm));
    const matchStatus = statusFilter === 'all' || printer.status === statusFilter;
    const matchLocation = locationFilter === 'all' || printer.location === locationFilter;

    return matchSearch && matchStatus && matchLocation;
  });

  // Update Counters
  if (countTotal) countTotal.textContent = printers.length;
  if (countReady) countReady.textContent = readyCount;
  if (countWarning) countWarning.textContent = warningCount;
  if (countError) countError.textContent = errorCount;

  if (filtered.length === 0) {
    printerGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-secondary);">ไม่พบข้อมูลเครื่องพิมพ์ที่ตรงตามเงื่อนไข</div>';
    return;
  }

  // Render Printer Cards
  filtered.forEach(printer => {
    const card = document.createElement('div');
    card.className = 'printer-card';
    card.innerHTML = `
      <div class="printer-card-header">
        <div>
          <div class="printer-name">${printer.name}</div>
          <div class="printer-ip"><i class="fa-solid fa-network-wired"></i> ${printer.ip} ${printer.location ? '| ' + printer.location : ''}</div>
        </div>
        <button class="favorite-btn ${printer.isFavorite ? 'active' : ''}" onclick="toggleFavorite('${printer.id}')" title="รายการโปรด">
          <i class="fa-${printer.isFavorite ? 'solid' : 'regular'} fa-star"></i>
        </button>
      </div>

      <div>${getStatusBadge(printer.status)}</div>

      <div class="supply-item">
        <div class="supply-label">
          <span><i class="fa-solid fa-droplet"></i> ผงหมึก (Toner)</span>
          <strong>${printer.toner}%</strong>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${getProgressColorClass(printer.toner)}" style="width: ${printer.toner}%;"></div>
        </div>
      </div>

      <div class="supply-item">
        <div class="supply-label">
          <span><i class="fa-solid fa-compact-disc"></i> แม่แบบสร้างภาพ (Drum)</span>
          <strong>${printer.drum}%</strong>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${getProgressColorClass(printer.drum)}" style="width: ${printer.drum}%;"></div>
        </div>
      </div>

      <div style="font-size: 0.75rem; color: var(--text-secondary); display: flex; justify-content: space-between; margin-top: 0.5rem;">
        <span>S/N: ${printer.serialNumber || 'N/A'}</span>
        <span>อัปเดต: ${printer.lastUpdated || '-'}</span>
      </div>

      <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
        <button class="btn btn-secondary" style="flex: 1; padding: 0.4rem; font-size: 0.85rem;" onclick="fetchRealPrinterData()">
          <i class="fa-solid fa-rotate"></i> รีเฟรช
        </button>
      </div>
    `;
    printerGrid.appendChild(card);
  });

  updateLocationDropdownOptions();
}

function updateLocationDropdownOptions() {
  if (!filterLocation) return;
  const currentLocation = filterLocation.value;
  const locations = [...new Set(printers.map(p => p.location).filter(Boolean))];
  
  filterLocation.innerHTML = '<option value="all">ทุกสถานที่/แผนก</option>';
  locations.forEach(loc => {
    const opt = document.createElement('option');
    opt.value = loc;
    opt.textContent = loc;
    if (loc === currentLocation) opt.selected = true;
    filterLocation.appendChild(opt);
  });
}

// --- Local Actions ---

function toggleFavorite(id) {
  const savedFavorites = JSON.parse(localStorage.getItem('printer_favorites')) || {};
  savedFavorites[id] = !savedFavorites[id];
  localStorage.setItem('printer_favorites', JSON.stringify(savedFavorites));
  
  const target = printers.find(p => p.id === id);
  if (target) {
    target.isFavorite = savedFavorites[id];
    renderDashboard();
  }
}

function toggleTheme() {
  const currentTheme = document.body.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', newTheme);
  settings.theme = newTheme;
  localStorage.setItem('app_settings', JSON.stringify(settings));
}

function startAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  const intervalMs = (settings.refreshInterval || 30) * 1000;
  autoRefreshTimer = setInterval(fetchRealPrinterData, intervalMs);
}

// --- Modal Helper Functions ---
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  if (settings.theme === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
  }

  // Clear ค่า apiUrl เก่าใน LocalStorage เพื่อบังคับใช้ Relative Path ล่าสุด
  if (settings.apiUrl !== '/api/printers') {
    settings.apiUrl = '/api/printers';
    localStorage.setItem('app_settings', JSON.stringify(settings));
  }

  // Event Listeners
  if (searchInput) searchInput.addEventListener('input', renderDashboard);
  if (filterStatus) filterStatus.addEventListener('change', renderDashboard);
  if (filterLocation) filterLocation.addEventListener('change', renderDashboard);
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

  // Initial Fetch & Auto Refresh Setup
  fetchRealPrinterData();
  startAutoRefresh();
});