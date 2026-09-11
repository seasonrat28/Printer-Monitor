import React, { useEffect, useState } from 'react';
import { Bell, X, AlertTriangle, Info, CheckCircle2, XCircle, Printer } from 'lucide-react';
import { alertService } from '../services/api';
import { useWebSocket } from '../contexts/WebSocketContext';

interface Alert {
    id: int;
    printer_id: int;
    alert_type: string;
    severity: string;
    message: string;
    is_resolved: boolean;
    created_at: string;
    printer_hostname?: string;
    printer_ip?: string;
    printer_location?: string;
}

interface NotificationsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ isOpen, onClose }) => {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(false);
    const { lastEvent } = useWebSocket();

    const fetchAlerts = async () => {
        try {
            setLoading(true);
            const res = await alertService.getAlerts(false); // only unresolved
            setAlerts(res.data);
        } catch (err) {
            console.error("Failed to fetch alerts", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchAlerts();
        }
    }, [isOpen]);

    useEffect(() => {
        if (lastEvent?.type === 'NEW_ALERT') {
            fetchAlerts();
        } else if (lastEvent?.type === 'ALERT_RESOLVED') {
            setAlerts(prev => prev.filter(a => a.id !== lastEvent.data.id));
        }
    }, [lastEvent]);

    const handleResolve = async (id: number) => {
        try {
            await alertService.resolveAlert(id);
            setAlerts(prev => prev.filter(a => a.id !== id));
        } catch (err) {
            console.error("Failed to resolve alert", err);
        }
    };

    const getIcon = (severity: string) => {
        if (severity === 'CRITICAL') return <XCircle size={20} className="text-red-500" />;
        if (severity === 'WARNING') return <AlertTriangle size={20} className="text-amber-500" />;
        return <Info size={20} className="text-blue-500" />;
    };

    const getBgColor = (severity: string) => {
        if (severity === 'CRITICAL') return 'bg-red-50 dark:bg-red-900/25 border-red-100 dark:border-red-800';
        if (severity === 'WARNING') return 'bg-amber-50 dark:bg-amber-900/25 border-amber-100 dark:border-amber-800';
        return 'bg-blue-50 dark:bg-blue-900/25 border-blue-100 dark:border-blue-800';
    };

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-transparent z-40"
                    onClick={onClose}
                ></div>
            )}
            
            {/* Slide-over panel */}
            <div className={`fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white dark:bg-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-indigo-600 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white flex items-center">
                        <Bell className="mr-2" size={20} />
                        การแจ้งเตือน
                    </h2>
                    <button 
                        onClick={onClose}
                        className="text-indigo-200 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900/50">
                    {loading ? (
                        <div className="flex justify-center items-center h-32">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : alerts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                            <CheckCircle2 size={48} className="text-emerald-400 mb-4 opacity-50" />
                            <p className="font-medium text-gray-600 dark:text-gray-400">ไม่มีการแจ้งเตือนใหม่</p>
                            <p className="text-sm mt-1 text-gray-400">ระบบทำงานปกติทุกเครื่อง</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {alerts.map(alert => (
                                <div 
                                    key={alert.id} 
                                    className={`p-4 rounded-xl border shadow-sm flex flex-col ${getBgColor(alert.severity)} transition-all hover:shadow-md cursor-pointer`}
                                    onClick={() => {
                                        if (alert.printer_ip) {
                                            window.open(`http://${alert.printer_ip}`, '_blank');
                                        }
                                    }}
                                >
                                    <div className="flex items-start">
                                        <div className="flex-shrink-0 mt-0.5 bg-white dark:bg-gray-700 rounded-full p-1.5 shadow-sm">
                                            {getIcon(alert.severity)}
                                        </div>
                                        <div className="ml-3 flex-1">
                                            <h3 className={`text-sm font-bold ${alert.severity === 'CRITICAL' ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'}`}>
                                                {alert.message}
                                            </h3>
                                            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                                                <div className="flex items-center">
                                                    <Printer size={12} className="mr-1 opacity-60" />
                                                    <span className="font-medium">
                                                        {alert.printer_hostname && alert.printer_hostname !== alert.printer_ip
                                                            ? `${alert.printer_hostname} (${alert.printer_ip})`
                                                            : alert.printer_ip}
                                                    </span>
                                                </div>
                                                {alert.printer_location && (
                                                    <div className="flex items-center text-gray-500">
                                                        <span>📍 {alert.printer_location}</span>
                                                    </div>
                                                )}
                                                <div className="text-gray-400 mt-2 text-[10px]">
                                                    {new Date(alert.created_at.endsWith('Z') ? alert.created_at : alert.created_at + 'Z').toLocaleString('en-GB')}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex justify-end">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleResolve(alert.id);
                                            }}
                                            className="text-xs px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-sm rounded hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium transition-colors"
                                        >
                                            รับทราบ (Resolve)
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};
