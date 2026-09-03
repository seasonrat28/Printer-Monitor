import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Download, FileText, FileSpreadsheet, Printer, AlertTriangle, CheckCircle2, Layers } from 'lucide-react';

interface Stats {
    total_printers: number;
    online: number;
    offline: number;
    error: number;
    active_alerts: number;
    critical_alerts: number;
    total_pages_printed: number;
    avg_response_ms: number | null;
    low_toner_printers: number;
    generated_at: string;
}

const StatCard = ({ icon: Icon, label, value, color }: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    color: string;
}) => (
    <div className={`rounded-xl p-5 flex items-center gap-4 ${color}`}>
        <div className="bg-white/20 rounded-lg p-3">
            <Icon size={22} className="text-white" />
        </div>
        <div>
            <p className="text-white/80 text-sm font-medium">{label}</p>
            <p className="text-white text-2xl font-bold">{value}</p>
        </div>
    </div>
);

const API_BASE = `${import.meta.env.VITE_API_URL}/api/v1`;

export const ReportsPage = () => {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        fetch(`${API_BASE}/reports/stats`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(r => {
                if (!r.ok) throw new Error('Failed to fetch stats');
                return r.json();
            })
            .then(data => { setStats(data); setLoading(false); })
            .catch(() => { setStats(null); setLoading(false); });
    }, []);

    const download = (endpoint: string) => {
        const token = localStorage.getItem('access_token');
        fetch(`${API_BASE}/reports/${endpoint}`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(r => r.blob())
            .then(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = endpoint === 'excel'
                    ? `printers_${new Date().toISOString().slice(0, 10)}.xlsx`
                    : `printers_${new Date().toISOString().slice(0, 10)}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
            });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">Reports & Analytics</h2>
                {stats && (
                    <p className="text-xs text-gray-400">
                        Last updated: {new Date(stats.generated_at).toLocaleString()}
                    </p>
                )}
            </div>

            {/* Stats Grid */}
            {loading ? (
                <div className="text-gray-400 text-sm">Loading statistics…</div>
            ) : stats ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard icon={Printer}       label="Total Printers"       value={stats.total_printers}      color="bg-gradient-to-br from-blue-500 to-indigo-600" />
                    <StatCard icon={CheckCircle2}  label="Online"               value={stats.online}              color="bg-gradient-to-br from-emerald-500 to-green-600" />
                    <StatCard icon={AlertTriangle} label="Active Alerts"        value={stats.active_alerts}       color="bg-gradient-to-br from-amber-500 to-orange-600" />
                    <StatCard icon={AlertTriangle} label="Critical Alerts"      value={stats.critical_alerts}     color="bg-gradient-to-br from-red-500 to-rose-700" />
                    <StatCard icon={Printer}       label="Offline"              value={stats.offline}             color="bg-gradient-to-br from-slate-500 to-slate-700" />
                    <StatCard icon={Layers}        label="Pages Printed"        value={stats.total_pages_printed.toLocaleString()} color="bg-gradient-to-br from-violet-500 to-purple-700" />
                    <StatCard icon={AlertTriangle} label="Low Toner Printers"   value={stats.low_toner_printers}  color="bg-gradient-to-br from-yellow-500 to-amber-600" />
                    <StatCard icon={CheckCircle2}  label="Avg Response"         value={stats.avg_response_ms ? `${stats.avg_response_ms} ms` : 'N/A'} color="bg-gradient-to-br from-cyan-500 to-teal-600" />
                </div>
            ) : (
                <div className="text-red-400 text-sm">Could not load statistics from backend.</div>
            )}

            {/* Export Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileSpreadsheet className="text-green-600" size={20} />
                            Excel Export
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Multi-sheet workbook including:
                        </p>
                        <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc list-inside space-y-1">
                            <li>Printer Inventory (status, counters)</li>
                            <li>Supplies & Toner Levels</li>
                            <li>Active Alerts</li>
                        </ul>
                        <Button
                            onClick={() => download('excel')}
                            className="w-full mt-2 bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
                        >
                            <Download size={16} /> Download Excel (.xlsx)
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="text-red-600" size={20} />
                            PDF Export
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Formatted PDF report including:
                        </p>
                        <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc list-inside space-y-1">
                            <li>Full printer table with status color coding</li>
                            <li>Active alerts section</li>
                            <li>Timestamp and report metadata</li>
                        </ul>
                        <Button
                            onClick={() => download('pdf')}
                            className="w-full mt-2 bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2"
                        >
                            <Download size={16} /> Download PDF
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
