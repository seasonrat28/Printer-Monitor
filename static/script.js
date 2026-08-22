// ============================================
// PRINTER MONITOR SYSTEM - COMPLETE FULL VERSION
// Features: Export CSV + Visual Alerts + Search/Filter
// ============================================

// NOTIFICATION SYSTEM
class NotificationManager {
    constructor() {
        this.container = document.getElementById('toastContainer');
        this.notificationPermission = 'default';
        this.checkNotificationPermission();
    }

    async checkNotificationPermission() {
        if ('Notification' in window) {
            this.notificationPermission = Notification.permission;
        }
    }

    async requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            this.notificationPermission = permission;
            return permission === 'granted';
        }
        return Notification.permission === 'granted';
    }

    showBrowserNotification(title, message) {
        if ('Notification' in window && this.notificationPermission === 'granted') {
            new Notification(title, {
                body: message,
                icon: '/static/favicon.ico',
                tag: 'printer-alert',
                requireInteraction: false
            });
        }
    }

    show(message, type = 'info', duration = 4000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icon = this.getIcon(type);
        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-message">${message}</div>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        this.container.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, duration);
        
        return toast;
    }

    getIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
            alert: '🔔'
        };
        return icons[type] || icons.info;
    }

    success(message) { return this.show(message, 'success'); }
    error(message) { return this.show(message, 'error', 6000); }
    warning(message) { return this.show(message, 'warning', 5000); }
    info(message) { return this.show(message, 'info'); }
    alert(message) { return this.show(message, 'alert', 6000); }
}

// LOADING MANAGER
class LoadingManager {
    constructor() {
        this.activeRequests = new Map();
    }

    show(sectionId, message = 'กำลังโหลด...') {
        const controller = new AbortController();
        this.activeRequests.set(sectionId, controller);
        
        const loadingEl = document.getElementById(`${sectionId}Loading`);
        if (loadingEl) {
            loadingEl.style.display = 'block';
            loadingEl.innerHTML = `
                <div class="loading-content">
                    <div class="spinner"></div>
                    <p>${message}</p>
                    <button class="btn-cancel" onclick="printerMonitor.loadingManager.cancel('${sectionId}')">ยกเลิก</button>
                </div>
            `;
        }
        
        return controller.signal;
    }

    hide(sectionId) {
        const loadingEl = document.getElementById(`${sectionId}Loading`);
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
        
        this.activeRequests.delete(sectionId);
    }

    cancel(sectionId) {
        const controller = this.activeRequests.get(sectionId);
        if (controller) {
            controller.abort();
            this.hide(sectionId);
            printerMonitor.notifications.info('การโหลดถูกยกเลิก');
        }
    }

    isLoading(sectionId) {
        return this.activeRequests.has(sectionId);
    }
}

// ALERT MANAGER - Visual Alerts System
class AlertManager {
    constructor(notifications) {
        this.notifications = notifications;
        this.alerts = [];
        this.alertThresholds = { toner: 10, drum: 10 };
        this.notifiedIPs = new Set();
        this.browserNotificationsEnabled = false;
    }

    async enableBrowserNotifications() {
        const granted = await this.notifications.requestNotificationPermission();
        this.browserNotificationsEnabled = granted;
        if (granted) {
            this.notifications.success('เปิด Browser Notifications แล้ว');
        } else {
            this.notifications.warning('ไม่สามารถเปิด Browser Notifications ได้');
        }
        return granted;
    }

    checkPrinterAlerts(data) {
        this.alerts = [];
        const newAlerts = [];

        for (const [ip, info] of Object.entries(data)) {
            if (info.status !== 'online') continue;

            const alerts = [];

            if (info.toner !== null && info.toner <= this.alertThresholds.toner) {
                alerts.push({
                    type: 'toner',
                    level: info.toner <= 5 ? 'critical' : 'warning',
                    message: `Toner: ${info.toner}%`,
                    value: info.toner
                });
            }

            if (info.drum !== null && info.drum <= this.alertThresholds.drum) {
                alerts.push({
                    type: 'drum',
                    level: info.drum <= 5 ? 'critical' : 'warning',
                    message: `Drum: ${info.drum}%`,
                    value: info.drum
                });
            }

            if (info.device_status && info.device_status.level === 'error') {
                alerts.push({
                    type: 'device',
                    level: 'critical',
                    message: info.device_status.message,
                    value: 0
                });
            }

            if (alerts.length > 0) {
                const printerAlert = {
                    ip,
                    printer_name: info.printer_name || 'Unknown',
                    location: info.printer_location || '',
                    alerts,
                    maxLevel: alerts.some(a => a.level === 'critical') ? 'critical' : 'warning'
                };
                
                this.alerts.push(printerAlert);

                if (printerAlert.maxLevel === 'critical' && !this.notifiedIPs.has(ip)) {
                    newAlerts.push(printerAlert);
                    this.notifiedIPs.add(ip);
                }
            } else {
                this.notifiedIPs.delete(ip);
            }
        }

        this.updateAlertBadge();
        this.updateAlertPanel();

        if (newAlerts.length > 0 && this.browserNotificationsEnabled) {
            for (const alert of newAlerts) {
                const messages = alert.alerts.map(a => a.message).join(', ');
                this.notifications.showBrowserNotification(
                    `🔴 Printer Alert - ${alert.ip}`,
                    `${alert.printer_name}\n${messages}`
                );
            }
        }

        return this.alerts;
    }

    updateAlertBadge() {
        const badge = document.getElementById('alertBadge');
        if (!badge) return;

        const criticalCount = this.alerts.filter(a => a.maxLevel === 'critical').length;
        const totalCount = this.alerts.length;

        if (totalCount > 0) {
            badge.textContent = totalCount;
            badge.style.display = 'flex';
            badge.className = 'alert-badge';
            if (criticalCount > 0) {
                badge.classList.add('critical');
            }
        } else {
            badge.style.display = 'none';
        }
    }

