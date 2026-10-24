import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { alertService } from '../services/api';
import { useWebSocket } from './WebSocketContext';

export interface AlertItem {
    id: number;
    printer_id: number;
    alert_type: string;
    severity: string;
    message: string;
    is_resolved: boolean;
    created_at: string;
    printer_hostname?: string;
    printer_ip?: string;
    printer_location?: string;
}

interface AlertContextType {
    alerts: AlertItem[];
    activeAlertsCount: number;
    loading: boolean;
    fetchAlerts: () => Promise<void>;
    resolveAlert: (id: number) => Promise<void>;
}

const AlertContext = createContext<AlertContextType>({
    alerts: [],
    activeAlertsCount: 0,
    loading: false,
    fetchAlerts: async () => {},
    resolveAlert: async () => {}
});

export const useAlerts = () => useContext(AlertContext);

export const AlertProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [alerts, setAlerts] = useState<AlertItem[]>([]);
    const [loading, setLoading] = useState(false);
    const { lastEvent } = useWebSocket();
    const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchAlerts = useCallback(async () => {
        try {
            setLoading(true);
            const res = await alertService.getAlerts(false); // only active unresolved alerts
            const data: AlertItem[] = res.data || [];
            setAlerts(data);
        } catch (err) {
            console.error("Failed to fetch active alerts in AlertContext", err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial fetch on mount
    useEffect(() => {
        fetchAlerts();
    }, [fetchAlerts]);

    // Auto-refresh when WebSocket alerts or sync events fire
    useEffect(() => {
        if (!lastEvent) return;
        const alertEvents = ['NEW_ALERT', 'ALERT_TRIGGERED', 'ALERT_RESOLVED', 'SYNC_COMPLETE'];
        if (alertEvents.includes(lastEvent.type)) {
            if (fetchTimerRef.current) {
                clearTimeout(fetchTimerRef.current);
            }
            fetchTimerRef.current = setTimeout(() => {
                fetchAlerts();
            }, 600);
        }
        return () => {
            if (fetchTimerRef.current) {
                clearTimeout(fetchTimerRef.current);
            }
        };
    }, [lastEvent, fetchAlerts]);

    const resolveAlert = useCallback(async (id: number) => {
        // Optimistic update
        setAlerts(prev => prev.filter(a => a.id !== id));
        try {
            await alertService.resolveAlert(id);
        } catch (err: any) {
            console.error("Failed to resolve alert", err);
            // Refresh on error to restore true state
            fetchAlerts();
        }
    }, [fetchAlerts]);

    return (
        <AlertContext.Provider value={{
            alerts,
            activeAlertsCount: alerts.length,
            loading,
            fetchAlerts,
            resolveAlert
        }}>
            {children}
        </AlertContext.Provider>
    );
};
