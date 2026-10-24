import { useState, useEffect, useRef } from 'react';
import { Terminal, RefreshCw, Shield, Laptop, Smartphone, Monitor, Globe, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface LoginLog {
    id: number;
    username: string;
    display_name?: string;
    role?: string;
    ip_address?: string;
    hostname?: string;
    device_type?: string;
    os_name?: string;
    browser_name?: string;
    status: string;
    fail_reason?: string;
    login_at: string;
}

const SystemLogs = () => {
    const [activeTab, setActiveTab] = useState<'system' | 'login'>('system');
    
    // System Logs state
    const [logs, setLogs] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Login History state
    const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
    const [loginLoading, setLoginLoading] = useState(false);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const response = await api.get('/logs/?lines=500');
            setLogs(response.data.logs || []);
        } catch (error) {
            console.error("Failed to fetch logs", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchLoginHistory = async () => {
        try {
            setLoginLoading(true);
            const response = await api.get('/logs/login-history?limit=100');
            setLoginLogs(response.data || []);
        } catch (error) {
            console.error("Failed to fetch login history", error);
        } finally {
            setLoginLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'system') {
            fetchLogs();
        } else {
            fetchLoginHistory();
        }
    }, [activeTab]);

    useEffect(() => {
        let interval: any;
        if (autoRefresh && activeTab === 'system') {
            interval = setInterval(() => {
                fetchLogs();
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [autoRefresh, activeTab]);

    useEffect(() => {
        if (logsEndRef.current && autoRefresh && activeTab === 'system') {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, autoRefresh, activeTab]);

    const triggerSync = async () => {
        try {
            await api.post('/printers/sync');
            fetchLogs();
        } catch (error) {
            console.error("Failed to trigger sync", error);
            alert("Failed to trigger sync");
        }
    };

    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN';
    const [isClearModalOpen, setIsClearModalOpen] = useState(false);
    const [clearConfirmText, setClearConfirmText] = useState('');

    // Delete single login log
    const handleDeleteLoginLog = async (id: number) => {
        if (!window.confirm("คุณต้องการลบรายการบันทึกนี้ใช่หรือไม่?")) return;
        try {
            await api.delete(`/logs/login-history/${id}/`);
            setLoginLogs(prev => prev.filter(l => l.id !== id));
        } catch (error: any) {
            console.error("Failed to delete login log", error);
            alert("ไม่สามารถลบรายการได้: " + (error.response?.data?.detail || error.message));
        }
    };

    // Clear all login logs with 2-step verification modal
    const handleClearAllLoginLogs = async () => {
        if (clearConfirmText !== 'DELETE') {
            alert('กรุณาพิมพ์คำว่า DELETE เพื่อยืนยันการล้างประวัติทั้งหมด');
            return;
        }
        try {
            setLoginLoading(true);
            await api.delete('/logs/login-history/all/');
            setLoginLogs([]);
            setIsClearModalOpen(false);
            setClearConfirmText('');
        } catch (error: any) {
            console.error("Failed to clear login logs", error);
            alert("ไม่สามารถล้างประวัติได้: " + (error.response?.data?.detail || error.message));
        } finally {
            setLoginLoading(false);
        }
    };

    const formatDateTime = (dateStr: string) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
        return d.toLocaleString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const getDeviceIcon = (deviceType?: string) => {
        if (deviceType === 'Mobile') return <Smartphone size={16} className="text-amber-500" />;
        if (deviceType === 'Tablet') return <Laptop size={16} className="text-purple-500" />;
        return <Monitor size={16} className="text-blue-500" />;
    };

    return (
        <div className="space-y-6 flex flex-col h-[calc(100vh-100px)] max-w-[1600px] mx-auto w-full">
            {/* Header Title */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center space-x-2">
                        <Terminal className="h-6 w-6 text-indigo-600" />
                        <span>System Logs & Security</span>
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 h-5">
                        {activeTab === 'system' ? 'Live background operations and sync status' : 'ประวัติการเข้าสู่ระบบ (Login History) ตรวจสอบอุปกรณ์ คอมพิวเตอร์ และ IP'}
                    </p>
                </div>
            </div>

            {/* Sub-bar: Navigation Tabs (Fixed at Left) & Action Buttons (Right) */}
            <div className="flex justify-between items-center gap-4 shrink-0 pb-3 border-b border-gray-200 dark:border-slate-800">
                {/* Navigation Tabs - Always static at left-most */}
                <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700">
                    <button
                        onClick={() => setActiveTab('system')}
                        className={`w-36 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                            activeTab === 'system'
                                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <Terminal size={15} />
                        <span>System Logs</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('login')}
                        className={`w-36 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                            activeTab === 'login'
                                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <Shield size={15} />
                        <span>Login History</span>
                    </button>
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-3">
                    {activeTab === 'system' && (
                        <>
                            <button 
                                onClick={triggerSync}
                                className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg flex items-center space-x-2 hover:bg-emerald-700 transition-colors shadow-sm text-sm font-medium"
                                title="Force the backend to sync all printers right now"
                            >
                                <RefreshCw size={14} />
                                <span>Force Sync</span>
                            </button>
                            <label className="flex items-center space-x-2 cursor-pointer border-l border-gray-300 dark:border-gray-600 pl-3">
                                <input 
                                    type="checkbox" 
                                    checked={autoRefresh} 
                                    onChange={(e) => setAutoRefresh(e.target.checked)}
                                    className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Auto (3s)</span>
                            </label>
                            <button 
                                onClick={fetchLogs}
                                disabled={loading}
                                className={`px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg flex items-center space-x-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm text-sm font-medium ${loading ? 'opacity-50' : ''}`}
                            >
                                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                                <span>Refresh</span>
                            </button>
                        </>
                    )}

                    {activeTab === 'login' && (
                        <>
                            {isAdmin && loginLogs.length > 0 && (
                                <button 
                                    onClick={() => setIsClearModalOpen(true)}
                                    disabled={loginLoading}
                                    className="px-3 py-1.5 border border-red-300 dark:border-red-900/60 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg flex items-center space-x-1.5 transition-colors shadow-sm text-sm font-medium"
                                    title="ล้างประวัติการเข้าสู่ระบบทั้งหมด"
                                >
                                    <Trash2 size={14} />
                                    <span>ล้างประวัติทั้งหมด</span>
                                </button>
                            )}
                            <button 
                                onClick={fetchLoginHistory}
                                disabled={loginLoading}
                                className={`px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg flex items-center space-x-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm text-sm font-medium ${loginLoading ? 'opacity-50' : ''}`}
                            >
                                <RefreshCw size={14} className={loginLoading ? 'animate-spin' : ''} />
                                <span>Refresh</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* TAB 1: System Logs Terminal */}
            {activeTab === 'system' && (
                <div className="flex-1 bg-[#1e1e1e] rounded-xl shadow-inner border border-gray-800 overflow-hidden flex flex-col font-mono text-sm">
                    <div className="bg-[#2d2d2d] px-4 py-2 border-b border-gray-800 flex justify-between items-center shrink-0">
                        <div className="flex space-x-2">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        </div>
                        <span className="text-gray-400 text-xs">backend.log</span>
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto text-gray-300 space-y-1">
                        {logs.length === 0 ? (
                            <div className="text-gray-500 italic">No logs available...</div>
                        ) : (
                            logs.map((log, idx) => (
                                <div key={idx} className="whitespace-pre-wrap break-words leading-tight">
                                    {log.includes('ERROR') ? (
                                        <span className="text-red-400">{log}</span>
                                    ) : log.includes('WARNING') ? (
                                        <span className="text-amber-400">{log}</span>
                                    ) : log.includes('Checking status') || log.includes('Checking supplies') ? (
                                        <span className="text-emerald-400 font-medium">{log}</span>
                                    ) : log.includes('INFO') ? (
                                        <span className="text-blue-300">{log}</span>
                                    ) : (
                                        <span>{log}</span>
                                    )}
                                </div>
                            ))
                        )}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            )}

            {/* TAB 2: Login History Table */}
            {activeTab === 'login' && (
                <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col">
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                            <thead className="bg-gray-50 dark:bg-slate-900/60 text-xs uppercase font-bold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700 sticky top-0">
                                <tr>
                                    <th className="px-5 py-3.5">ผู้ใช้งาน (User)</th>
                                    <th className="px-5 py-3.5">สถานะ (Status)</th>
                                    <th className="px-5 py-3.5">อุปกรณ์ / ระบบปฏิบัติการ</th>
                                    <th className="px-5 py-3.5">เบราว์เซอร์ (Browser)</th>
                                    <th className="px-5 py-3.5">IP Address</th>
                                    <th className="px-5 py-3.5">ชื่อเครื่อง / คอมพิวเตอร์</th>
                                    <th className="px-5 py-3.5">เวลาที่เข้าสู่ระบบ</th>
                                    {isAdmin && <th className="px-5 py-3.5 text-center w-20">จัดการ</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
                                {loginLoading ? (
                                    <tr>
                                        <td colSpan={isAdmin ? 8 : 7} className="px-6 py-12 text-center text-gray-400 italic">
                                            กำลังโหลดประวัติการเข้าสู่ระบบ...
                                        </td>
                                    </tr>
                                ) : loginLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={isAdmin ? 8 : 7} className="px-6 py-12 text-center text-gray-400 italic">
                                            ยังไม่มีประวัติการเข้าใช้งานระบบในขณะนี้
                                        </td>
                                    </tr>
                                ) : (
                                    loginLogs.map((item) => (
                                        <tr key={item.id} className="hover:bg-gray-50/70 dark:hover:bg-slate-700/40 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <div className="font-semibold text-gray-900 dark:text-white">
                                                    {item.username}
                                                </div>
                                                {item.display_name && (
                                                    <div className="text-xs text-gray-400">
                                                        {item.display_name} {item.role ? `(${item.role})` : ''}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                {item.status === 'SUCCESS' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                                                        <CheckCircle2 size={13} />
                                                        สำเร็จ
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/60" title={item.fail_reason || ''}>
                                                        <XCircle size={13} />
                                                        ล้มเหลว
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-2">
                                                    {getDeviceIcon(item.device_type)}
                                                    <span className="font-medium text-gray-800 dark:text-gray-200">
                                                        {item.os_name || 'ไม่ระบุ OS'}
                                                    </span>
                                                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400">
                                                        {item.device_type || 'Desktop'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="text-gray-700 dark:text-gray-300 font-medium">
                                                    {item.browser_name || 'Web Browser'}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 font-mono text-xs">
                                                <div className="flex items-center gap-1.5">
                                                    <Globe size={13} className="text-slate-400" />
                                                    <span className="bg-slate-100 dark:bg-slate-700/80 px-2 py-0.5 rounded text-gray-800 dark:text-gray-200 font-semibold">
                                                        {item.ip_address || '-'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 font-mono text-xs">
                                                <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                                                    {item.hostname || '-'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                                                {formatDateTime(item.login_at)}
                                            </td>
                                            {isAdmin && (
                                                <td className="px-5 py-3.5 text-center">
                                                    <button
                                                        onClick={() => handleDeleteLoginLog(item.id)}
                                                        className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                                                        title="ลบรายการนี้"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 2-Step Verification Modal for Clearing All Login Logs */}
            {isClearModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-red-200 dark:border-red-900/60 max-w-md w-full p-6 space-y-4">
                        <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                            <div className="p-3 bg-red-100 dark:bg-red-950/60 rounded-xl">
                                <Trash2 size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">ยืนยันการล้างประวัติทั้งหมด</h3>
                                <p className="text-xs text-gray-500">Security Audit Compliance Safeguard</p>
                            </div>
                        </div>

                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                            การดำเนินการนี้จะทำการลบประวัติการเข้าใช้งานระบบทั้งหมดออกจากฐานข้อมูล และ <span className="font-bold text-red-600 dark:text-red-400">ไม่สามารถกู้คืนได้</span>
                        </p>

                        <div className="space-y-1.5 pt-1">
                            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                พิมพ์คำว่า <span className="font-mono text-red-600 font-bold">DELETE</span> เพื่อยืนยัน:
                            </label>
                            <input
                                type="text"
                                value={clearConfirmText}
                                onChange={e => setClearConfirmText(e.target.value)}
                                placeholder="DELETE"
                                autoFocus
                                className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2.5 pt-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsClearModalOpen(false);
                                    setClearConfirmText('');
                                }}
                                className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 text-sm font-semibold transition-colors"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="button"
                                onClick={handleClearAllLoginLogs}
                                disabled={clearConfirmText !== 'DELETE' || loginLoading}
                                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-sm font-bold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loginLoading ? 'กำลังลบ...' : 'ยืนยันลบทั้งหมด'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SystemLogs;

