import React, { useState, useEffect, useRef } from 'react';
import { Terminal, RefreshCw, Download, Trash2 } from 'lucide-react';
import api from '../services/api';

const SystemLogs = () => {
    const [logs, setLogs] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const logsEndRef = useRef<HTMLDivElement>(null);

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

    useEffect(() => {
        fetchLogs();
    }, []);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (autoRefresh) {
            interval = setInterval(() => {
                fetchLogs();
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [autoRefresh]);

    useEffect(() => {
        if (logsEndRef.current && autoRefresh) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, autoRefresh]);

    const triggerSync = async () => {
        try {
            await api.post('/printers/sync');
            fetchLogs();
        } catch (error) {
            console.error("Failed to trigger sync", error);
            alert("Failed to trigger sync");
        }
    };

    return (
        <div className="space-y-6 flex flex-col h-[calc(100vh-100px)]">
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center space-x-2">
                        <Terminal className="h-6 w-6 text-indigo-600" />
                        <span>System Logs</span>
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Live background operations and sync status</p>
                </div>
                <div className="flex space-x-3">
                    <button 
                        onClick={triggerSync}
                        className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg flex items-center space-x-2 hover:bg-emerald-700 transition-colors shadow-sm text-sm"
                        title="Force the backend to sync all printers right now"
                    >
                        <RefreshCw size={14} />
                        <span>Force Sync Printers</span>
                    </button>
                    <label className="flex items-center space-x-2 cursor-pointer border-l border-gray-300 dark:border-gray-600 pl-3">
                        <input 
                            type="checkbox" 
                            checked={autoRefresh} 
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Auto Refresh (3s)</span>
                    </label>
                    <button 
                        onClick={fetchLogs}
                        disabled={loading}
                        className={`px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg flex items-center space-x-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm text-sm ${loading ? 'opacity-50' : ''}`}
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        <span>Refresh Now</span>
                    </button>
                </div>
            </div>

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
        </div>
    );
};

export default SystemLogs;
