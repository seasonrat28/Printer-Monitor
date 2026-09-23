import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { printerService } from '../services/api';
import { useWebSocket } from '../contexts/WebSocketContext';
import { Search, Filter, Plus, Upload, Download, RefreshCw, Bell, AlertTriangle, Info, XCircle, X, CheckCircle2, History, Trash2 } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Brush } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { PrinterCard } from '../components/PrinterCard';
import { EditPrinterModal } from '../components/EditPrinterModal';
import { NotificationsPanel } from '../components/NotificationsPanel';
import { MetricGrid } from '../components/MetricGrid';
import type { Printer } from '../types';

let isInitialSyncDone = false;
let cachedPrinters: Printer[] = [];
let cachedSummary: any = null;
const COLOR_PRINTER_IPS = new Set(['192.168.1.200']);

const isColorPrinter = (printer: Printer) => {
    if (printer.toner_cyan_level !== null && printer.toner_cyan_level !== undefined) return true;
    if (COLOR_PRINTER_IPS.has(printer.ip_address)) return true;
    const identity = `${printer.manufacturer || ''} ${printer.model || ''}`.toLowerCase();
    return /\b(color|colour|cmyk|cyan|magenta|bizhub c|imagepress|workcentre.*c|versalink c|docucentre.*c|apeosport.*c|gx7000)\b/i.test(identity);
};

