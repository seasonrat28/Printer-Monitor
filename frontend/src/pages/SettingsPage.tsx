import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Save, Ban, Trash2, Shield, Settings as SettingsIcon, Globe, ExternalLink, Copy } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

export const SettingsPage = () => {
    const { user: currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState<'blacklist' | 'advanced'>('blacklist');
    const { addToast } = useToast();

    // Advanced Settings State
    const [config, setConfig] = useState({
        lineToken: '',
        teamsWebhook: '',
        smtpServer: '',
        smtpPort: '587',
        smtpUser: '',
        smtpPassword: '',
        smtpFrom: '',
        smtpTo: '',
        monitoringInterval: '60',
        snmpTimeout: '5',
        snmpRetries: '3',
        tonerWarningThreshold: '20',
        tonerCriticalThreshold: '10'
    });
    
    // Blacklist State
    const [blacklist, setBlacklist] = useState<any[]>([]);
    const [newIp, setNewIp] = useState('');
    
    // Cloudflare Tunnel State
    const [tunnelRunning, setTunnelRunning] = useState(false);
    const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);
    const [tunnelLoading, setTunnelLoading] = useState(false);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (currentUser?.role === 'ADMIN') {
            fetchData();
        }
    }, [currentUser]);

    const fetchTunnelStatus = async () => {
        try {
            const res = await api.get('/settings/tunnel/status/');
            setTunnelRunning(res.data.is_running);
            setTunnelUrl(res.data.url);
        } catch (e) {
            console.error("Failed to fetch tunnel status", e);
        }
    };

    const handleToggleTunnel = async () => {
        try {
            setTunnelLoading(true);
            const res = await api.post('/settings/tunnel/toggle/');
            setTunnelRunning(res.data.is_running);
            if (res.data.status === 'stopped') {
                setTunnelUrl(null);
                addToast('success', 'Cloudflare Tunnel', 'ปิดการเข้าถึงจากภายนอกเรียบร้อยแล้ว');
            } else {
                addToast('success', 'Cloudflare Tunnel', 'กำลังเริ่มต้น Tunnel... ระบบจะดึงลิงก์ให้อัตโนมัติ');
                // Poll for URL for 15 seconds
                let tries = 0;
                const poll = setInterval(async () => {
                    tries++;
                    const st = await api.get('/settings/tunnel/status/').catch(() => ({ data: {} }));
                    if (st.data?.url) {
                        setTunnelUrl(st.data.url);
                        clearInterval(poll);
                        addToast('success', 'Public Link Ready', `ลิงก์สาธารณะ: ${st.data.url}`);
                    }
                    if (tries > 15) clearInterval(poll);
                }, 1500);
            }
        } catch (err: any) {
            addToast('error', 'Error', err.response?.data?.detail || 'Failed to toggle tunnel');
        } finally {
            setTunnelLoading(false);
        }
    };

    const handleCopyTunnelUrl = () => {
        if (!tunnelUrl) return;
        navigator.clipboard.writeText(tunnelUrl);
        addToast('success', 'Copied', 'คัดลอกลิงก์ไปยังคลิปบอร์ดแล้ว');
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const resSettings = await api.get('/settings/');
            setConfig(prev => ({ ...prev, ...resSettings.data.settings }));
            
            const resBlacklist = await api.get('/settings/blacklist/');
            setBlacklist(resBlacklist.data);

            await fetchTunnelStatus();
        } catch (err) {
            console.error("Failed to load settings data", err);
            addToast('error', 'Error', 'Failed to load settings data');
        } finally {
            setLoading(false);
        }
    };

    const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setConfig({ ...config, [e.target.name]: e.target.value });
    };

    const handleSaveConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.put('/settings/', { settings: config });
            addToast('success', 'Success', 'Settings saved successfully!');
        } catch (err) {
            addToast('error', 'Error', 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleAddBlacklist = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newIp) return;
        try {
            await api.post('/settings/blacklist', { ip_address: newIp });
            setNewIp('');
            fetchData();
            addToast('success', 'Success', `Added ${newIp} to Blacklist`);
        } catch (err: any) {
            addToast('error', 'Error', err.response?.data?.detail || 'Failed to add IP');
        }
    };

    const handleRemoveBlacklist = async (ip: string) => {
        try {
            await api.delete(`/settings/blacklist/${ip}`);
            fetchData();
            addToast('success', 'Removed', `Removed ${ip} from Blacklist`);
        } catch (err) {
            addToast('error', 'Error', 'Failed to remove IP');
        }
    };

    const handleClearBlacklist = async () => {
        if (!window.confirm("Are you sure you want to clear all IPs in the Blacklist?")) return;
        try {
            await api.delete('/settings/blacklist/all');
            fetchData();
            addToast('success', 'Cleared', 'All Blacklist IPs have been cleared');
        } catch (err) {
            addToast('error', 'Error', 'Failed to clear Blacklist');
        }
    };

    if (loading && currentUser?.role === 'ADMIN') return (
        <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    if (currentUser?.role !== 'ADMIN') {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                <Shield size={64} className="text-gray-300 dark:text-gray-700" />
                <h2 className="text-xl font-medium text-gray-500">Access Denied</h2>
                <p className="text-gray-400">You must be an administrator to view this page.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 sm:space-y-6 max-w-[1600px] mx-auto flex-1 w-full pb-12">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Settings</h2>
                {activeTab === 'advanced' && (
                    <Button onClick={handleSaveConfig} disabled={saving} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700">
                        <Save size={16} /> {saving ? 'Saving...' : 'Save Configuration'}
                    </Button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => setActiveTab('blacklist')}
                    className={`flex items-center space-x-2 py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === 'blacklist' 
                            ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' 
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400'
                    }`}
                >
                    <Ban size={18} />
                    <span>Blacklist IP</span>
                </button>
                <button
                    onClick={() => setActiveTab('advanced')}
                    className={`flex items-center space-x-2 py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === 'advanced' 
                            ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' 
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400'
                    }`}
                >
                    <SettingsIcon size={18} />
                    <span>Advanced Settings</span>
                </button>
            </div>

            <div className="pt-6">
                {activeTab === 'blacklist' && (
                    <div className="space-y-6">
                        {/* Cloudflare Tunnel Public Access Card */}
                        <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-white dark:bg-slate-800 shadow-sm p-6 space-y-5">
                            {/* Header row */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-start sm:items-center space-x-3.5">
                                    <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-sm shrink-0">
                                        <Globe size={22} />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-2.5">
                                            <h3 className="text-base font-bold text-gray-900 dark:text-white">
                                                การเข้าถึงจากภายนอก (Cloudflare Tunnel)
                                            </h3>
                                            <span className={`inline-flex items-center text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                                                tunnelRunning 
                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800' 
                                                    : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300 border-gray-200 dark:border-slate-600'
                                            }`}>
                                                {tunnelRunning ? '● เปิดใช้งานอยู่ (ONLINE)' : '○ ปิดการทำงาน (OFFLINE)'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                            เปิด-ปิดเพื่อให้ผู้ใช้ภายนอกเข้าถึงระบบผ่าน Cloudflare ได้โดยไม่ต้องเปิด Port Forward หรือมี Public IP
                                        </p>
                                    </div>
                                </div>

                                <Button
                                    onClick={handleToggleTunnel}
                                    disabled={tunnelLoading}
                                    className={`shrink-0 font-semibold text-sm px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm ${
                                        tunnelRunning 
                                            ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/20' 
                                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                                    }`}
                                >
                                    {tunnelLoading ? 'กำลังประมวลผล...' : (tunnelRunning ? '⏹️ ปิดการเข้าถึงจากภายนอก' : '🚀 เปิดให้คนนอกเข้าใช้งาน')}
                                </Button>
                            </div>

                            {/* Public Link Box - Well spaced with clear border & background */}
                            {tunnelRunning && (
                                <div className="mt-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-indigo-100/80 dark:border-slate-700">
                                    <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                                        <span className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide shrink-0">
                                            ลิงก์สำหรับคนภายนอก:
                                        </span>
                                        {tunnelUrl ? (
                                            <a 
                                                href={tunnelUrl} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="font-mono text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline flex items-center gap-1.5 break-all transition-colors"
                                            >
                                                {tunnelUrl}
                                                <ExternalLink size={14} className="shrink-0" />
                                            </a>
                                        ) : (
                                            <span className="text-sm text-amber-600 dark:text-amber-400 font-medium italic animate-pulse">
                                                กำลังรอ URL จาก Cloudflare... (รอสักครู่)
                                            </span>
                                        )}
                                    </div>
                                    {tunnelUrl && (
                                        <button 
                                            type="button"
                                            onClick={handleCopyTunnelUrl}
                                            className="shrink-0 px-3.5 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 transition-colors shadow-xs"
                                        >
                                            <Copy size={13} />
                                            <span>คัดลอกลิงก์</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <Card className="border border-gray-200 dark:border-gray-700 shadow-sm">
                            <CardHeader className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 rounded-t-xl">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center space-x-2 text-lg">
                                        <Shield className="text-indigo-500" size={20} />
                                        <span>Blacklist IP ({blacklist.length} รายการ)</span>
                                    </CardTitle>
                                    <p className="text-sm text-gray-500">IP ในรายการนี้จะไม่ถูกแสกนเข้าระบบ</p>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 pt-8">
                                {/* Add IP Form */}
                                <form onSubmit={handleAddBlacklist} className="flex space-x-3 mb-8">
                                    <Input 
                                        type="text" 
                                        placeholder="ใส่ IP เช่น 192.168.1.25" 
                                        value={newIp} 
                                        onChange={(e) => setNewIp(e.target.value)} 
                                        className="max-w-xs"
                                    />
                                    <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">เพิ่ม IP</Button>
                                </form>

                                {/* IP List */}
                                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-6">
                                    {blacklist.length === 0 ? (
                                        <div className="p-8 text-center text-gray-500">ยังไม่มี IP ใน Blacklist</div>
                                    ) : (
                                        <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                                            {blacklist.map((item) => (
                                                <div key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                    <span className="font-medium text-gray-900 dark:text-gray-100">{item.ip_address}</span>
                                                    <button 
                                                        onClick={() => handleRemoveBlacklist(item.ip_address)}
                                                        className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end">
                                    <Button 
                                        onClick={handleClearBlacklist} 
                                        disabled={blacklist.length === 0}
                                        className="bg-red-600 hover:bg-red-700 text-white"
                                    >
                                        ล้างทั้งหมด
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {activeTab === 'advanced' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Monitoring & SNMP</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Monitoring Interval (sec)</label>
                                        <Input name="monitoringInterval" value={config.monitoringInterval} onChange={handleConfigChange} placeholder="60" type="number" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">SNMP Timeout (sec)</label>
                                        <Input name="snmpTimeout" value={config.snmpTimeout} onChange={handleConfigChange} placeholder="5" type="number" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">SNMP Retries</label>
                                        <Input name="snmpRetries" value={config.snmpRetries} onChange={handleConfigChange} placeholder="3" type="number" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Toner Warning (%)</label>
                                        <Input name="tonerWarningThreshold" value={config.tonerWarningThreshold} onChange={handleConfigChange} placeholder="20" type="number" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Toner Critical (%)</label>
                                        <Input name="tonerCriticalThreshold" value={config.tonerCriticalThreshold} onChange={handleConfigChange} placeholder="10" type="number" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Notifications & Alerts</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">LINE Notify Token</label>
                                    <Input name="lineToken" value={config.lineToken || ''} onChange={handleConfigChange} placeholder="Line token here" />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium">MS Teams Webhook URL</label>
                                        {config.teamsWebhook && (
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    try {
                                                        // 1. Try backend endpoint first
                                                        await api.post('/settings/test-teams');
                                                        addToast('success', 'Teams Webhook', 'ส่งข้อความทดสอบสำเร็จ! ตรวจสอบที่ Teams ได้เลย');
                                                    } catch (err: any) {
                                                        // 2. If backend endpoint not loaded yet, send directly via fetch to webhook URL!
                                                        if (config.teamsWebhook) {
                                                            try {
                                                                const payload = {
                                                                    type: "AdaptiveCard",
                                                                    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
                                                                    version: "1.4",
                                                                    title: "Test Alert จาก Enterprise Printer Monitor",
                                                                    text: "ทดสอบการส่งข้อความแจ้งเตือนจากหน้าเว็บ Enterprise Printer Monitor เข้า Teams สำเร็จเรียบร้อยแล้ว!",
                                                                    severity: "WARNING",
                                                                    summary: "Test Alert",
                                                                    body: [
                                                                        {
                                                                            type: "Container",
                                                                            items: [
                                                                                {
                                                                                    type: "TextBlock",
                                                                                    text: "🖨️ Test Alert จาก Enterprise Printer Monitor",
                                                                                    weight: "Bolder",
                                                                                    size: "Medium",
                                                                                    color: "Warning",
                                                                                    wrap: true
                                                                                },
                                                                                {
                                                                                    type: "TextBlock",
                                                                                    text: "ทดสอบการส่งข้อความแจ้งเตือนจากหน้าเว็บเข้าสู่ Teams สำเร็จเรียบร้อยแล้ว!",
                                                                                    wrap: true,
                                                                                    spacing: "Small"
                                                                                }
                                                                            ]
                                                                        }
                                                                    ]
                                                                };
                                                                await fetch(config.teamsWebhook, {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify(payload)
                                                                });
                                                                addToast('success', 'Teams Webhook', 'ส่งข้อความทดสอบสำเร็จ! ตรวจสอบที่ Teams ได้เลย');
                                                            } catch (fetchErr) {
                                                                addToast('error', 'Error', 'ไม่สามารถส่ง Webhook ได้ กรุณาตรวจสอบ URL หรือรีสตาร์ท Backend');
                                                            }
                                                        } else {
                                                            addToast('error', 'Error', err.response?.data?.detail || 'ส่งข้อความทดสอบไม่สำเร็จ');
                                                        }
                                                    }
                                                }}
                                                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium hover:underline"
                                            >
                                                🔔 ทดสอบส่งข้อความ (Test)
                                            </button>
                                        )}
                                    </div>
                                    <Input name="teamsWebhook" value={config.teamsWebhook || ''} onChange={handleConfigChange} placeholder="https://..." />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle>SMTP Email Settings</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Server Address</label>
                                        <Input name="smtpServer" value={config.smtpServer || ''} onChange={handleConfigChange} placeholder="smtp.example.com" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Port</label>
                                        <Input name="smtpPort" value={config.smtpPort || ''} onChange={handleConfigChange} placeholder="587" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Username</label>
                                        <Input name="smtpUser" value={config.smtpUser || ''} onChange={handleConfigChange} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Password</label>
                                        <Input type="password" name="smtpPassword" value={config.smtpPassword || ''} onChange={handleConfigChange} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">From Email</label>
                                        <Input name="smtpFrom" value={config.smtpFrom || ''} onChange={handleConfigChange} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">To Email</label>
                                        <Input name="smtpTo" value={config.smtpTo || ''} onChange={handleConfigChange} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
};
