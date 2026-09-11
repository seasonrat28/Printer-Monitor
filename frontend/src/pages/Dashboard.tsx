import { useEffect, useState, useCallback, useRef } from 'react';
import { printerService } from '../services/api';
import { useWebSocket } from '../contexts/WebSocketContext';
import { Printer, AlertTriangle, CheckCircle2, XCircle, ChevronRight, Clock, Award, BarChart3, Bell, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MetricGrid } from '../components/MetricGrid';
import api from '../services/api';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const Dashboard = () => {
    const [summary, setSummary] = useState<any>({
        status_summary: { total: 0, online: 0, offline: 0, warning: 0 },
        metrics: { active_alerts: 0, critical_alerts: 0, pages_printed: 0, low_toner_printers: 0, avg_response: 'N/A' },
        consumables_alert: [],
        recent_alerts: [],
        top_printers: [],
        department_distribution: []
    });
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [secondsAgo, setSecondsAgo] = useState(0);
    const { lastEvent, isConnected } = useWebSocket();

    // Debounced fetch — caps at 1 API call per 3 seconds
    const summaryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastFetchRef = useRef<number>(0);

    const fetchSummary = useCallback(async () => {
        try {
            const res = await printerService.getDashboardSummary();
            setSummary(res.data);
            setLastUpdated(new Date());
            lastFetchRef.current = Date.now();
        } catch (error) {
            console.error("Failed to load dashboard summary", error);
        } finally {
            setLoading(false);
        }
    }, []);

    const debouncedFetchSummary = useCallback(() => {
        const cooldown = 3000; // 3 seconds
        const now = Date.now();
        if (summaryTimerRef.current) clearTimeout(summaryTimerRef.current);
        const remaining = cooldown - (now - lastFetchRef.current);
        if (remaining <= 0) {
            fetchSummary();
        } else {
            summaryTimerRef.current = setTimeout(fetchSummary, remaining);
        }
    }, [fetchSummary]);

    // Initial load
    useEffect(() => {
        fetchSummary();
    }, [fetchSummary]);

    // Auto-refresh every 60 seconds as safety net
    useEffect(() => {
        const interval = setInterval(() => fetchSummary(), 60_000);
        return () => clearInterval(interval);
    }, [fetchSummary]);

    // Refresh on WebSocket events
    useEffect(() => {
        if (lastEvent) {
            debouncedFetchSummary();
        }
    }, [lastEvent, debouncedFetchSummary]);

    // Live "X seconds ago" counter
    useEffect(() => {
        const tick = setInterval(() => {
            if (lastUpdated) {
                setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
            }
        }, 1000);
        return () => clearInterval(tick);
    }, [lastUpdated]);

    const handleSyncNow = async () => {
        if (syncing) return;
        setSyncing(true);
        try {
            await api.post('/printers/sync');
            // Data will refresh via SYNC_COMPLETE WebSocket event
            // But also fetch immediately for quick feedback
            setTimeout(() => fetchSummary(), 1500);
        } catch (err) {
            console.error('Sync failed', err);
        } finally {
            setTimeout(() => setSyncing(false), 3000);
        }
    };

    const formatSecondsAgo = (secs: number) => {
        if (secs < 5)  return 'just now';
        if (secs < 60) return `${secs}s ago`;
        const m = Math.floor(secs / 60);
        return `${m}m ago`;
    };

    const { total, online, offline, warning } = summary.status_summary;
    const metrics = summary.metrics || { active_alerts: 0, critical_alerts: 0, pages_printed: 0, low_toner_printers: 0, avg_response: 'N/A' };
    const { recent_alerts = [], top_printers = [], department_distribution = [] } = summary;

    // Calculate percentages for the combined status bar
    const onlinePct = total > 0 ? (online / total) * 100 : 0;
    const warningPct = total > 0 ? (warning / total) * 100 : 0;
    const offlinePct = total > 0 ? (offline / total) * 100 : 0;

    const formatTimeAgo = (dateStr: string) => {
        if (!dateStr) return '';
        const diff = Date.now() - new Date(dateStr).getTime();
        const minutes = Math.floor(diff / 60000);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-gray-800 dark:text-gray-200">Device Summary</h2>
                    {lastUpdated && (
                        <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                            <Clock size={10} />
                            Updated {formatSecondsAgo(secondsAgo)}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {/* Sync Now button */}
                    <button
                        onClick={handleSyncNow}
                        disabled={syncing}
                        title="Sync all printers now"
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border transition-all
                            ${ syncing
                                ? 'bg-indigo-50 text-indigo-400 border-indigo-200 cursor-not-allowed'
                                : 'bg-white text-indigo-600 border-indigo-300 hover:bg-indigo-50 hover:border-indigo-400 active:scale-95'}`}
                    >
                        <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? 'Syncing...' : 'Sync Now'}
                    </button>

                    {/* Connection status */}
                    <div className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-900 px-3 py-1.5 rounded-md border border-gray-100 dark:border-gray-800">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Connection:</span>
                        <span className="flex items-center space-x-1">
                            <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                            <span className={`text-xs font-bold ${isConnected ? 'text-emerald-600' : 'text-red-600'}`}>
                                {isConnected ? 'ONLINE' : 'OFFLINE'}
                            </span>
                        </span>
                    </div>
                </div>
            </div>

            <MetricGrid
                total={total}
                online={online}
                activeAlerts={metrics.active_alerts}
                criticalAlerts={metrics.critical_alerts}
                offline={offline}
                pagesPrinted={metrics.pages_printed}
                lowToner={metrics.low_toner_printers}
                avgResponse={metrics.avg_response}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Status Panel (Left) */}
                <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 rounded-t-xl">
                        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Device Status</h3>
                    </div>

                    <div className="p-6 flex-1 flex flex-col justify-center">
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="border-2 border-emerald-500 rounded-lg p-4 flex flex-col items-center justify-center relative overflow-hidden group hover:bg-emerald-50 transition-colors">
                                <div className="flex items-center space-x-1 text-emerald-600 mb-1">
                                    <CheckCircle2 size={16} />
                                    <span className="font-bold text-sm">Ready</span>
                                </div>
                                <span className="text-3xl font-black text-emerald-700">{online}</span>
                            </div>

                            <div className="border-2 border-amber-500 rounded-lg p-4 flex flex-col items-center justify-center relative overflow-hidden group hover:bg-amber-50 transition-colors">
                                <div className="flex items-center space-x-1 text-amber-600 mb-1">
                                    <AlertTriangle size={16} />
                                    <span className="font-bold text-sm">Attention</span>
                                </div>
                                <span className="text-3xl font-black text-amber-700">{warning}</span>
                            </div>

                            <div className="border-2 border-red-500 rounded-lg p-4 flex flex-col items-center justify-center relative overflow-hidden group hover:bg-red-50 transition-colors">
                                <div className="flex items-center space-x-1 text-red-600 mb-1">
                                    <XCircle size={16} />
                                    <span className="font-bold text-sm">Error</span>
                                </div>
                                <span className="text-3xl font-black text-red-700">{offline}</span>
                            </div>

                            <div className="border-2 border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center relative overflow-hidden bg-gray-50">
                                <div className="flex items-center space-x-1 text-gray-500 mb-1">
                                    <Printer size={16} />
                                    <span className="font-bold text-sm">Total</span>
                                </div>
                                <span className="text-3xl font-black text-gray-700">{total}</span>
                            </div>
                        </div>

                        {/* Combined Progress Bar */}
                        <div className="w-full h-4 bg-gray-100 rounded-sm overflow-hidden flex border border-gray-200">
                            <div style={{ width: `${onlinePct}%` }} className="h-full bg-emerald-500 transition-all duration-500" title={`Ready: ${online}`}></div>
                            <div style={{ width: `${warningPct}%` }} className="h-full bg-amber-500 transition-all duration-500" title={`Attention: ${warning}`}></div>
                            <div style={{ width: `${offlinePct}%` }} className="h-full bg-red-500 transition-all duration-500" title={`Error: ${offline}`}></div>
                        </div>
                        <div className="flex justify-end mt-1">
                            <span className="text-[10px] text-gray-400 font-medium">{total} Devices</span>
                        </div>
                    </div>
                </div>

                {/* Consumables Panel (Right) */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 rounded-t-xl flex justify-between items-center">
                        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Consumables Requiring Replacement</h3>
                        <span className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded border border-gray-200">Toner &lt; 10%</span>
                    </div>

                    <div className="p-0 flex-1">
                        {loading ? (
                            <div className="flex items-center justify-center h-full min-h-[200px] text-gray-400">Loading data...</div>
                        ) : summary.consumables_alert.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-emerald-500 bg-emerald-50/30 m-4 rounded-lg border border-emerald-100">
                                <CheckCircle2 size={40} className="mb-3 opacity-80" />
                                <span className="font-bold text-sm">No replacements needed</span>
                                <span className="text-xs text-gray-500 mt-1">All printer consumables are at healthy levels.</span>
                            </div>
                        ) : (
                            <div className="overflow-x-auto h-full">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-800/50">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Device</th>
                                            <th scope="col" className="px-6 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Type</th>
                                            <th scope="col" className="px-6 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Level</th>
                                            <th scope="col" className="px-6 py-3 text-right text-[11px] font-bold text-gray-500 uppercase tracking-wider">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                                        {summary.consumables_alert.map((alert: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-red-50/30 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="flex-shrink-0 h-8 w-8 rounded bg-gray-100 flex items-center justify-center border border-gray-200">
                                                            <Printer size={16} className="text-gray-500" />
                                                        </div>
                                                        <div className="ml-4">
                                                            <div className="text-sm font-bold text-gray-900 dark:text-white">{alert.hostname || alert.ip_address}</div>
                                                            <div className="text-xs text-gray-500">{alert.ip_address}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 py-1 inline-flex text-[10px] leading-4 font-bold rounded-sm border ${alert.type === 'Toner' ? 'bg-gray-900 text-white border-black' : 'bg-blue-100 text-blue-800 border-blue-200'}`}>
                                                        {alert.type === 'Toner' ? 'BK' : 'DR'} {alert.type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center space-x-2">
                                                        <span className="text-sm font-black text-red-600 w-8">{alert.level}%</span>
                                                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden border border-gray-300">
                                                            <div className="h-full bg-red-500" style={{ width: `${alert.level}%` }}></div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <Link to="/printers" className="text-gray-500 hover:text-gray-900 bg-white border border-gray-300 px-3 py-1 rounded shadow-sm inline-flex items-center text-xs font-bold transition-all hover:bg-gray-50">
                                                        Details <ChevronRight size={14} className="ml-1" />
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top Printers by Volume */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col h-[380px]">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 rounded-t-xl flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                            <Award size={18} className="text-indigo-500" />
                            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Top Printers by Volume</h3>
                        </div>
                    </div>
                    <div className="p-0 flex-1 overflow-y-auto">
                        {top_printers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-4 text-center">
                                <span className="text-sm">No printer usage data available</span>
                            </div>
                        ) : (
                            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                                {top_printers.map((printer: any, index: number) => (
                                    <li key={printer.printer_id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 font-bold flex items-center justify-center text-xs">
                                                #{index + 1}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-gray-800 dark:text-gray-200">{printer.hostname || printer.ip_address}</div>
                                                <div className="text-xs text-gray-500 truncate max-w-[120px]">{printer.model || 'Unknown Model'}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-black text-indigo-600">{printer.total_pages?.toLocaleString() || 0}</div>
                                            <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Pages</div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Department Distribution */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col h-[380px]">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 rounded-t-xl flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                            <BarChart3 size={18} className="text-blue-500" />
                            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Devices by Department</h3>
                        </div>
                    </div>
                    <div className="p-4 flex-1">
                        {department_distribution.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-4 text-center">
                                <span className="text-sm">No department data available</span>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={department_distribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {department_distribution.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip 
                                        formatter={(value: number) => [`${value} Devices`, 'Count']}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Recent Alerts Feed */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col h-[380px]">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 rounded-t-xl flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                            <Bell size={18} className="text-rose-500" />
                            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Recent Alerts</h3>
                        </div>
                    </div>
                    <div className="p-0 flex-1 overflow-y-auto">
                        {recent_alerts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-emerald-500 bg-emerald-50/30 m-4 rounded-lg border border-emerald-100 p-6 text-center">
                                <CheckCircle2 size={32} className="mb-2 opacity-80" />
                                <span className="font-bold text-sm">All clear!</span>
                                <span className="text-xs text-gray-500 mt-1">No recent unresolved alerts.</span>
                            </div>
                        ) : (
                            <div className="p-4 space-y-4">
                                {recent_alerts.map((alert: any) => (
                                    <div key={alert.id} className="flex items-start space-x-3">
                                        <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${alert.severity === 'CRITICAL' ? 'bg-rose-500' : 'bg-amber-500'}`}></div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-baseline mb-0.5">
                                                <span className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate pr-2">
                                                    {alert.hostname || alert.ip_address}
                                                </span>
                                                <span className="text-[10px] text-gray-400 whitespace-nowrap flex items-center">
                                                    <Clock size={10} className="mr-1" />
                                                    {formatTimeAgo(alert.created_at)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                                                {alert.message}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