const PrintersList = () => {
    const { user } = useAuth();
    const [printers, setPrinters] = useState<Printer[]>(cachedPrinters);
    const [loading, setLoading] = useState(cachedPrinters.length === 0);
    const { lastEvent } = useWebSocket();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [rawIps, setRawIps] = useState('');

    // Search and Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [assetStatusFilter, setAssetStatusFilter] = useState('ALL');
    const [supplyFilter, setSupplyFilter] = useState('ALL');
    const [departmentFilter, setDepartmentFilter] = useState('ALL');
    const [sortBy, setSortBy] = useState('ip_asc');
    const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);
    const [groups, setGroups] = useState<any[]>([]);
    const [smartFilters, setSmartFilters] = useState<any[]>([]);
    const [groupFilter, setGroupFilter] = useState<string>('ALL');
    const [brandFilter, setBrandFilter] = useState<string>('ALL');
    const [activeGroupPrinterIds, setActiveGroupPrinterIds] = useState<Set<number>>(new Set());
    const [activeSmartFilterPrinterIds, setActiveSmartFilterPrinterIds] = useState<Set<number>>(new Set());
    const [dashboardSummary, setDashboardSummary] = useState<any>(cachedSummary || {
        status_summary: { total: 0, online: 0, offline: 0, warning: 0 },
        metrics: { active_alerts: 0, critical_alerts: 0, pages_printed: 0, low_toner_printers: 0, avg_response: 'N/A' },
    });

    const fetchUnreadAlertsCount = async () => {
        try {
            const res = await api.get('/alerts/?is_resolved=false');
            setUnreadAlertsCount(res.data.length);
        } catch (err) {
            console.error("Failed to fetch alerts count", err);
        }
    };

    const fetchGroups = async () => {
        try {
            const res = await api.get('/groups/');
            setGroups(res.data);
        } catch (err) {
            console.error("Failed to fetch groups", err);
        }
    };

    const fetchSmartFilters = async () => {
        try {
            const res = await api.get('/smart-filters/');
            setSmartFilters(res.data);
        } catch (err) {
            console.error("Failed to fetch smart filters", err);
        }
    };

    // Debounced fetchSummary — will not fire more than once every 5 seconds
    const summaryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSummaryFetchRef = useRef<number>(0);
    const fetchSummary = useCallback(async () => {
        try {
            const res = await printerService.getDashboardSummary();
            setDashboardSummary(res.data);
            cachedSummary = res.data;
        } catch (error) {
            console.error("Failed to load dashboard summary", error);
        }
    }, []);

    const debouncedFetchSummary = useCallback(() => {
        const now = Date.now();
        const cooldown = 5000; // 5 seconds
        if (summaryTimerRef.current) clearTimeout(summaryTimerRef.current);
        const remaining = cooldown - (now - lastSummaryFetchRef.current);
        if (remaining <= 0) {
            lastSummaryFetchRef.current = now;
            fetchSummary();
        } else {
            summaryTimerRef.current = setTimeout(() => {
                lastSummaryFetchRef.current = Date.now();
                fetchSummary();
            }, remaining);
        }
    }, [fetchSummary]);

    useEffect(() => {
        fetchUnreadAlertsCount();
        fetchGroups();
        fetchSmartFilters();
        fetchSummary();
        lastSummaryFetchRef.current = Date.now();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once on mount only

    const [syncProgress, setSyncProgress] = useState(0);
    const [syncCount, setSyncCount] = useState(0);

    // Departments for Tabs
    const departments = useMemo(() => {
        const deps = new Set(printers.map(p => p.department).filter(Boolean) as string[]);
        return ['ALL', ...Array.from(deps)];
    }, [printers]);

    // History Modal State
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyTab, setHistoryTab] = useState<'stats' | 'maintenance' | 'meter' | 'docs'>('stats');
    const [newMaintenanceDesc, setNewMaintenanceDesc] = useState('');
    const [newMaintenanceUser, setNewMaintenanceUser] = useState('');
    const [submittingMaintenance, setSubmittingMaintenance] = useState(false);
    const [selectedPrinterHistory, setSelectedPrinterHistory] = useState<any>(null);
    const [historyData, setHistoryData] = useState<{ status_history: any[], counters_history: any[], supplies_history: any[], maintenance_logs: any[], meter_history: any[], attachments: any[] }>({ status_history: [], counters_history: [], supplies_history: [], maintenance_logs: [], meter_history: [], attachments: [] });

    // Borrow Modal State
    const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
    const [borrowDepartment, setBorrowDepartment] = useState('');
    const [borrowRemark, setBorrowRemark] = useState('');
    const [submittingBorrow, setSubmittingBorrow] = useState(false);
    const [selectedPrinterBorrow, setSelectedPrinterBorrow] = useState<Printer | null>(null);

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);

    const toggleFavorite = useCallback(async (printer: Printer, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const res = await api.patch(`/printers/${printer.id}/toggle-favorite`);
            setPrinters(prev => {
                const next = prev.map(p => p.id === printer.id ? { ...p, is_favorite: res.data.is_favorite } : p);
                cachedPrinters = next;
                return next;
            });
        } catch (err) {
            console.error("Failed to toggle favorite", err);
        }
    }, []);

    const openHistory = useCallback(async (printer: Printer) => {
        setSelectedPrinterHistory(printer);
        setIsHistoryModalOpen(true);
        setHistoryLoading(true);
        try {
            const res = await api.get(`/printers/${printer.id}/history?days=30`);
            const countersMap: Record<string, any> = {};
            res.data.counters_history.forEach((c: any) => {
                const dateStr = c.measured_at.endsWith('Z') ? c.measured_at : c.measured_at + 'Z';
                const d = new Date(dateStr);
                // Group by hour: "16 Sep, 14"
                const hourKey = d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit' });
                countersMap[hourKey] = {
                    date: d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
                    pages: c.total_pages
                };
            });
            const formattedCounters = Object.values(countersMap);

            // Compute Daily Meter Readings
            const dailyCounters: Record<string, number> = {};
            res.data.counters_history.forEach((c: any) => {
                const dateStr = c.measured_at.endsWith('Z') ? c.measured_at : c.measured_at + 'Z';
                const d = new Date(dateStr);
                const dayKey = d.toLocaleString('en-GB', { day: '2-digit', month: 'short' });
                // We keep overwriting so the last reading of the day is kept
                dailyCounters[dayKey] = c.total_pages;
            });
            
            const meterHistory = [];
            const days = Object.keys(dailyCounters);
            for (let i = 1; i < days.length; i++) {
                const prevDay = days[i-1];
                const currDay = days[i];
                const increment = dailyCounters[currDay] - dailyCounters[prevDay];
                meterHistory.push({
                    date: currDay,
                    pages: Math.max(0, increment)
                });
            }

            const suppliesMap: Record<string, any> = {};
            res.data.supplies_history.forEach((s: any) => {
                const dateStr = s.measured_at.endsWith('Z') ? s.measured_at : s.measured_at + 'Z';
                const d = new Date(dateStr);
                const hourKey = d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit' });
                suppliesMap[hourKey] = {
                    date: d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
                    toner: s.toner_level,
                    drum: s.drum_level
                };
            });
            const formattedSupplies = Object.values(suppliesMap);

            const maintenanceRes = await api.get(`/printers/${printer.id}/maintenance`);
            const attachmentsRes = await api.get(`/printers/${printer.id}/attachments`);

            setHistoryData({
                status_history: res.data.status_history,
                counters_history: formattedCounters,
                supplies_history: formattedSupplies,
                maintenance_logs: maintenanceRes.data,
                meter_history: meterHistory,
                attachments: attachmentsRes.data
            });
        } catch (err) {
            console.error("Failed to load history", err);
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    const handleAddMaintenance = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMaintenanceDesc.trim()) return;
        setSubmittingMaintenance(true);
        try {
            const res = await api.post(`/printers/${selectedPrinterHistory.id}/maintenance`, {
                description: newMaintenanceDesc,
                performed_by: newMaintenanceUser || undefined
            });
            setHistoryData(prev => ({
                ...prev,
                maintenance_logs: [res.data, ...prev.maintenance_logs]
            }));
            setNewMaintenanceDesc('');
            setNewMaintenanceUser('');
        } catch (err) {
            console.error("Failed to add maintenance log", err);
        } finally {
            setSubmittingMaintenance(false);
        }
    };

    const handleDeleteMaintenance = async (logId: number) => {
        if (!window.confirm("Delete this log?")) return;
        try {
            await api.delete(`/printers/${selectedPrinterHistory.id}/maintenance/${logId}`);
            setHistoryData(prev => ({
                ...prev,
                maintenance_logs: prev.maintenance_logs.filter(l => l.id !== logId)
            }));
        } catch (err) {
            console.error("Failed to delete log", err);
        }
    };

    const handleBorrowSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPrinterBorrow || !borrowDepartment.trim()) return;
        setSubmittingBorrow(true);
        try {
            await printerService.borrowPrinter(selectedPrinterBorrow.id, {
                department: borrowDepartment,
                remark: borrowRemark
            });
            // Update local state
            setPrinters(prev => prev.map(p => p.id === selectedPrinterBorrow.id ? { ...p, borrowed_by: borrowDepartment } : p));
            setIsBorrowModalOpen(false);
            setBorrowDepartment('');
            setBorrowRemark('');
        } catch (err) {
            console.error("Failed to borrow printer", err);
        } finally {
            setSubmittingBorrow(false);
        }
    };

    useEffect(() => {
        let isSyncingReq = true;
        const initLoad = async () => {
            try {
                const response = await printerService.getPrinters();
                if (isSyncingReq) {
                    setPrinters(response.data);
                    cachedPrinters = response.data;
                    setLoading(false); // Data is available — show it immediately
                }

                if (!isInitialSyncDone) {
                    setSyncProgress(0);
                    setSyncCount(0);
                    isInitialSyncDone = true;
                    api.post('/printers/sync'); // Fire-and-forget; SYNC_COMPLETE WS event will refresh
                }
            } catch (err) {
                console.error("Auto sync failed:", err);
                if (isSyncingReq) setLoading(false);
            }
        };
        initLoad();
        return () => { isSyncingReq = false; };
    }, []);

    useEffect(() => {
        if (lastEvent?.type === 'SYNC_COMPLETE') {
            setSyncProgress(100);
            if (printers.length > 0) {
                setSyncCount(printers.length);
            }
            setTimeout(() => {
                setLoading(false);
                fetchPrinters();
                fetchSummary();
                lastSummaryFetchRef.current = Date.now();
            }, 800);
        } else if (lastEvent?.type === 'STATUS_UPDATE') {
            setSyncCount(prev => prev + 1);
            setPrinters(prev => {
                // Batch updates by mutating a copy if many arrive fast? No, React batches state updates in React 18, 
                // but doing an O(N) map 100 times is O(N^2). 
                // A fast update just updating the one item:
                const idx = prev.findIndex(p => p.id === lastEvent.data.printer_id);
                if (idx === -1) return prev;
                const next = [...prev];
                next[idx] = {
                    ...next[idx],
                    status: lastEvent.data.status,
                    status_message: lastEvent.data.status_message !== undefined ? lastEvent.data.status_message : next[idx].status_message,
                    hostname: lastEvent.data.hostname !== undefined ? lastEvent.data.hostname : next[idx].hostname,
                    location: lastEvent.data.location !== undefined ? lastEvent.data.location : next[idx].location,
                    serial_number: lastEvent.data.serial_number !== undefined ? lastEvent.data.serial_number : next[idx].serial_number,
                    model: lastEvent.data.model !== undefined ? lastEvent.data.model : next[idx].model
                };
                cachedPrinters = next;
                return next;
            });
            debouncedFetchSummary(); // Debounced — won't fire more than once per 5s
        } else if (lastEvent?.type === 'SUPPLY_UPDATE') {
            setPrinters(prev => {
                const idx = prev.findIndex(p => p.id === lastEvent.data.printer_id);
                if (idx === -1) return prev;
                const next = [...prev];
                next[idx] = {
                    ...next[idx],
                    toner_level: lastEvent.data.toner_level !== undefined ? lastEvent.data.toner_level : next[idx].toner_level,
                    toner_black_level: lastEvent.data.toner_black_level !== undefined ? lastEvent.data.toner_black_level : next[idx].toner_black_level,
                    toner_cyan_level: lastEvent.data.toner_cyan_level !== undefined ? lastEvent.data.toner_cyan_level : next[idx].toner_cyan_level,
                    toner_magenta_level: lastEvent.data.toner_magenta_level !== undefined ? lastEvent.data.toner_magenta_level : next[idx].toner_magenta_level,
                    toner_yellow_level: lastEvent.data.toner_yellow_level !== undefined ? lastEvent.data.toner_yellow_level : next[idx].toner_yellow_level,
                    toner_photo_black_level: lastEvent.data.toner_photo_black_level !== undefined ? lastEvent.data.toner_photo_black_level : (next[idx] as any).toner_photo_black_level,
                    toner_matte_black_level: lastEvent.data.toner_matte_black_level !== undefined ? lastEvent.data.toner_matte_black_level : (next[idx] as any).toner_matte_black_level,
                    toner_red_level: lastEvent.data.toner_red_level !== undefined ? lastEvent.data.toner_red_level : (next[idx] as any).toner_red_level,
                    drum_level: lastEvent.data.drum_level !== undefined ? lastEvent.data.drum_level : next[idx].drum_level,
                    drum_black_level: lastEvent.data.drum_black_level !== undefined ? lastEvent.data.drum_black_level : next[idx].drum_black_level,
                    drum_cyan_level: lastEvent.data.drum_cyan_level !== undefined ? lastEvent.data.drum_cyan_level : next[idx].drum_cyan_level,
                    drum_magenta_level: lastEvent.data.drum_magenta_level !== undefined ? lastEvent.data.drum_magenta_level : next[idx].drum_magenta_level,
                    drum_yellow_level: lastEvent.data.drum_yellow_level !== undefined ? lastEvent.data.drum_yellow_level : next[idx].drum_yellow_level,
                    fuser_level: lastEvent.data.fuser_level !== undefined ? lastEvent.data.fuser_level : next[idx].fuser_level,
                    laser_unit_level: lastEvent.data.laser_unit_level !== undefined ? lastEvent.data.laser_unit_level : next[idx].laser_unit_level,
                    pf_kit_mp_level: lastEvent.data.pf_kit_mp_level !== undefined ? lastEvent.data.pf_kit_mp_level : next[idx].pf_kit_mp_level,
                    pf_kit_1_level: lastEvent.data.pf_kit_1_level !== undefined ? lastEvent.data.pf_kit_1_level : next[idx].pf_kit_1_level,
                    hostname: lastEvent.data.hostname !== undefined ? lastEvent.data.hostname : next[idx].hostname,
                    location: lastEvent.data.location !== undefined ? lastEvent.data.location : next[idx].location,
                    serial_number: lastEvent.data.serial_number !== undefined ? lastEvent.data.serial_number : next[idx].serial_number,
                    model: lastEvent.data.model !== undefined ? lastEvent.data.model : next[idx].model
                };
                cachedPrinters = next;
                return next;
            });
            debouncedFetchSummary();
        } else if (lastEvent?.type === 'NEW_ALERT') {
            setUnreadAlertsCount(prev => prev + 1);
            debouncedFetchSummary();
        } else if (lastEvent?.type === 'ALERT_RESOLVED') {
            setUnreadAlertsCount(prev => Math.max(0, prev - 1));
            debouncedFetchSummary();
        }
    }, [lastEvent]); // ← only lastEvent as dep, avoids infinite loop

    const fetchPrinters = useCallback(async () => {
        try {
            const response = await printerService.getPrinters();
            setPrinters(response.data);
            cachedPrinters = response.data;
        } catch (error) {
            console.error("Failed to fetch printers", error);
        }
    }, []);

    const handleRefresh = async () => {
        setLoading(true);
        setSyncProgress(0);
        setSyncCount(0);
        try {
            await api.post('/printers/sync');
            // If the API call completes successfully, ensure we clear the loading state
            // even if the WebSocket SYNC_COMPLETE event was missed or delayed.
            fetchPrinters();
            fetchSummary();
            setLoading(false);
            setSyncProgress(100);
        } catch (e) {
            fetchPrinters();
            fetchSummary();
            setLoading(false);
        }
    };

    const handleDelete = useCallback(async (id: number) => {
        if (window.confirm("Are you sure you want to delete this printer?")) {
            try {
                await printerService.deletePrinter(id);
                fetchPrinters();
                fetchSummary();
            } catch (error) {
                console.error("Failed to delete printer", error);
            }
        }
    }, [fetchPrinters, fetchSummary]);

    const handleDeleteAll = async () => {
        if (window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบเครื่องพิมพ์ทั้งหมดในระบบ? ข้อมูลประวัติทั้งหมดจะหายไปด้วย!")) {
            try {
                await api.delete('/printers/');
                alert("ลบเครื่องพิมพ์ทั้งหมดเรียบร้อยแล้ว");
                fetchPrinters();
                fetchSummary();
            } catch (error: any) {
                console.error("Failed to delete all printers", error);
                alert("ไม่สามารถลบเครื่องพิมพ์ทั้งหมดได้: " + (error.response?.data?.detail || error.message));
            }
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            await api.post('/printers/import/csv', formData);
            alert('Printers imported successfully!');
            fetchPrinters();
            fetchSummary();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Failed to import printers');
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleExport = async () => {
        try {
            const response = await api.get('/printers/export/csv', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'printers_export.csv');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error("Failed to export printers", err);
            alert("Failed to export printers");
        }
    };

    const handleAddPrinter = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            const response = await api.post('/printers/bulk', { raw_ips: rawIps });
            alert(response.data.message);
            setIsAddModalOpen(false);
            setRawIps('');
            setSelectedFileName('');
            fetchPrinters();
            fetchSummary();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Failed to add printers');
        } finally {
            setIsSubmitting(false);
        }
    };

    const [discoveryMethod, setDiscoveryMethod] = useState<'address' | 'range' | 'file'>('address');
    const addressListFileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFileName, setSelectedFileName] = useState('');

    const handleAddressListImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSelectedFileName(file.name);
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            setRawIps(content);
        };
        reader.readAsText(file);
    };

    // Filter Logic
    const filteredPrinters = React.useMemo(() => {
        let result = printers.filter(p => {
            // Group Filter
            if (groupFilter !== 'ALL') {
                if (!activeGroupPrinterIds.has(p.id)) return false;
            }
            // Smart Filter (Brand)
            if (brandFilter !== 'ALL') {
                if (!activeSmartFilterPrinterIds.has(p.id)) return false;
            }

            // Department Filter
            if (departmentFilter !== 'ALL' && p.department !== departmentFilter) return false;

            // Status Filter
            if (statusFilter === 'FAVORITES' && !p.is_favorite) return false;
            if (statusFilter === 'ONLINE' && !(p.status === 'ONLINE' || p.status === 'WARNING' || p.status === 'ERROR')) return false;
            if (statusFilter === 'READY' && p.status !== 'ONLINE') return false;
            if (statusFilter === 'OFFLINE' && p.status === 'ONLINE') return false;
            if (statusFilter === 'OFFLINE' && p.status === 'WARNING') return false;
            if (statusFilter === 'OFFLINE' && p.status === 'ERROR') return false;
            if (statusFilter !== 'ALL' && statusFilter !== 'FAVORITES' && statusFilter !== 'ONLINE' && statusFilter !== 'READY' && statusFilter !== 'OFFLINE' && p.status !== statusFilter) return false;

            // Asset Status Filter
            if (assetStatusFilter !== 'ALL' && (p.asset_status || 'Deployed') !== assetStatusFilter) return false;

            // Supply Filter
            if (supplyFilter !== 'ALL') {
                if (supplyFilter.startsWith('TONER_')) {
                    if (p.toner_level === undefined || p.toner_level === null) return false;
                    if (supplyFilter === 'TONER_10' && (p.toner_level < 0 || p.toner_level > 10)) return false;
                    if (supplyFilter === 'TONER_20' && (p.toner_level <= 10 || p.toner_level > 20)) return false;
                    if (supplyFilter === 'TONER_30' && (p.toner_level <= 20 || p.toner_level > 30)) return false;
                }
                if (supplyFilter.startsWith('DRUM_')) {
                    if (p.drum_level === undefined || p.drum_level === null) return false;
                    if (supplyFilter === 'DRUM_10' && (p.drum_level < 0 || p.drum_level > 10)) return false;
                    if (supplyFilter === 'DRUM_20' && (p.drum_level <= 10 || p.drum_level > 20)) return false;
                    if (supplyFilter === 'DRUM_30' && (p.drum_level <= 20 || p.drum_level > 30)) return false;
                }
            }

            // Search Filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const hostname = (p.hostname || '').toLowerCase();
                const ip = (p.ip_address || '').toLowerCase();
                const loc = (p.location || '').toLowerCase();
                const serial = (p.serial_number || '').toLowerCase();
                if (!hostname.includes(query) && !ip.includes(query) && !loc.includes(query) && !serial.includes(query)) {
                    return false;
                }
            }
            return true;
        });

        // Sort Logic
        result = result.sort((a, b) => {
            if (sortBy === 'ip_asc') {
                const ipA = a.ip_address.split('.').map(Number);
                const ipB = b.ip_address.split('.').map(Number);
                for (let i = 0; i < 4; i++) {
                    if (ipA[i] !== ipB[i]) return ipA[i] - ipB[i];
                }
                return 0;
            }
            if (sortBy === 'ip_desc') {
                const ipA = a.ip_address.split('.').map(Number);
                const ipB = b.ip_address.split('.').map(Number);
                for (let i = 0; i < 4; i++) {
                    if (ipA[i] !== ipB[i]) return ipB[i] - ipA[i];
                }
                return 0;
            }
            return 0;
        });

        return result;
    }, [printers, statusFilter, assetStatusFilter, supplyFilter, departmentFilter, searchQuery, sortBy, groupFilter, brandFilter, activeGroupPrinterIds]);



    const clearFilters = () => {
        setSearchQuery('');
        setStatusFilter('ALL');
        setAssetStatusFilter('ALL');
        setDepartmentFilter('ALL');
        setSupplyFilter('ALL');
        setGroupFilter('ALL');
        setBrandFilter('ALL');
        setActiveGroupPrinterIds(new Set());
        setActiveSmartFilterPrinterIds(new Set());
        setSortBy('ip_asc');
    };

    const metrics = dashboardSummary?.metrics || { active_alerts: 0, critical_alerts: 0, pages_printed: 0, low_toner_printers: 0, avg_response: 'N/A' };

    // Calculate real-time stats from local printers array
    const realTimeTotal = printers.length;
    const realTimeOnline = printers.filter(p => p.status === 'ONLINE' || p.status === 'WARNING' || p.status === 'ERROR').length;
    const realTimeOffline = printers.filter(p => p.status === 'OFFLINE' || p.status === 'UNKNOWN' || !p.status).length;

    const SkeletonCard = () => (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 flex flex-col h-[280px] animate-pulse">
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-2 w-full">
                    <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
                    <div className="w-12 h-4 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                </div>
            </div>
            <div className="space-y-3 mb-5 w-full">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
            </div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-md w-full mb-6"></div>
            <div className="flex items-center justify-between space-x-6 px-2 mt-auto">
                <div className="flex-1 flex flex-col items-center">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12 mb-2"></div>
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-10 mb-2"></div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5"></div>
                </div>
                <div className="flex-1 flex flex-col items-center">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12 mb-2"></div>
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-10 mb-2"></div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5"></div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">Printers Directory</h2>
                <div className="flex space-x-3">
                    <div className="flex items-center rounded-md border border-slate-300 bg-white p-1 dark:border-slate-600 dark:bg-[#1e1e1e]" aria-label="View mode">
                        <button onClick={() => setViewMode('cards')} className={`rounded px-3 py-1.5 text-xs font-medium ${viewMode === 'cards' ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'}`}>Cards</button>
                        <button onClick={() => setViewMode('table')} className={`rounded px-3 py-1.5 text-xs font-medium ${viewMode === 'table' ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'}`}>Table</button>
                    </div>
                    <button
                        onClick={handleRefresh}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg flex items-center space-x-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm"
                    >
                        <RefreshCw size={16} />
                        <span>Refresh</span>
                    </button>
                    {user?.role === 'ADMIN' && (
                        <>
                            <input
                                type="file"
                                accept=".csv"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleImport}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg flex items-center space-x-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm"
                            >
                                <Upload size={16} />
                                <span>Import CSV</span>
                            </button>
                        </>
                    )}
                    <button
                        onClick={handleExport}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg flex items-center space-x-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm"
                    >
                        <Download size={16} />
                        <span>Export CSV</span>
                    </button>
                    {user?.role === 'ADMIN' && (
                        <>
                            <button
                                onClick={() => setIsAddModalOpen(true)}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center space-x-2 hover:bg-indigo-700 transition-colors shadow-sm"
                            >
                                <Plus size={16} />
                                <span>Add Printers</span>
                            </button>
                            <button
                                onClick={handleDeleteAll}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg flex items-center space-x-2 hover:bg-red-700 transition-colors shadow-sm"
                                title="ล้างข้อมูลเครื่องพิมพ์ทั้งหมด"
                            >
                                <Trash2 size={16} />
                                <span>Clear All</span>
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => setIsNotificationsOpen(true)}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg flex items-center space-x-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm relative"
                        title="View Notifications"
                    >
                        <Bell size={16} className="text-gray-600 dark:text-gray-300" />
                        {unreadAlertsCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-white">
                                {unreadAlertsCount > 99 ? '99+' : unreadAlertsCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Dashboard Stats */}
            <MetricGrid
                total={realTimeTotal}
                online={realTimeOnline}
                activeAlerts={metrics.active_alerts}
                criticalAlerts={metrics.critical_alerts}
                offline={realTimeOffline}
                pagesPrinted={metrics.pages_printed}
                lowToner={metrics.low_toner_printers}
                avgResponse={metrics.avg_response}
            />

            {/* Department Tabs */}

            {departments.length > 1 && (
                <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
                    {departments.map((dept) => (
                        <button
                            key={dept}
                            onClick={() => setDepartmentFilter(dept)}
                            className={`px-4 py-2 whitespace-nowrap rounded-lg font-medium text-sm transition-colors ${departmentFilter === dept
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                        >
                            {dept === 'ALL' ? 'แผนกทั้งหมด' : dept}
                        </button>
                    ))}
                </div>
            )}

            {/* Search and Filter Bar */}
            <div className="flex flex-col lg:flex-row gap-2 xl:gap-3 items-center bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="w-full lg:w-auto flex-1 min-w-[200px] max-w-md relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors sm:text-sm"
                        placeholder="ค้นหาอุปกรณ์ (ชื่อ, IP, สถานที่...)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Smart Filter (Brands) */}
                <div className="w-full lg:w-44 relative shrink-0">
                    <select
                        className="block w-full pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors sm:text-sm appearance-none"
                        value={brandFilter}
                        onChange={async (e) => {
                            const val = e.target.value;
                            if (val === 'ADD_NEW') {
                                window.location.href = '/smart-filters';
                                return;
                            }
                            setBrandFilter(val);
                            if (val === 'ALL') {
                                setActiveSmartFilterPrinterIds(new Set());
                            } else {
                                try {
                                    // Use standard pattern or filter from state
                                    const filter = smartFilters.find(f => f.id.toString() === val);
                                    if (filter) {
                                        setActiveSmartFilterPrinterIds(new Set(filter.printers.map((p: any) => p.id)));
                                    }
                                } catch (err) {
                                    console.error("Failed to set smart filter printers", err);
                                }
                            }
                        }}
                    >
                        <option value="ALL">แบรนด์ทั้งหมด (Smart Filter)</option>
                        {smartFilters.map(filter => (
                            <option key={filter.id} value={filter.id}>{filter.name}</option>
                        ))}
                        <option disabled>──────────</option>
                        <option value="ADD_NEW">+ New smart filter</option>
                    </select>
                </div>

                {/* Groups Filter */}
                <div className="w-full lg:w-44 relative shrink-0">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    </div>
                    <select
                        className="block w-full pl-9 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors sm:text-sm appearance-none"
                        value={groupFilter}
                        onChange={async (e) => {
                            const val = e.target.value;
                            if (val === 'ADD_NEW') {
                                window.location.href = '/groups';
                                return;
                            }
                            setGroupFilter(val);
                            if (val === 'ALL') {
                                setActiveGroupPrinterIds(new Set());
                            } else {
                                try {
                                    const res = await api.get(`/groups/${val}`);
                                    setActiveGroupPrinterIds(new Set(res.data.printers.map((p: any) => p.id)));
                                } catch (err) {
                                    console.error("Failed to load group printers", err);
                                }
                            }
                        }}
                    >
                        <option value="ALL">กลุ่มทั้งหมด (All Groups)</option>
                        {groups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                        <option disabled>──────────</option>
                        <option value="ADD_NEW">+ New group</option>
                    </select>
                </div>

                {/* Status */}
                <div className="w-full lg:w-36 relative shrink-0">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Filter className="h-4 w-4 text-gray-400" />
                    </div>
                    <select
                        className="block w-full pl-9 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors sm:text-sm appearance-none"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="ALL">สถานะทั้งหมด</option>
                        <option value="FAVORITES">⭐ รายการโปรด</option>
                        <option value="ONLINE">🌐 ออนไลน์ (เชื่อมต่อได้ทั้งหมด)</option>
                        <option value="READY">🟢 พร้อมใช้งาน (ปกติ)</option>
                        <option value="WARNING">🟡 แจ้งเตือน</option>
                        <option value="ERROR">🔴 มีปัญหา (Error)</option>
                        <option value="OFFLINE">⚪ ออฟไลน์</option>
                    </select>
                </div>

                {/* Asset Status */}
                <div className="w-full lg:w-40 relative shrink-0">
                    <select
                        className="block w-full pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors sm:text-sm appearance-none"
                        value={assetStatusFilter}
                        onChange={(e) => setAssetStatusFilter(e.target.value)}
                    >
                        <option value="ALL">สถานะเครื่อง (All)</option>
                        <option value="DEPLOYED">🟢 ใช้งานอยู่ (Deployed)</option>
                        <option value="IN_STOCK">🟡 สำรองในคลัง (In Stock)</option>
                        <option value="REPAIRING">🟠 ส่งซ่อม (Repairing)</option>
                    </select>
                </div>

                {/* Supply */}
                <div className="w-full lg:w-40 relative shrink-0">
                    <select
                        className="block w-full pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors sm:text-sm appearance-none"
                        value={supplyFilter}
                        onChange={(e) => setSupplyFilter(e.target.value)}
                    >
                        <option value="ALL">ปริมาณหมึกทั้งหมด</option>
                        <option value="TONER_10">Toner 0-10%</option>
                        <option value="TONER_20">Toner 11-20%</option>
                        <option value="TONER_30">Toner 21-30%</option>
                        <option value="DRUM_10">Drum 0-10%</option>
                        <option value="DRUM_20">Drum 11-20%</option>
                        <option value="DRUM_30">Drum 21-30%</option>
                    </select>
                </div>

                {/* Sort */}
                <div className="w-full lg:w-36 relative shrink-0">
                    <select
                        className="block w-full pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors sm:text-sm appearance-none"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                    >
                        <option value="ip_asc">IP (น้อย -&gt; มาก)</option>
                        <option value="ip_desc">IP (มาก -&gt; น้อย)</option>
                    </select>
                </div>

                <button
                    onClick={clearFilters}
                    className="lg:ml-auto w-full lg:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center space-x-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 shrink-0"
                >
                    ล้างตัวกรอง
                </button>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <RefreshCw className="h-10 w-10 text-indigo-500 animate-spin mb-4" />
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">กำลังเชื่อมต่อและดึงข้อมูล...</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">ระบบกำลังตรวจสอบสถานะปริ้นเตอร์และปริมาณหมึกแบบ Real-time</p>
                    <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden relative">
                        <div className="h-full bg-indigo-500 rounded-full transition-all duration-300 ease-out" style={{ width: `${syncProgress}%` }}></div>
                    </div>
                    <p className="text-xs font-bold text-indigo-600 mt-2">{syncProgress}% ({syncCount}/{printers.length})</p>
                </div>
            ) : filteredPrinters.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col items-center">
                    <Search className="h-12 w-12 text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">ไม่พบเครื่องปริ้นเตอร์</h3>
                    <p className="text-gray-500 dark:text-gray-400">ลองเปลี่ยนคำค้นหา หรือเพิ่มเครื่องปริ้นใหม่</p>
                </div>
            ) : viewMode === 'cards' ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {filteredPrinters.map(printer => (
                        <PrinterCard
                            key={printer.id}
                            printer={printer}
                            onToggleFavorite={toggleFavorite}
                            onOpenHistory={openHistory}
                            onEdit={(p) => { setEditingPrinter(p); setIsEditModalOpen(true); }}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            ) : (
                <div className="overflow-x-auto rounded-md border border-slate-200 bg-white dark:border-gray-700/50 dark:bg-gray-800/40 backdrop-blur-sm">
                    <table className="min-w-245 w-full text-left text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:border-gray-700/50 dark:bg-gray-800/50 dark:text-slate-300">
                            <tr>
                                <th className="px-3 py-2 font-semibold">Printer</th>
                                <th className="px-3 py-2 font-semibold">Status</th>
                                <th className="px-3 py-2 font-semibold">Location</th>
                                <th className="w-72 px-3 py-2 font-semibold">Supplies</th>
                                <th className="px-3 py-2 font-semibold">Last seen</th>
                                <th className="px-3 py-2 text-right font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredPrinters.map(printer => {
                                const colorPrinter = isColorPrinter(printer);
                                const baseSupplies = colorPrinter
                                    ? [['K', printer.toner_black_level ?? printer.toner_level, 'bg-slate-700 dark:bg-slate-300'], ['C', printer.toner_cyan_level, 'bg-cyan-600 dark:bg-cyan-400'], ['M', printer.toner_magenta_level, 'bg-rose-600 dark:bg-rose-400'], ['Y', printer.toner_yellow_level, 'bg-amber-500 dark:bg-amber-400']] as [string, number | undefined | null, string][]
                                    : [['Toner', printer.toner_level, 'bg-slate-700 dark:bg-slate-300'], ['Drum', printer.drum_level, 'bg-amber-500 dark:bg-amber-400']] as [string, number | undefined | null, string][];

                                const supplies = [
                                    ...baseSupplies,
                                    ['Fuser', printer.fuser_level, 'bg-purple-500 dark:bg-purple-400'],
                                    ['Laser', printer.laser_unit_level, 'bg-indigo-500 dark:bg-indigo-400'],
                                    ['PF Kit MP', printer.pf_kit_mp_level, 'bg-pink-500 dark:bg-pink-400'],
                                    ['PF Kit 1', printer.pf_kit_1_level, 'bg-teal-500 dark:bg-teal-400']
                                ].filter(([, level]) => level !== undefined && level !== null) as [string, number | undefined, string][];

                                const statusClass = printer.status === 'ONLINE'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                    : printer.status === 'OFFLINE'
                                        ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                        : 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300';
                                return (
                                    <tr key={printer.id} className="hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors">
                                        <td className="px-3 py-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`h-2 w-2 rounded-full ${printer.status === 'ONLINE' ? 'bg-emerald-500' : printer.status === 'OFFLINE' ? 'bg-slate-400' : 'bg-orange-500'}`} />
                                                <div className="min-w-0">
                                                    <div className="truncate font-medium text-slate-900 dark:text-slate-100">{printer.hostname || printer.ip_address}</div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">{printer.ip_address} {printer.serial_number ? `| ${printer.serial_number}` : ''}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2"><span className={`inline-flex rounded px-2 py-1 text-[11px] font-semibold ${statusClass}`}>{printer.status || 'UNKNOWN'}</span></td>
                                        <td className="max-w-40 truncate px-3 py-2 text-slate-600 dark:text-slate-300" title={printer.location || '-'}>{printer.location || '-'}</td>
                                        <td className="px-3 py-2">
                                            <div className="space-y-1">
                                                {supplies.map(([label, level, color]) => (
                                                    <div key={label} className="flex items-center gap-2">
                                                        <span className="w-10 shrink-0 truncate text-[10px] font-semibold text-slate-500 dark:text-slate-400">{label}</span>
                                                        <div className="h-1.5 flex-1 bg-slate-200 dark:bg-slate-700/50 rounded-full overflow-hidden"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, level ?? 0))}%` }} /></div>
                                                        <span className="w-8 text-right text-[10px] text-slate-500 dark:text-slate-400">{level ?? '-'}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-xs text-slate-500">{printer.last_seen ? new Date(printer.last_seen.endsWith('Z') ? printer.last_seen : printer.last_seen + 'Z').toLocaleString('en-GB') : 'Never'}</td>
                                        <td className="px-3 py-2 text-right">
                                            <div className="flex justify-end gap-1">
                                                <button onClick={(e) => toggleFavorite(printer, e)} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300" title="Toggle favorite">{printer.is_favorite ? '★' : '☆'}</button>
                                                <button onClick={() => openHistory(printer)} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300">History</button>
                                                {user?.role === 'ADMIN' && (
                                                    <button onClick={() => { setEditingPrinter(printer); setIsEditModalOpen(true); }} className="rounded border border-blue-200 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300">Edit</button>
                                                )}
                                                {user?.role === 'ADMIN' && (
                                                    <button onClick={() => handleDelete(printer.id)} className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300">Delete</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}



            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 dark:bg-black/70 transition-opacity">
                    <div className="bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-2xl transform transition-all w-full max-w-xl border border-gray-300 dark:border-gray-600">
                        <div className="flex justify-between items-center px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200" id="modal-title">
                                Discover specific devices
                            </h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleAddPrinter}>
                            <div className="p-6">
                                <div className="space-y-6">
                                    {/* Network Section */}
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-500 mb-3">Network:</h4>
                                        <div className="space-y-4 ml-2">
                                            {/* Specified Address */}
                                            <div className="flex items-start">
                                                <div className="flex items-center h-5">
                                                    <input
                                                        id="method-address"
                                                        name="discovery-method"
                                                        type="radio"
                                                        checked={discoveryMethod === 'address'}
                                                        onChange={() => setDiscoveryMethod('address')}
                                                        className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                                                    />
                                                </div>
                                                <div className="ml-3">
                                                    <label htmlFor="method-address" className="text-sm font-medium text-gray-700">Specified address:</label>
                                                    <div className="mt-2 flex">
                                                        <input
                                                            type="text"
                                                            disabled={discoveryMethod !== 'address'}
                                                            className={`shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-48 sm:text-sm border-gray-300 rounded-md px-3 py-1.5 border ${discoveryMethod !== 'address' ? 'bg-gray-50 text-gray-400' : ''}`}
                                                            placeholder="e.g. 192.168.1.10"
                                                            value={rawIps}
                                                            onChange={e => setRawIps(e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Address Range */}
                                            <div className="flex items-start">
                                                <div className="flex items-center h-5">
                                                    <input
                                                        id="method-range"
                                                        name="discovery-method"
                                                        type="radio"
                                                        checked={discoveryMethod === 'range'}
                                                        onChange={() => setDiscoveryMethod('range')}
                                                        className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                                                    />
                                                </div>
                                                <div className="ml-3">
                                                    <label htmlFor="method-range" className="text-sm font-medium text-gray-700">Address range:</label>
                                                    <div className={`mt-2 flex items-center space-x-2 ${discoveryMethod !== 'range' ? 'text-gray-400' : 'text-gray-700'}`}>
                                                        <input type="text" disabled={discoveryMethod !== 'range'} className={`shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-40 sm:text-sm border-gray-300 rounded-md px-3 py-1.5 border ${discoveryMethod !== 'range' ? 'bg-gray-50' : ''}`} placeholder="192.168.1.1" />
                                                        <span>~</span>
                                                        <input type="text" disabled={discoveryMethod !== 'range'} className={`shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-40 sm:text-sm border-gray-300 rounded-md px-3 py-1.5 border ${discoveryMethod !== 'range' ? 'bg-gray-50' : ''}`} placeholder="192.168.1.255" />
                                                    </div>
                                                    <p className="text-[10px] text-gray-400 mt-1">*Select to use range format in the textarea</p>
                                                </div>
                                            </div>

                                            {/* Import list */}
                                            <div className="flex items-start">
                                                <div className="flex items-center h-5">
                                                    <input
                                                        id="method-file"
                                                        name="discovery-method"
                                                        type="radio"
                                                        checked={discoveryMethod === 'file'}
                                                        onChange={() => setDiscoveryMethod('file')}
                                                        className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                                                    />
                                                </div>
                                                <div className="ml-3 w-full">
                                                    <label htmlFor="method-file" className="text-sm font-medium text-gray-700">Import address list file:</label>
                                                    <div className="mt-2 flex w-full">
                                                        <input
                                                            type="text"
                                                            disabled
                                                            className={`shadow-sm block w-full sm:text-sm border-gray-300 rounded-l-md px-3 py-1.5 border ${discoveryMethod !== 'file' ? 'bg-gray-50 text-gray-400' : 'bg-gray-50 text-gray-700'}`}
                                                            placeholder="No file chosen"
                                                            value={selectedFileName}
                                                        />
                                                        <input
                                                            type="file"
                                                            accept=".txt,.csv"
                                                            className="hidden"
                                                            ref={addressListFileInputRef}
                                                            onChange={handleAddressListImport}
                                                        />
                                                        <button
                                                            type="button"
                                                            disabled={discoveryMethod !== 'file'}
                                                            onClick={() => addressListFileInputRef.current?.click()}
                                                            className={`inline-flex items-center px-3 py-1.5 border border-l-0 border-gray-300 rounded-r-md text-sm ${discoveryMethod !== 'file' ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                                                        >
                                                            Browse...
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <hr className="border-gray-200" />

                                    {/* USB Section */}
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-500 mb-3">USB:</h4>
                                        <div className="ml-2 flex items-start">
                                            <div className="flex items-center h-5">
                                                <input id="method-usb" name="discovery-method" type="radio" disabled className="h-4 w-4 text-indigo-600 border-gray-300 opacity-50" />
                                            </div>
                                            <div className="ml-3">
                                                <label htmlFor="method-usb" className="text-sm font-medium text-gray-400">USB</label>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                            <div className="bg-gray-50 px-4 py-3 flex justify-end space-x-2 border-t border-gray-200">
                                <button
                                    type="submit"
                                    disabled={isSubmitting || (discoveryMethod === 'address' && !rawIps.trim()) || (discoveryMethod === 'file' && !selectedFileName)}
                                    className="inline-flex justify-center rounded border border-transparent px-6 py-1.5 bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none disabled:opacity-50 min-w-[80px]"
                                >
                                    {isSubmitting ? 'OK...' : 'OK'}
                                </button>
                                <button type="button" onClick={() => setIsAddModalOpen(false)} className="inline-flex justify-center rounded border border-gray-300 px-4 py-1.5 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none min-w-[80px]">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {isHistoryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/75 transition-opacity">
                    <div className="bg-white dark:bg-gray-800 rounded-md text-left overflow-hidden shadow-md transform transition-all w-full max-w-4xl border border-gray-200 dark:border-gray-700 flex flex-col h-[80vh]">

                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center space-x-2">
                                    <History size={20} className="text-indigo-600" />
                                    <span>ประวัติการใช้งาน: {selectedPrinterHistory?.hostname || selectedPrinterHistory?.ip_address}</span>
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">สถิติย้อนหลัง 30 วัน</p>
                            </div>
                            <button onClick={() => setIsHistoryModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-6">
                            <button
                                onClick={() => setHistoryTab('stats')}
                                className={`py-3 px-4 border-b-2 font-medium text-sm transition-colors ${historyTab === 'stats' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >สถิติปริมาณหมึก</button>
                            <button
                                onClick={() => setHistoryTab('meter')}
                                className={`py-3 px-4 border-b-2 font-medium text-sm transition-colors ${historyTab === 'meter' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >สถิติการพิมพ์</button>
                            <button
                                onClick={() => setHistoryTab('docs')}
                                className={`py-3 px-4 border-b-2 font-medium text-sm transition-colors ${historyTab === 'docs' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >เอกสารแนบ</button>
                            <button
                                onClick={() => setHistoryTab('maintenance')}
                                className={`py-3 px-4 border-b-2 font-medium text-sm transition-colors ${historyTab === 'maintenance' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >ประวัติซ่อมบำรุง</button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {historyLoading ? (
                                <div className="flex flex-col items-center justify-center h-64 space-y-4">
                                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                    <p className="text-gray-500">กำลังโหลดประวัติ...</p>
                                </div>
                            ) : historyTab === 'stats' ? (
                                <>
                                    {/* Toner and Drum Level Chart */}
                                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
                                        <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4 uppercase tracking-wider">ปริมาณหมึกและดรัม (Toner & Drum Level)</h4>
                                        {historyData.supplies_history.length > 0 ? (
                                            <div className="h-64 w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={historyData.supplies_history}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                                                        <XAxis dataKey="date" stroke="#6B7280" fontSize={12} />
                                                        <YAxis stroke="#6B7280" fontSize={12} width={60} domain={[0, 100]} />
                                                        <RechartsTooltip
                                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                                        />
                                                        <Legend verticalAlign="top" height={36} />
                                                        <Line type="monotone" dataKey="toner" stroke="#EAB308" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name="Toner (%)" isAnimationActive={false} />
                                                        <Line type="monotone" dataKey="drum" stroke="#10B981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name="Drum (%)" isAnimationActive={false} />
                                                        <Brush dataKey="date" height={30} stroke="#9CA3AF" fill="#f8fafc" travellerWidth={10} />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        ) : (
                                            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">ไม่มีข้อมูลหมึกและดรัมย้อนหลัง</div>
                                        )}
                                    </div>

                                    {/* Print Volume Chart */}
                                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
                                        <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4 uppercase tracking-wider">ปริมาณการพิมพ์ (Total Pages)</h4>
                                        {historyData.counters_history.length > 0 ? (
                                            <div className="h-64 w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={historyData.counters_history}>
                                                        <defs>
                                                            <linearGradient id="colorPages" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3} />
                                                                <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                                                        <XAxis dataKey="date" stroke="#6B7280" fontSize={12} />
                                                        <YAxis stroke="#6B7280" fontSize={12} width={60} />
                                                        <RechartsTooltip
                                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                                        />
                                                        <Area type="monotone" dataKey="pages" stroke="#4F46E5" strokeWidth={2} fill="url(#colorPages)" isAnimationActive={false} />
                                                        <Brush dataKey="date" height={30} stroke="#4F46E5" fill="#f8fafc" travellerWidth={10} />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>
                                        ) : (
                                            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">ไม่มีข้อมูลการพิมพ์ย้อนหลัง</div>
                                        )}
                                    </div>

                                    {/* Status History List */}
                                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
                                        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                                            <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">ประวัติสถานะ (Recent Events)</h4>
                                        </div>
                                        <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-64 overflow-y-auto">
                                            {historyData.status_history.length > 0 ? (
                                                historyData.status_history.map((h, i) => (
                                                    <div key={i} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                        <div className="flex items-center space-x-3">
                                                            <div className={`w-2.5 h-2.5 rounded-full ${h.status === 'ONLINE' ? 'bg-emerald-500' :
                                                                h.status === 'WARNING' ? 'bg-amber-500' : 'bg-red-500'
                                                                }`}></div>
                                                            <span className="font-medium text-sm text-gray-800 dark:text-gray-200">เปลี่ยนสถานะเป็น: {h.status}</span>
                                                        </div>
                                                        <span className="text-xs text-gray-500">
                                                            {new Date(h.checked_at.endsWith('Z') ? h.checked_at : h.checked_at + 'Z').toLocaleString('en-GB')}
                                                        </span>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-4 text-center text-gray-400 text-sm">ไม่มีประวัติการเปลี่ยนสถานะ</div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            ) : historyTab === 'meter' ? (
                                <>
                                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
                                        <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4 uppercase tracking-wider">สถิติการพิมพ์รายวัน (Daily Printed Pages)</h4>
                                        {historyData.meter_history && historyData.meter_history.length > 0 ? (
                                            <div className="h-64 w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={historyData.meter_history}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} vertical={false} />
                                                        <XAxis dataKey="date" stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} />
                                                        <YAxis stroke="#6B7280" fontSize={12} width={60} tickLine={false} axisLine={false} />
                                                        <RechartsTooltip
                                                            cursor={{fill: 'rgba(99, 102, 241, 0.1)'}}
                                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                                        />
                                                        <Bar dataKey="pages" fill="#6366F1" radius={[4, 4, 0, 0]} name="Pages Printed" />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 text-gray-500">
                                                ไม่มีข้อมูลสถิติการพิมพ์ที่เพียงพอ (จำเป็นต้องมีข้อมูลอย่างน้อย 2 วัน)
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="grid grid-cols-1 gap-4 mt-4">
                                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 flex flex-col items-center justify-center">
                                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">Total Page Count</span>
                                            <span className="text-2xl font-black text-gray-800 dark:text-gray-100">
                                                {selectedPrinterHistory?.page_count?.toLocaleString() || '-'}
                                            </span>
                                        </div>
                                    </div>
                                </>
                            ) : historyTab === 'docs' ? (
                                <div className="space-y-6">
                                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
                                        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                            <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">เอกสารประจำเครื่อง (Attachments)</h4>
                                            {user?.role?.toLowerCase() === 'admin' && (
                                                <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1 transition-colors">
                                                    <Upload className="w-3.5 h-3.5" />
                                                    <span>อัปโหลดไฟล์</span>
                                                    <input 
                                                        type="file" 
                                                        className="hidden" 
                                                        onChange={async (e) => {
                                                            const file = e.target.files?.[0];
                                                            if (!file) return;
                                                            
                                                            const formData = new FormData();
                                                            formData.append("file", file);
                                                            
                                                            try {
                                                                const res = await api.post(`/printers/${selectedPrinterHistory.id}/attachments`, formData, {
                                                                    headers: { "Content-Type": "multipart/form-data" }
                                                                });
                                                                setHistoryData(prev => ({
                                                                    ...prev,
                                                                    attachments: [res.data, ...prev.attachments]
                                                                }));
                                                            } catch (err) {
                                                                console.error("Upload failed", err);
                                                                alert("Failed to upload file");
                                                            }
                                                        }}
                                                    />
                                                </label>
                                            )}
                                        </div>
                                        <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-80 overflow-y-auto">
                                            {historyData.attachments && historyData.attachments.length > 0 ? (
                                                historyData.attachments.map((doc, i) => (
                                                    <div key={i} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                        <div className="flex items-center space-x-3 overflow-hidden">
                                                            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                                                                <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                                            </div>
                                                            <div className="flex flex-col min-w-0">
                                                                <a 
                                                                    href={api.defaults.baseURL?.replace('/api/v1', '') + doc.file_path} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer"
                                                                    className="font-medium text-sm text-indigo-600 dark:text-indigo-400 hover:underline truncate"
                                                                >
                                                                    {doc.file_name}
                                                                </a>
                                                                <span className="text-xs text-gray-500 flex items-center space-x-2">
                                                                    <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                                                                    <span>•</span>
                                                                    <span>{new Date(doc.uploaded_at.endsWith('Z') ? doc.uploaded_at : doc.uploaded_at + 'Z').toLocaleString('en-GB')}</span>
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {user?.role?.toLowerCase() === 'admin' && (
                                                            <button
                                                                onClick={async () => {
                                                                    if (confirm('ยืนยันการลบเอกสารนี้?')) {
                                                                        try {
                                                                            await api.delete(`/printers/${selectedPrinterHistory.id}/attachments/${doc.id}`);
                                                                            setHistoryData(prev => ({
                                                                                ...prev,
                                                                                attachments: prev.attachments.filter(a => a.id !== doc.id)
                                                                            }));
                                                                        } catch (err) {
                                                                            console.error("Failed to delete attachment", err);
                                                                        }
                                                                    }
                                                                }}
                                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-8 text-center flex flex-col items-center justify-center space-y-3">
                                                    <div className="w-12 h-12 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                                                        <Upload className="w-6 h-6 text-gray-300 dark:text-gray-600" />
                                                    </div>
                                                    <p className="text-gray-400 text-sm">ยังไม่มีเอกสารแนบ</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                                        <h4 className="text-sm font-bold mb-3">เพิ่มบันทึกซ่อมบำรุง</h4>
                                        <form onSubmit={handleAddMaintenance} className="flex gap-3">
                                            <input
                                                type="text"
                                                placeholder="รายละเอียด เช่น เติมหมึกดำ, แก้กระดาษติด..."
                                                value={newMaintenanceDesc}
                                                onChange={(e) => setNewMaintenanceDesc(e.target.value)}
                                                className="flex-1 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
                                                required
                                            />
                                            <input
                                                type="text"
                                                placeholder="ผู้ดำเนินการ (ไม่บังคับ)"
                                                value={newMaintenanceUser}
                                                onChange={(e) => setNewMaintenanceUser(e.target.value)}
                                                className="w-48 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
                                            />
                                            <button
                                                type="submit"
                                                disabled={submittingMaintenance}
                                                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm font-medium shadow-sm transition-colors disabled:opacity-50 flex items-center space-x-2"
                                            >
                                                <Plus size={16} />
                                                <span>บันทึก</span>
                                            </button>
                                        </form>
                                    </div>

                                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
                                        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                            <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">รายการซ่อมบำรุง</h4>
                                            <span className="text-xs bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-0.5 rounded-full font-medium">{historyData.maintenance_logs.length} รายการ</span>
                                        </div>
                                        <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[400px] overflow-y-auto">
                                            {historyData.maintenance_logs.length > 0 ? (
                                                historyData.maintenance_logs.map((log: any) => (
                                                    <div key={log.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex-1 space-y-1">
                                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{log.description}</p>
                                                                <div className="flex items-center text-xs text-gray-500 space-x-4">
                                                                    <span>{new Date(log.date.endsWith('Z') ? log.date : log.date + 'Z').toLocaleString('en-GB')}</span>
                                                                    {log.performed_by && <span>โดย: {log.performed_by}</span>}
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => handleDeleteMaintenance(log.id)}
                                                                className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                                                                title="Delete log"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-8 flex flex-col items-center justify-center text-gray-400 space-y-2">
                                                    <History size={32} className="opacity-20" />
                                                    <p className="text-sm">ยังไม่มีประวัติการซ่อมบำรุง</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}



            {/* Borrow Modal */}
            {isBorrowModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 dark:bg-black/70 transition-opacity">
                    <div className="bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-2xl transform transition-all w-full max-w-md border border-gray-300 dark:border-gray-600">
                        <div className="flex justify-between items-center px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                ระบุข้อมูลการยืมเครื่องพิมพ์
                            </h3>
                            <button onClick={() => setIsBorrowModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleBorrowSubmit}>
                            <div className="p-4 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        เครื่องพิมพ์ (Printer) <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                                        value={selectedPrinterBorrow?.id || ''}
                                        onChange={(e) => {
                                            const p = printers.find(x => x.id === parseInt(e.target.value));
                                            setSelectedPrinterBorrow(p || null);
                                        }}
                                    >
                                        <option value="" disabled>เลือกเครื่องพิมพ์...</option>
                                        {printers.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.hostname || p.ip_address} {p.borrowed_by ? `(ถูกยืมโดย: ${p.borrowed_by})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        แผนกที่ขอยืม (Department) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                                        placeholder="เช่น HR, IT, Marketing"
                                        value={borrowDepartment}
                                        onChange={(e) => setBorrowDepartment(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        หมายเหตุ (Remark)
                                    </label>
                                    <textarea
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                                        placeholder="ระบุเหตุผลการยืม..."
                                        rows={3}
                                        value={borrowRemark}
                                        onChange={(e) => setBorrowRemark(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 flex justify-end space-x-2 border-t border-gray-200 dark:border-gray-600">
                                <button
                                    type="button"
                                    onClick={() => setIsBorrowModalOpen(false)}
                                    className="px-4 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingBorrow || !borrowDepartment.trim()}
                                    className="px-4 py-1.5 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {submittingBorrow ? 'กำลังบันทึก...' : 'บันทึกการยืม'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Notifications Slide-over Panel */}
            <NotificationsPanel
                isOpen={isNotificationsOpen}
                onClose={() => setIsNotificationsOpen(false)}
            />
            {/* Modals */}
            <EditPrinterModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                printer={editingPrinter}
                onSaved={fetchPrinters}
            />

        </div>
    );
};

export default PrintersList;