    updateAlertPanel() {
        const panel = document.getElementById('alertPanel');
        if (!panel) return;

        if (this.alerts.length === 0) {
            panel.innerHTML = '<div class="no-alerts">✅ ไม่มีการแจ้งเตือน ทุกอย่างปกติ</div>';
            return;
        }

        const sortedAlerts = [...this.alerts].sort((a, b) => {
            if (a.maxLevel === 'critical' && b.maxLevel !== 'critical') return -1;
            if (a.maxLevel !== 'critical' && b.maxLevel === 'critical') return 1;
            return 0;
        });

        const html = sortedAlerts.map(alert => {
            const levelClass = alert.maxLevel === 'critical' ? 'alert-item-critical' : 'alert-item-warning';
            const levelIcon = alert.maxLevel === 'critical' ? '🔴' : '⚠️';
            const alertMessages = alert.alerts.map(a => `<div class="alert-detail">${a.message}</div>`).join('');

            return `
                <div class="alert-item ${levelClass}" onclick="printerMonitor.openPrinterIP('${alert.ip}')">
                    <div class="alert-header">
                        <span class="alert-icon">${levelIcon}</span>
                        <span class="alert-ip">${alert.ip}</span>
                        ${alert.printer_name ? `<span class="alert-name">${alert.printer_name}</span>` : ''}
                    </div>
                    <div class="alert-body">
                        ${alertMessages}
                        ${alert.location ? `<div class="alert-location">📍 ${alert.location}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        panel.innerHTML = html;
    }

    toggleAlertPanel() {
        const panelContainer = document.getElementById('alertPanelContainer');
        if (!panelContainer) return;

        if (panelContainer.classList.contains('show')) {
            panelContainer.classList.remove('show');
        } else {
            panelContainer.classList.add('show');
        }
    }

    getAlertCount() {
        return {
            total: this.alerts.length,
            critical: this.alerts.filter(a => a.maxLevel === 'critical').length,
            warning: this.alerts.filter(a => a.maxLevel === 'warning').length
        };
    }
}

// DATA MANAGER
class DataManager {
    constructor() {
        this.cache = new Map();
        this.sortedCache = new Map();
        this.maxCacheSize = 50;
    }

    ipToNum(ip) {
        return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
    }

    sortData(data, sortBy) {
        const entries = Object.entries(data);
        let sorted;

        switch (sortBy) {
            case 'ip-asc':
                sorted = entries.sort((a, b) => this.ipToNum(a[0]) - this.ipToNum(b[0]));
                break;
            case 'ip-desc':
                sorted = entries.sort((a, b) => this.ipToNum(b[0]) - this.ipToNum(a[0]));
                break;
            case 'toner-asc':
                sorted = entries.sort((a, b) => (a[1].toner ?? 0) - (b[1].toner ?? 0));
                break;
            case 'toner-desc':
                sorted = entries.sort((a, b) => (b[1].toner ?? 0) - (a[1].toner ?? 0));
                break;
            case 'drum-asc':
                sorted = entries.sort((a, b) => (a[1].drum ?? 0) - (b[1].drum ?? 0));
                break;
            case 'drum-desc':
                sorted = entries.sort((a, b) => (b[1].drum ?? 0) - (a[1].drum ?? 0));
                break;
            default:
                sorted = entries;
        }

        return Object.fromEntries(sorted);
    }

    filterData(data, filterType) {
        if (filterType === 'all') return data;
        
        const filtered = {};
        for (const [ip, info] of Object.entries(data)) {
            if (info.status === filterType) {
                filtered[ip] = info;
            }
        }
        return filtered;
    }

    searchData(data, searchText) {
        if (!searchText || searchText.trim() === '') return data;

        const search = searchText.toLowerCase().trim();
        const filtered = {};

        for (const [ip, info] of Object.entries(data)) {
            const matchIP = ip.toLowerCase().includes(search);
            const matchName = (info.printer_name || '').toLowerCase().includes(search);
            const matchLocation = (info.printer_location || '').toLowerCase().includes(search);

            if (matchIP || matchName || matchLocation) {
                filtered[ip] = info;
            }
        }

        return filtered;
    }

    filterBySupplyLevel(data, type, maxLevel) {
        const filtered = {};
        
        for (const [ip, info] of Object.entries(data)) {
            const value = info[type];
            if (value !== null && value !== undefined && value <= maxLevel) {
                filtered[ip] = info;
            }
        }

        return filtered;
    }

    getSupplyLevel(level) {
        if (level === null || level === undefined) return 'unknown';
        if (level >= 50) return 'high';
        if (level >= 11) return 'medium';
        return 'low';
    }
}

// FAVORITES MANAGER
class FavoritesManager {
    constructor(notifications = null) {
        this.notifications = notifications;
        this.favorites = [];
        this.recentIPsKey = 'recentIPs';
        this.maxRecent = 10;
        
        this.initialize();
    }

    async initialize() {
        await this.loadFavoritesFromServer();
        this.updateFavoritesList();
        this.loadRecentIPs();
    }

    async loadFavoritesFromServer() {
        try {
            const response = await fetch('/api/favorites');
            if (response.ok) {
                this.favorites = await response.json();
                return this.favorites;
            } else {
                this.favorites = [];
                return [];
            }
        } catch (error) {
            this.favorites = [];
            return [];
        }
    }

    async addFavorite(ip) {
        if (!this.isValidIP(ip)) {
            if (this.notifications) this.notifications.warning('IP Address ไม่ถูกต้อง');
            return false;
        }

        if (this.isFavorite(ip)) {
            if (this.notifications) this.notifications.info(`${ip} อยู่ในรายการโปรดอยู่แล้ว`);
            return false;
        }

        try {
            const response = await fetch('/api/favorites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip })
            });

            const result = await response.json();
            
            if (response.ok && result.success) {
                this.favorites.push(ip);
                this.updateFavoritesList();
                if (this.notifications) this.notifications.success(result.message);
                this.notifyFavoritesChanged();
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    async removeFavorite(ip) {
        try {
            const response = await fetch('/api/favorites', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip })
            });

            const result = await response.json();
            
            if (response.ok && result.success) {
                const index = this.favorites.indexOf(ip);
                if (index > -1) this.favorites.splice(index, 1);
                this.updateFavoritesList();
                if (this.notifications) this.notifications.info(result.message);
                this.notifyFavoritesChanged();
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    async toggleFavorite(ip) {
        return this.isFavorite(ip) ? await this.removeFavorite(ip) : await this.addFavorite(ip);
    }

    async clearAllFavorites() {
        if (this.favorites.length === 0) return false;
        if (!confirm(`คุณต้องการลบรายการโปรดทั้งหมด ${this.favorites.length} รายการใช่หรือไม่?`)) return false;

        try {
            const response = await fetch('/api/favorites/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await response.json();
            
            if (response.ok && result.success) {
                this.favorites = [];
                this.updateFavoritesList();
                if (this.notifications) this.notifications.success(result.message);
                this.notifyFavoritesChanged();
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    isFavorite(ip) {
        return this.favorites.includes(ip);
    }

    getFavorites() {
        return [...this.favorites];
    }

    saveRecentIP(ip) {
        if (!ip || ip.length < 7 || !this.isValidIP(ip, false)) return false;
        
        try {
            let recent = JSON.parse(localStorage.getItem(this.recentIPsKey) || '[]');
            recent = recent.filter(savedIp => savedIp !== ip);
            recent.unshift(ip);
            recent = recent.slice(0, this.maxRecent);
            localStorage.setItem(this.recentIPsKey, JSON.stringify(recent));
            return true;
        } catch (error) {
            return false;
        }
    }

    getRecentIPs() {
        try {
            const recent = localStorage.getItem(this.recentIPsKey);
            return recent ? JSON.parse(recent) : [];
        } catch (error) {
            return [];
        }
    }

    loadRecentIPs() {
        const recent = this.getRecentIPs();
        this.updateRecentIPsList(recent);
        return recent;
    }

    clearRecentIPs() {
        try {
            localStorage.removeItem(this.recentIPsKey);
            this.updateRecentIPsList([]);
            if (this.notifications) this.notifications.info('ล้างประวัติ IP ล่าสุดแล้ว');
            return true;
        } catch (error) {
            return false;
        }
    }

    updateFavoritesList() {
        const favoritesList = document.getElementById('favoritesList');
        if (!favoritesList) return;

        if (this.favorites.length === 0) {
            favoritesList.innerHTML = `
                <div class="no-favorites">
                    <p>📝 ไม่มีรายการโปรด</p>
                    <small>กดปุ่ม ⭐ ที่เครื่องพิมพ์เพื่อเพิ่มเข้ารายการโปรด</small>
                </div>
            `;
            return;
        }

        const favoritesHTML = this.favorites.map(ip => `
            <div class="favorite-item">
                <span class="favorite-ip" onclick="printerMonitor.openPrinterIP('${ip}')">⭐ ${ip}</span>
                <button class="btn-remove-favorite" onclick="printerMonitor.favoritesManager.removeFavorite('${ip}')">×</button>
            </div>
        `).join('');

        favoritesList.innerHTML = `
            <div class="favorites-header">
                <span class="favorites-count">${this.favorites.length} รายการ</span>
                <button class="btn-clear-all-favorites" onclick="printerMonitor.favoritesManager.clearAllFavorites()">🗑️</button>
            </div>
            <div class="favorites-items">${favoritesHTML}</div>
        `;
    }

    updateRecentIPsList(recentIPs = null) {
        const recentIPsList = document.getElementById('recentIPsList');
        if (!recentIPsList) return;

        const recent = recentIPs || this.getRecentIPs();
        
        if (recent.length === 0) {
            recentIPsList.innerHTML = '<p class="no-recent">ไม่มีประวัติ IP ล่าสุด</p>';
            return;
        }

        const recentHTML = recent.slice(0, 5).map(ip => `
            <div class="recent-ip-item" onclick="document.getElementById('singleIp').value='${ip}'">📌 ${ip}</div>
        `).join('');

        recentIPsList.innerHTML = `
            <div class="recent-header">
                <span>IP ล่าสุด</span>
                <button class="btn-clear-recent" onclick="printerMonitor.favoritesManager.clearRecentIPs()">🗑️</button>
            </div>
            ${recentHTML}
        `;
    }

    isValidIP(ip, strict = true) {
        if (!ip || typeof ip !== 'string') return false;
        
        if (strict) {
            const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
            return ipRegex.test(ip);
        } else {
            const parts = ip.split('.');
            return parts.length >= 2 && parts.length <= 4 && 
                   parts.every(part => /^\d{1,3}$/.test(part) && parseInt(part) <= 255);
        }
    }

    notifyFavoritesChanged() {
        const event = new CustomEvent('favoritesChanged', {
            detail: { favorites: this.getFavorites(), count: this.favorites.length }
        });
        window.dispatchEvent(event);
    }
}

// SECTION MANAGER
class SectionManager {
    constructor(sectionId, dataManager, notifications, favoritesManager) {
        this.sectionId = sectionId;
        this.dataManager = dataManager;
        this.notifications = notifications;
        this.favoritesManager = favoritesManager;
        this.data = {};
        this.filteredData = {};
        this.currentFilter = 'all';
        this.currentSort = 'ip-asc';
        this.currentSearchText = '';
        this.currentSupplyFilter = null;
    }

    updateData(newData) {
        this.data = newData;
        this.applyAllFilters();
    }

    applyAllFilters() {
        let filtered = this.data;
        filtered = this.dataManager.filterData(filtered, this.currentFilter);

        if (this.currentSearchText) {
            filtered = this.dataManager.searchData(filtered, this.currentSearchText);
        }

        if (this.currentSupplyFilter) {
            filtered = this.dataManager.filterBySupplyLevel(
                filtered,
                this.currentSupplyFilter.type,
                this.currentSupplyFilter.level
            );
        }

        this.filteredData = filtered;
        this.render();
    }

    setSearch(searchText) {
        this.currentSearchText = searchText;
        this.applyAllFilters();
    }

    setSupplyFilter(type, level) {
        if (type && level !== null) {
            this.currentSupplyFilter = { type, level };
        } else {
            this.currentSupplyFilter = null;
        }
        this.applyAllFilters();
    }

    clearAllFilters() {
        this.currentFilter = 'all';
        this.currentSearchText = '';
        this.currentSupplyFilter = null;
        
        const searchInput = document.getElementById(`${this.sectionId}Search`);
        if (searchInput) searchInput.value = '';
        
        const supplySelect = document.getElementById(`${this.sectionId}SupplyFilter`);
        if (supplySelect) supplySelect.value = 'none';
        
        this.applyAllFilters();
    }

    filterByStatus(status) {
        this.currentFilter = status;
        this.applyAllFilters();
    }

    applySort() {
        const sortSelect = document.getElementById(`${this.sectionId}FilterSelect`);
        if (sortSelect) {
            this.currentSort = sortSelect.value;
        }
        
        const sortedData = this.dataManager.sortData(this.filteredData, this.currentSort);
        this.renderGrid(sortedData);
    }

    render() {
        this.updateStats();
        this.applySort();
        this.updateFilterInfo();
    }

    updateStats() {
        const total = Object.keys(this.data).length;
        const online = Object.values(this.data).filter(d => d.status === 'online').length;
        const offline = total - online;

        const statsEl = document.getElementById(`${this.sectionId}Stats`);
        if (statsEl) {
            statsEl.innerHTML = `
                <div class="stat-item ${this.currentFilter === 'all' ? 'active' : ''}" onclick="printerMonitor.${this.sectionId}Section.filterByStatus('all')" tabindex="0">
                    <div class="stat-number">${total}</div>
                    <div class="stat-label">เครื่องทั้งหมด</div>
                </div>
                <div class="stat-item online-stat ${this.currentFilter === 'online' ? 'active' : ''}" onclick="printerMonitor.${this.sectionId}Section.filterByStatus('online')" tabindex="0">
                    <div class="stat-number">${online}</div>
                    <div class="stat-label">ออนไลน์</div>
                </div>
                <div class="stat-item offline-stat ${this.currentFilter === 'offline' ? 'active' : ''}" onclick="printerMonitor.${this.sectionId}Section.filterByStatus('offline')" tabindex="0">
                    <div class="stat-number">${offline}</div>
                    <div class="stat-label">ออฟไลน์</div>
                </div>
            `;
        }
    }

    renderGrid(data) {
        const gridEl = document.getElementById(`${this.sectionId}Grid`);
        if (!gridEl) return;

        if (Object.keys(data).length === 0) {
            gridEl.innerHTML = '<p class="no-data">ไม่พบข้อมูลเครื่องพิมพ์</p>';
            return;
        }

        let html = '';
        for (const [ip, info] of Object.entries(data)) {
            html += this.createPrinterCard(ip, info);
        }
        gridEl.innerHTML = html;
    }

    createPrinterCard(ip, data) {
        const statusClass = data.status === 'online' ? 'online' : 'offline';
        const statusBadge = data.status === 'online' ? 'status-online' : 'status-offline';
        const statusText = data.status === 'online' ? 'Online' : 'Offline';

        const tonerLevel = data.toner !== null ? data.toner : '?';
        const drumLevel = data.drum !== null ? data.drum : '?';

        const tonerClass = `level-${this.dataManager.getSupplyLevel(data.toner)}`;
        const drumClass = `level-${this.dataManager.getSupplyLevel(data.drum)}`;

        const tonerProgress = data.toner !== null ? data.toner : 0;
        const drumProgress = data.drum !== null ? data.drum : 0;

        const tonerProgressClass = `progress-${this.dataManager.getSupplyLevel(data.toner)}`;
        const drumProgressClass = `progress-${this.dataManager.getSupplyLevel(data.drum)}`;

        const printerName = data.printer_name || 'Unknown';
        const printerLocation = data.printer_location || '';
        const serialNumber = data.serial_number || '';
        const isFavorite = this.favoritesManager.isFavorite(ip);

        const isLowSupply = (data.toner !== null && data.toner <= 10) || (data.drum !== null && data.drum <= 10);
        const cardExtraClass = isLowSupply ? 'printer-card-alert' : '';

        let deviceStatusHTML = '';
        if (data.device_status && data.device_status.message) {
            const statusLevel = data.device_status.level || 'info';
            const statusColorClass = `device-status-${statusLevel}`;
            
            deviceStatusHTML = `
                <div class="device-status ${statusColorClass}">
                    <span class="device-status-label">Status:</span>
                    <span class="device-status-text">${data.device_status.message}</span>
                </div>
            `;
        }

        let locationHTML = '';
        if (printerLocation) {
            locationHTML = `<div class="printer-info-row"><span class="info-label">Location:</span> <span class="info-value">${printerLocation}</span></div>`;
        }

        let serialHTML = '';
        if (serialNumber) {
            serialHTML = `<div class="printer-info-row"><span class="info-label">Serial No.:</span> <span class="info-value">${serialNumber}</span></div>`;
        }

        return `
            <div class="printer-card ${statusClass} ${cardExtraClass}" tabindex="0">
                <div class="printer-card-main" onclick="printerMonitor.openPrinterIP('${ip}')">
                    <div class="printer-info-box">
                        <div class="printer-info-row">
                            <span class="printer-name">🖨️ ${printerName}</span>
                            <span class="status-badge ${statusBadge}">${statusText}</span>
                            <button class="favorite-btn-inline ${isFavorite ? 'active' : ''}" onclick="event.stopPropagation(); printerMonitor.favoritesManager.toggleFavorite('${ip}')" title="${isFavorite ? 'ลบออกจากรายการโปรด' : 'เพิ่มเข้ารายการโปรด'}">
                                ${isFavorite ? '⭐' : '☆'}
                            </button>
                        </div>
                        <div class="printer-info-row"><span class="info-label">IP:</span> <span class="info-value">${ip}</span></div>
                        ${locationHTML}
                        ${serialHTML}
                    </div>
                    ${deviceStatusHTML}
                    <div class="supplies">
                        <div class="supply-item">
                            <div class="supply-label">🧪 Toner</div>
                            <div class="supply-level ${tonerClass}">${tonerLevel}${data.toner !== null ? '%' : ''}</div>
                            <div class="progress-bar">
                                <div class="progress-fill ${tonerProgressClass}" style="width: ${tonerProgress}%"></div>
                            </div>
                        </div>
                        <div class="supply-item">
                            <div class="supply-label">🔧 Drum</div>
                            <div class="supply-level ${drumClass}">${drumLevel}${data.drum !== null ? '%' : ''}</div>
                            <div class="progress-bar">
                                <div class="progress-fill ${drumProgressClass}" style="width: ${drumProgress}%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="last-updated">⏰ อัปเดตล่าสุด: ${data.last_updated}</div>
                </div>
                <div class="log-toggle-area">
                    <button class="log-toggle-btn" data-ip="${ip}" onclick="event.stopPropagation(); printerMonitor.logManager.toggleCard('${ip}')">
                        📊 ดูประวัติ ▼
                    </button>
                </div>
                <div class="log-section" data-ip="${ip}" style="display:none;"></div>
            </div>
        `;
    }

    updateFilterInfo() {
        const filterInfo = document.getElementById(`${this.sectionId}FilterInfo`);
        const filterText = document.getElementById(`${this.sectionId}FilterText`);
        
        if (!filterInfo || !filterText) return;

        const hasFilters = this.currentFilter !== 'all' || this.currentSearchText || this.currentSupplyFilter;

        if (hasFilters) {
            filterInfo.classList.add('active');
            const count = Object.keys(this.filteredData).length;
            let text = `กำลังแสดง ${count} เครื่อง`;
            
            if (this.currentFilter !== 'all') {
                text += ` (${this.currentFilter === 'online' ? 'ออนไลน์' : 'ออฟไลน์'})`;
            }
            
            if (this.currentSearchText) {
                text += ` | ค้นหา: "${this.currentSearchText}"`;
            }
            
            if (this.currentSupplyFilter) {
                const type = this.currentSupplyFilter.type === 'toner' ? 'Toner' : 'Drum';
                text += ` | ${type} ≤ ${this.currentSupplyFilter.level}%`;
            }
            
            filterText.textContent = text;
        } else {
            filterInfo.classList.remove('active');
        }
    }

    clearFilter() {
        this.clearAllFilters();
    }

    clear() {
        this.data = {};
        this.filteredData = {};
        this.currentFilter = 'all';
        this.currentSearchText = '';
        this.currentSupplyFilter = null;
        
        const gridEl = document.getElementById(`${this.sectionId}Grid`);
        const statsEl = document.getElementById(`${this.sectionId}Stats`);
        const filterInfo = document.getElementById(`${this.sectionId}FilterInfo`);
        
        if (gridEl) gridEl.innerHTML = '';
        if (statsEl) statsEl.innerHTML = '';
        if (filterInfo) filterInfo.classList.remove('active');
    }
}

// AUTO REFRESH MANAGER
class AutoRefreshManager {
    constructor(callback) {
        this.interval = null;
        this.countdownInterval = null;
        this.callback = callback;
        this.isActive = false;
        this.currentInterval = 60000;
        this.remainingTime = 0;
        this.lastRefreshTime = 0;
        this.isPaused = false;
    }

    start(interval = 60000) {
        this.stop();
        
        this.currentInterval = interval;
        this.remainingTime = Math.floor(interval / 1000);
        this.lastRefreshTime = Date.now();
        this.isPaused = false;
        
        this.interval = setInterval(() => {
            if (this.callback && typeof this.callback.refreshDatabaseData === 'function') {
                this.callback.refreshDatabaseData();
            }
            this.remainingTime = Math.floor(this.currentInterval / 1000);
            this.lastRefreshTime = Date.now();
        }, interval);
        
        this.countdownInterval = setInterval(() => {
            if (!this.isPaused) {
                this.updateCountdown();
            }
        }, 1000);
        
        this.isActive = true;
        this.updateIndicator();
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        
        this.isActive = false;
        this.remainingTime = 0;
        this.isPaused = false;
        this.updateIndicator();
    }

    updateCountdown() {
        if (!this.isActive) return;
        
        const elapsed = Math.floor((Date.now() - this.lastRefreshTime) / 1000);
        this.remainingTime = Math.max(0, Math.floor(this.currentInterval / 1000) - elapsed);
        
        this.updateIndicator();
    }

    async toggle() {
        if (this.isActive) {
            this.stop();
            if (printerMonitor && printerMonitor.notifications) {
                printerMonitor.notifications.info('ปิด Auto Refresh แล้ว');
            }
        } else {
            try {
                const res = await fetch('/api/settings');
                if (!res.ok) throw new Error('Failed to fetch settings');
                
                const json = await res.json();
                const interval = json.refresh_interval ?? 60;
                
                this.start(interval * 1000);
                
                if (printerMonitor && printerMonitor.notifications) {
                    printerMonitor.notifications.success(`เปิด Auto Refresh ทุก ${interval} วินาที`);
                }
            } catch (err) {
                this.start(60000);
                if (printerMonitor && printerMonitor.notifications) {
                    printerMonitor.notifications.success('เปิด Auto Refresh ทุก 60 วินาที');
                }
            }
        }
    }

    updateIndicator() {
        const refreshBtn = document.querySelector('.icon-btn-auto-refresh');
        if (!refreshBtn) return;
        
        if (this.isActive) {
            const minutes = Math.floor(this.remainingTime / 60);
            const seconds = this.remainingTime % 60;
            const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            // เพิ่ม class active และ data-time
            refreshBtn.classList.add('active');
            refreshBtn.setAttribute('data-time', timeString);
            refreshBtn.innerHTML = '⏰';
        } else {
            // ลบ class active
            refreshBtn.classList.remove('active');
            refreshBtn.removeAttribute('data-time');
            refreshBtn.innerHTML = '⏰';
        }
        
        // ซ่อน indicator เดิม (ไม่ใช้แล้ว)
        const indicator = document.getElementById('autoRefreshIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    updateInterval(newInterval) {
        if (this.isActive) {
            this.start(newInterval * 1000);
            if (printerMonitor && printerMonitor.notifications) {
                printerMonitor.notifications.success(`อัปเดต Auto Refresh เป็นทุก ${newInterval} วินาที`);
            }
        }
    }

    pause() {
        this.isPaused = true;
    }

    resume() {
        this.isPaused = false;
    }
}

// EXPORT MANAGER
class ExportManager {
    exportToCSV(data, filename = 'printer_status.csv') {
        const headers = ['IP Address', 'Printer Name', 'Location', 'Serial No.', 'Status', 'Toner (%)', 'Drum (%)', 'Device Status', 'Last Updated'];
        const rows = Object.entries(data).map(([ip, info]) => [
            ip,
            info.printer_name || 'Unknown',
            info.printer_location || 'N/A',
            info.serial_number || 'N/A',
            info.status,
            info.toner ?? 'N/A',
            info.drum ?? 'N/A',
            info.device_status?.message || 'N/A',
            info.last_updated
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');

        this.downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
    }

    downloadFile(content, filename, mimeType) {
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// DEBOUNCE UTILITY
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================
// LOG MANAGER - จัดการประวัติ Toner/Drum
// ============================================
class LogManager {
    constructor() {
        this.logs = {};
        this.expandedCards = new Set();
        this.allExpanded = false;
    }

    async loadLogs() {
        try {
            const response = await fetch('/api/logs');
            if (response.ok) {
                this.logs = await response.json();
                this.refreshLogDisplay();
            }
        } catch (error) {
            console.error('Error loading logs:', error);
        }
    }

    getLogsForIP(ip) {
        return this.logs[ip] || { name: ip, logs: [] };
    }

    refreshLogDisplay() {
        // อัพเดท log ใน card ที่ expand อยู่
        this.expandedCards.forEach(ip => {
            const logSection = document.querySelector(`.log-section[data-ip="${ip}"]`);
            if (logSection) {
                logSection.innerHTML = this.renderLogContent(ip);
            }
        });
    }

    renderLogContent(ip) {
        const data = this.getLogsForIP(ip);
        const logs = data.logs || [];

        if (logs.length === 0) {
            return `
                <div class="log-empty">
                    <span>📭 ยังไม่มีประวัติ</span>
                    <small>กด 🔄 Refresh เพื่อเริ่มบันทึก</small>
                </div>
            `;
        }

        // แสดงจากใหม่ → เก่า
        const reversed = [...logs].reverse();

        const rows = reversed.map((entry, index) => {
            const isLatest = index === 0;
            const prev = reversed[index + 1];

            let tonerDiff = '';
            let drumDiff = '';

            if (prev && entry.toner !== null && prev.toner !== null) {
                const diff = entry.toner - prev.toner;
                if (diff !== 0) {
                    tonerDiff = `<span class="log-diff ${diff > 0 ? 'log-diff-up' : 'log-diff-down'}">${diff > 0 ? '+' : ''}${diff}%</span>`;
                }
            }

            if (prev && entry.drum !== null && prev.drum !== null) {
                const diff = entry.drum - prev.drum;
                if (diff !== 0) {
                    drumDiff = `<span class="log-diff ${diff > 0 ? 'log-diff-up' : 'log-diff-down'}">${diff > 0 ? '+' : ''}${diff}%</span>`;
                }
            }

            const tonerVal = entry.toner !== null ? `${entry.toner}%` : '?';
            const drumVal = entry.drum !== null ? `${entry.drum}%` : '?';

            return `
                <div class="log-row ${isLatest ? 'log-row-latest' : ''}">
                    <span class="log-datetime">${isLatest ? '🕐 ' : ''}${entry.datetime}</span>
                    <span class="log-toner">🖊 ${tonerVal} ${tonerDiff}</span>
                    <span class="log-drum">🔧 ${drumVal} ${drumDiff}</span>
                </div>
            `;
        }).join('');

        return `<div class="log-rows">${rows}</div>`;
    }

    toggleCard(ip) {
        const logSection = document.querySelector(`.log-section[data-ip="${ip}"]`);
        const btn = document.querySelector(`.log-toggle-btn[data-ip="${ip}"]`);
        if (!logSection || !btn) return;

        if (this.expandedCards.has(ip)) {
            // ซ่อน
            this.expandedCards.delete(ip);
            logSection.style.display = 'none';
            btn.innerHTML = '📊 ดูประวัติ ▼';
            btn.classList.remove('active');
        } else {
            // แสดง
            this.expandedCards.add(ip);
            logSection.innerHTML = this.renderLogContent(ip);
            logSection.style.display = 'block';
            btn.innerHTML = '📊 ซ่อนประวัติ ▲';
            btn.classList.add('active');
        }
    }

    expandAll() {
        this.allExpanded = !this.allExpanded;
        const btn = document.getElementById('expandAllBtn');

        document.querySelectorAll('.log-section').forEach(section => {
            const ip = section.getAttribute('data-ip');
            if (!ip) return;

            if (this.allExpanded) {
                this.expandedCards.add(ip);
                section.innerHTML = this.renderLogContent(ip);
                section.style.display = 'block';
                const toggleBtn = document.querySelector(`.log-toggle-btn[data-ip="${ip}"]`);
                if (toggleBtn) {
                    toggleBtn.innerHTML = '📊 ซ่อนประวัติ ▲';
                    toggleBtn.classList.add('active');
                }
            } else {
                this.expandedCards.delete(ip);
                section.style.display = 'none';
                const toggleBtn = document.querySelector(`.log-toggle-btn[data-ip="${ip}"]`);
                if (toggleBtn) {
                    toggleBtn.innerHTML = '📊 ดูประวัติ ▼';
                    toggleBtn.classList.remove('active');
                }
            }
        });

        if (btn) {
            btn.innerHTML = this.allExpanded ? '📋 ย่อทั้งหมด' : '📋 ขยายทั้งหมด';
            btn.classList.toggle('active', this.allExpanded);
        }
    }
}

// MAIN PRINTER MONITOR CLASS
class PrinterMonitor {
    constructor() {
        this.notifications = new NotificationManager();
        this.loadingManager = new LoadingManager();
        this.dataManager = new DataManager();
        this.autoRefreshManager = new AutoRefreshManager(this);
        this.exportManager = new ExportManager();
        this.alertManager = new AlertManager(this.notifications);
        this.logManager = new LogManager();  // เพิ่ม LogManager
        
        this.favoritesManager = new FavoritesManager(this.notifications);
        
        this.searchSection = new SectionManager('search', this.dataManager, this.notifications, this.favoritesManager);
        this.databaseSection = new SectionManager('database', this.dataManager, this.notifications, this.favoritesManager);
        
        this.printerDB = [];
        this.blacklist = [];
        this.favorites = this.favoritesManager.getFavorites();
        
        this.searchController = null;
        this.databaseController = null;
        
        this.debouncedSearchSingle = debounce(this.performSingleSearch.bind(this), 300);
        this.debouncedSearchRange = debounce(this.performRangeSearch.bind(this), 500);
        
        this.initialize();
    }

    async initialize() {
        try {
            await this.loadConfiguration();
            this.bindEvents();
            this.loadDatabaseData();
            this.logManager.loadLogs();  // โหลด log ตอนเริ่ม
            this.listenForSettingsUpdates();
            this.listenForFavoritesChanges();
            this.setupVisibilityChange();
            this.notifications.success('ระบบพร้อมใช้งาน');
        } catch (error) {
            this.notifications.error('เกิดข้อผิดพลาดในการเริ่มต้นระบบ: ' + error.message);
        }
    }

    async loadConfiguration() {
        try {
            const printerResp = await fetch('/api/iplist?mode=printer_db');
            if (printerResp.ok) this.printerDB = await printerResp.json();

            const blacklistResp = await fetch('/api/iplist?mode=blacklist');
            if (blacklistResp.ok) this.blacklist = await blacklistResp.json();
        } catch (error) {
            throw new Error('ไม่สามารถโหลดข้อมูลเริ่มต้นได้');
        }
    }

    bindEvents() {
        const singleIp = document.getElementById('singleIp');
        if (singleIp) {
            singleIp.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.searchSingle();
            });
            singleIp.addEventListener('input', (e) => {
                this.favoritesManager.saveRecentIP(e.target.value);
            });
        }

        ['baseIp', 'startRange', 'endRange'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.searchRange();
                });
            }
        });

        const dbSearch = document.getElementById('databaseSearch');
        if (dbSearch) {
            dbSearch.addEventListener('input', debounce((e) => {
                this.databaseSection.setSearch(e.target.value);
            }, 300));
        }

        const dbSupplyFilter = document.getElementById('databaseSupplyFilter');
        if (dbSupplyFilter) {
            dbSupplyFilter.addEventListener('change', (e) => {
                const value = e.target.value;
                if (value === 'none') {
                    this.databaseSection.setSupplyFilter(null, null);
                } else {
                    const [type, level] = value.split('-');
                    this.databaseSection.setSupplyFilter(type, parseInt(level));
                }
            });
        }
    }

    listenForSettingsUpdates() {
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'AUTO_REFRESH_SETTINGS_UPDATED') {
                const newInterval = event.data.refreshInterval;
                if (this.autoRefreshManager.isActive) {
                    this.autoRefreshManager.updateInterval(newInterval);
                }
            }
        });
    }

    listenForFavoritesChanges() {
        window.addEventListener('favoritesChanged', (e) => {
            this.favorites = e.detail.favorites;
            this.searchSection.render();
            this.databaseSection.render();
        });
    }

    setupVisibilityChange() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (this.autoRefreshManager.isActive) this.autoRefreshManager.pause();
            } else {
                if (this.autoRefreshManager.isActive) this.autoRefreshManager.resume();
            }
        });
    }

