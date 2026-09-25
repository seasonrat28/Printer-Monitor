import React, { useEffect, useState, useCallback } from 'react';
import { alertService } from '../services/api';
import { Bell, CheckCircle2, Clock, AlertTriangle, AlertOctagon, Info, Filter, Search, Printer, MapPin, Globe } from 'lucide-react';
import { format } from 'date-fns';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useToast } from '../contexts/ToastContext';

export const AlertsPage = () => {
    const [alerts, setAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'RESOLVED'>('ACTIVE');
    const [filterSeverity, setFilterSeverity] = useState<'ALL' | 'CRITICAL' | 'WARNING'>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const { lastEvent } = useWebSocket();
    const { addToast } = useToast();

    const fetchAlerts = useCallback(async () => {
        setLoading(true);
        try {
            let isResolved = undefined;
            if (filterStatus === 'ACTIVE') isResolved = false;
            if (filterStatus === 'RESOLVED') isResolved = true;
            
            const res = await alertService.getAlerts(isResolved);
            setAlerts(res.data || []);
        } catch (error) {
            console.error("Failed to fetch alerts", error);
            addToast("error", "Failed to fetch alerts");
        } finally {
            setLoading(false);
        }
    }, [filterStatus, addToast]);

    useEffect(() => {
        fetchAlerts();
    }, [fetchAlerts]);

    // Listen for WebSocket updates to auto-refresh alerts
    useEffect(() => {
        if (lastEvent && (lastEvent.type === 'ALERT_RESOLVED' || lastEvent.type === 'SUPPLIES_UPDATE' || lastEvent.type === 'STATUS_UPDATE')) {
            // Refetch alerts on relevant events (could be optimized to patch state, but refetching ensures consistency for now)
            fetchAlerts();
        }
    }, [lastEvent, fetchAlerts]);

    const handleResolve = async (id: number) => {
        try {
            await alertService.resolveAlert(id);
            addToast("success", "Alert resolved successfully");
            fetchAlerts();
        } catch (error) {
            console.error("Failed to resolve alert", error);
            addToast("error", "Failed to resolve alert");
        }
    };

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'CRITICAL': return <AlertOctagon size={18} className="text-rose-500" />;
            case 'WARNING': return <AlertTriangle size={18} className="text-amber-500" />;
            default: return <Info size={18} className="text-blue-500" />;
        }
    };

    const getSeverityBadge = (severity: string) => {
        switch (severity) {
            case 'CRITICAL': 
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 uppercase">Critical</span>;
            case 'WARNING': 
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 uppercase">Warning</span>;
            default: 
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 uppercase">{severity}</span>;
        }
    };

    const filteredAlerts = alerts.filter(alert => {
        if (filterSeverity !== 'ALL' && alert.severity !== filterSeverity) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return (
                (alert.message && alert.message.toLowerCase().includes(q)) ||
                (alert.printer_hostname && alert.printer_hostname.toLowerCase().includes(q)) ||
                (alert.printer_ip && alert.printer_ip.toLowerCase().includes(q))
            );
        }
        return true;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                        <Bell className="text-indigo-500" /> Alerts Management
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
                        Monitor and resolve system and printer alerts across your infrastructure
                    </p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200/60 dark:border-slate-700/60 overflow-hidden flex flex-col">
                {/* Filters */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/80 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex flex-wrap gap-3">
                        <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                            {(['ACTIVE', 'RESOLVED', 'ALL'] as const).map(status => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                                        filterStatus === status 
                                        ? 'bg-indigo-500 text-white shadow-sm' 
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    {status === 'ACTIVE' ? 'Active' : status === 'RESOLVED' ? 'Resolved' : 'All'}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                            <Filter size={14} className="text-slate-400 ml-2" />
                            <select 
                                value={filterSeverity}
                                onChange={(e) => setFilterSeverity(e.target.value as any)}
                                className="bg-transparent text-xs font-bold text-slate-600 dark:text-slate-300 border-none outline-none focus:ring-0 cursor-pointer pr-4"
                            >
                                <option value="ALL">All Severities</option>
                                <option value="CRITICAL">Critical</option>
                                <option value="WARNING">Warning</option>
                            </select>
                        </div>
                    </div>

                    <div className="relative w-full sm:w-auto min-w-[250px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search alerts or printers..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:text-white transition-all"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50/50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 dark:text-slate-400 font-bold tracking-wider">
                            <tr>
                                <th className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50">Alert Details</th>
                                <th className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50">Printer</th>
                                <th className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 w-48">Time</th>
                                <th className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 text-right w-32">Status / Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {loading && alerts.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-4"></div>
                                            Loading alerts...
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredAlerts.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center justify-center text-slate-400">
                                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-3">
                                                <CheckCircle2 size={32} className="text-emerald-500 opacity-80" />
                                            </div>
                                            <p className="text-base font-bold text-slate-600 dark:text-slate-300">No alerts found</p>
                                            <p className="text-sm mt-1">Everything looks good based on your current filters.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredAlerts.map(alert => (
                                    <tr key={alert.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5">
                                                    {getSeverityIcon(alert.severity)}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {getSeverityBadge(alert.severity)}
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{alert.alert_type}</span>
                                                    </div>
                                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-snug">
                                                        {alert.message}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Printer size={14} className="text-slate-400" />
                                                <span className="font-bold text-slate-700 dark:text-slate-200">{alert.printer_hostname || alert.printer_ip}</span>
                                            </div>
                                            {alert.printer_hostname && alert.printer_hostname !== alert.printer_ip && (
                                                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                                                    <Globe size={12} />
                                                    <span>{alert.printer_ip}</span>
                                                </div>
                                            )}
                                            {alert.printer_location && (
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <MapPin size={12} />
                                                    <span className="truncate max-w-[150px]">{alert.printer_location}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 mb-1">
                                                <Clock size={12} className="text-slate-400" />
                                                Created: {format(new Date(alert.created_at.endsWith('Z') ? alert.created_at : alert.created_at + 'Z'), 'MMM d, yyyy HH:mm')}
                                            </div>
                                            {alert.resolved_at && (
                                                <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                                    <CheckCircle2 size={10} />
                                                    Resolved: {format(new Date(alert.resolved_at.endsWith('Z') ? alert.resolved_at : alert.resolved_at + 'Z'), 'MMM d, yyyy HH:mm')}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {alert.is_resolved ? (
                                                <span className="inline-flex items-center gap-1.5 text-emerald-500 font-bold text-xs bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-lg">
                                                    <CheckCircle2 size={14} /> Resolved
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => handleResolve(alert.id)}
                                                    className="inline-flex items-center gap-1.5 text-white font-bold text-xs bg-indigo-500 hover:bg-indigo-600 active:scale-95 transition-all px-4 py-2 rounded-lg shadow-sm hover:shadow"
                                                >
                                                    <CheckCircle2 size={14} /> Resolve
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AlertsPage;