    switchTab(tabName) {
        document.querySelectorAll('.search-content').forEach(content => content.classList.remove('active'));
        document.querySelectorAll('.search-tab').forEach(tab => tab.classList.remove('active'));
        
        const contents = {
            'single': 'singleSearch',
            'range': 'rangeSearch',
            'favorites': 'favoritesSearch'
        };
        
        if (contents[tabName]) {
            document.getElementById(contents[tabName]).classList.add('active');
            const tabs = document.querySelectorAll('.search-tab');
            const tabIndex = Object.keys(contents).indexOf(tabName);
            if (tabs[tabIndex]) tabs[tabIndex].classList.add('active');
        }
    }

    searchSingle() {
        const ip = document.getElementById('singleIp').value.trim();
        if (!ip) {
            this.notifications.warning('กรุณากรอก IP Address');
            return;
        }
        this.debouncedSearchSingle(ip);
    }

    async performSingleSearch(ip) {
        try {
            this.searchController = new AbortController();
            const signal = this.loadingManager.show('search', 'กำลังค้นหาเครื่องพิมพ์...');
            
            const response = await fetch('/check_single', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip }),
                signal
            });

            if (!response.ok) throw new Error('เกิดข้อผิดพลาดในการเชื่อมต่อ');

            const data = await response.json();
            
            if (Object.keys(data).length === 0) {
                this.notifications.warning('ไม่พบข้อมูลเครื่องพิมพ์');
                this.searchSection.clear();
            } else {
                const filteredData = this.filterBlacklisted(data);
                this.searchSection.updateData(filteredData);
                // โหลด log ใหม่หลัง manual refresh
                await this.logManager.loadLogs();
                this.notifications.success(`พบเครื่องพิมพ์ ${Object.keys(filteredData).length} เครื่อง`);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                this.notifications.error('ผิดพลาด: ' + error.message);
            }
        } finally {
            this.loadingManager.hide('search');
            this.searchController = null;
        }
    }

    searchRange() {
        const baseIp = document.getElementById('baseIp').value.trim();
        const start = parseInt(document.getElementById('startRange').value, 10);
        const end = parseInt(document.getElementById('endRange').value, 10);

        if (!baseIp || isNaN(start) || isNaN(end) || start < 1 || end > 254 || start > end) {
            this.notifications.warning('กรุณากรอก IP และช่วงที่ถูกต้อง');
            return;
        }

        this.debouncedSearchRange(baseIp, start, end);
    }

    async performRangeSearch(baseIp, start, end) {
        try {
            this.searchController = new AbortController();
            const signal = this.loadingManager.show('search', `กำลังค้นหา IP ${baseIp}.${start}-${end}...`);
            
            const response = await fetch('/check_range', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ base_ip: baseIp, start, end }),
                signal
            });

            if (!response.ok) throw new Error('เกิดข้อผิดพลาดในการเชื่อมต่อ');

            const data = await response.json();
            
            if (Object.keys(data).length === 0) {
                this.notifications.warning('ไม่พบข้อมูลเครื่องพิมพ์ในช่วง IP นี้');
                this.searchSection.clear();
            } else {
                const filteredData = this.filterBlacklisted(data);
                this.searchSection.updateData(filteredData);
                this.notifications.success(`พบเครื่องพิมพ์ ${Object.keys(filteredData).length} เครื่อง`);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                this.notifications.error('ผิดพลาด: ' + error.message);
            }
        } finally {
            this.loadingManager.hide('search');
            this.searchController = null;
        }
    }

    async searchFavorites() {
        const favorites = this.favoritesManager.getFavorites();
        if (favorites.length === 0) {
            this.notifications.warning('ไม่มีรายการโปรด กรุณาเพิ่มเครื่องพิมพ์เข้ารายการโปรดก่อน');
            return;
        }

        try {
            this.searchController = new AbortController();
            const signal = this.loadingManager.show('search', 'กำลังค้นหารายการโปรด...');
            
            const response = await fetch('/check_printer_db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ printer_ips: favorites }),
                signal
            });

            if (!response.ok) throw new Error('เกิดข้อผิดพลาดในการเชื่อมต่อ');

            const data = await response.json();
            
            if (Object.keys(data).length === 0) {
                this.notifications.warning('ไม่พบข้อมูลเครื่องพิมพ์ในรายการโปรด');
                this.searchSection.clear();
            } else {
                this.searchSection.updateData(data);
                this.notifications.success(`พบเครื่องพิมพ์ ${Object.keys(data).length} เครื่อง`);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                this.notifications.error('ผิดพลาด: ' + error.message);
            }
        } finally {
            this.loadingManager.hide('search');
            this.searchController = null;
        }
    }

    cancelSearch() {
        if (this.searchController) {
            this.searchController.abort();
        }
    }

    clearSearchResults() {
        this.searchSection.clear();
        
        const singleIp = document.getElementById('singleIp');
        const baseIp = document.getElementById('baseIp');
        const startRange = document.getElementById('startRange');
        const endRange = document.getElementById('endRange');
        
        if (singleIp) singleIp.value = '';
        if (baseIp) baseIp.value = '';
        if (startRange) startRange.value = '1';
        if (endRange) endRange.value = '254';
        
        this.notifications.info('ล้างผลการค้นหาแล้ว');
    }

    async loadDatabaseData() {
        if (this.printerDB.length === 0) {
            this.databaseSection.clear();
            const dbGrid = document.getElementById('databaseGrid');
            if (dbGrid) {
                dbGrid.innerHTML = '<p class="no-data">ไม่มี IP ใน Database กรุณาเพิ่มในหน้า Setting ก่อน</p>';
            }
            return;
        }

        await this.refreshDatabaseData();
    }

    async refreshDatabaseData(isManual = false) {
        if (this.loadingManager.isLoading('database')) return;

        try {
            this.databaseController = new AbortController();
            const signal = this.loadingManager.show('database', 'กำลังอัปเดตข้อมูลเครื่องพิมพ์...');
            
            const response = await fetch('/check_printer_db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    printer_ips: this.printerDB,
                    is_manual: isManual  // ส่ง flag ไป backend
                }),
                signal
            });

            if (!response.ok) throw new Error('เกิดข้อผิดพลาดในการเชื่อมต่อ');

            const data = await response.json();
            
            if (Object.keys(data).length === 0) {
                this.notifications.warning('ไม่พบข้อมูลเครื่องพิมพ์ใน Database');
                this.databaseSection.clear();
            } else {
                this.databaseSection.updateData(data);
                this.alertManager.checkPrinterAlerts(data);

                // โหลด log ใหม่ถ้าเป็น manual
                if (isManual) {
                    await this.logManager.loadLogs();
                }
                
                if (!this.autoRefreshManager.isActive) {
                    this.notifications.success(`อัปเดตข้อมูล ${Object.keys(data).length} เครื่อง`);
                }
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                this.notifications.error('ผิดพลาด: ' + error.message);
            }
        } finally {
            this.loadingManager.hide('database');
            this.databaseController = null;
        }
    }

    cancelDatabaseRefresh() {
        if (this.databaseController) {
            this.databaseController.abort();
        }
    }

    async refreshAllData() {
        await Promise.all([
            this.loadConfiguration(),
            this.refreshDatabaseData(true)  // manual = true → บันทึก log
        ]);
        this.notifications.success('รีเฟรชข้อมูลทั้งหมดแล้ว');
    }

    async toggleAutoRefresh() {
        await this.autoRefreshManager.toggle();
    }

    filterBlacklisted(data) {
        const filtered = {};
        for (const [ip, info] of Object.entries(data)) {
            if (!this.blacklist.includes(ip)) {
                filtered[ip] = info;
            }
        }
        return filtered;
    }

    openPrinterIP(ip) {
        window.open(`http://${ip}`, '_blank');
    }

    toggleSection(sectionId) {
        const content = document.getElementById(sectionId);
        const toggle = document.getElementById(sectionId.replace('Results', 'Toggle'));
        
        if (content && toggle) {
            if (content.classList.contains('collapsed')) {
                content.classList.remove('collapsed');
                toggle.textContent = '▼';
                toggle.classList.remove('collapsed');
            } else {
                content.classList.add('collapsed');
                toggle.textContent = '▶';
                toggle.classList.add('collapsed');
            }
        }
    }

    scrollToTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    scrollToBottom() {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }

    toggleFavorite(ip) {
        return this.favoritesManager.toggleFavorite(ip);
    }

    exportSearchData() {
        if (Object.keys(this.searchSection.data).length === 0) {
            this.notifications.warning('ไม่มีข้อมูลการค้นหาให้ export');
            return;
        }
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        this.exportManager.exportToCSV(this.searchSection.data, `search_results_${timestamp}.csv`);
        this.notifications.success('Export ข้อมูลการค้นหาเรียบร้อยแล้ว');
    }

    exportDatabaseData() {
        if (Object.keys(this.databaseSection.data).length === 0) {
            this.notifications.warning('ไม่มีข้อมูล Database ให้ export');
            return;
        }
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        this.exportManager.exportToCSV(this.databaseSection.data, `database_printers_${timestamp}.csv`);
        this.notifications.success('Export ข้อมูล Database เรียบร้อยแล้ว');
    }

    toggleAlertPanel() {
        this.alertManager.toggleAlertPanel();
    }

    async enableBrowserNotifications() {
        await this.alertManager.enableBrowserNotifications();
    }
}

// INITIALIZE APPLICATION
let printerMonitor;

document.addEventListener('DOMContentLoaded', function() {
    printerMonitor = new PrinterMonitor();
});

// Legacy function compatibility
function checkSingle() { printerMonitor.searchSingle(); }
function checkRange() { printerMonitor.searchRange(); }
function clearResults() { printerMonitor.clearSearchResults(); }
function checkprinter_dbOnly() { printerMonitor.refreshDatabaseData(); }
function switchTab(tab) { printerMonitor.switchTab(tab); }
function toggleSection(section) { printerMonitor.toggleSection(section); }
function scrollToTop() { printerMonitor.scrollToTop(); }
function scrollToBottom() { printerMonitor.scrollToBottom(); }
function toggleFavorite(ip) { printerMonitor.toggleFavorite(ip); }