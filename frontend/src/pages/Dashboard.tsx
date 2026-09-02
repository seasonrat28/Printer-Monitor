import React, { useEffect, useState } from 'react';
import { printerService } from '../services/api';
import { useWebSocket } from '../contexts/WebSocketContext';
import { Printer, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

const Dashboard = () => {
    const [stats, setStats] = useState({ total: 0, online: 0, offline: 0, warning: 0 });
    const { lastEvent, isConnected } = useWebSocket();

    const fetchStats = async () => {
        try {
            const res = await printerService.getPrinters();
            const printers = res.data;
            
            const online = printers.filter((p: any) => p.status === 'ONLINE').length;
            const offline = printers.filter((p: any) => p.status === 'OFFLINE').length;
            const warning = printers.filter((p: any) => p.status === 'WARNING').length;
            
            setStats({
                total: printers.length,
                online,
                offline,
                warning
            });
        } catch (error) {
            console.error("Failed to load stats", error);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    useEffect(() => {
        // Just refetch on any WS update for simplicity in dashboard, 
        // normally we would update the counters specifically
        if (lastEvent) {
            fetchStats();
        }
    }, [lastEvent]);

    const pieData = [
        { name: 'Online', value: stats.online, color: '#10B981' }, // Emerald-500
        { name: 'Offline', value: stats.offline, color: '#EF4444' }, // Red-500
        { name: 'Warning', value: stats.warning, color: '#F59E0B' }, // Amber-500
    ];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">System Overview</h2>
                <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-500">Live Status:</span>
                    <span className="flex items-center space-x-1">
                        <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                        <span className={`text-sm font-medium ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                            {isConnected ? 'Connected' : 'Disconnected'}
                        </span>
                    </span>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Printers</p>
                            <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.total}</h3>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600">
                            <Printer size={24} />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Online</p>
                            <h3 className="text-3xl font-bold text-green-600 mt-2">{stats.online}</h3>
                        </div>
                        <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-xl text-green-600">
                            <CheckCircle2 size={24} />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Warnings</p>
                            <h3 className="text-3xl font-bold text-amber-500 mt-2">{stats.warning}</h3>
                        </div>
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-xl text-amber-600">
                            <AlertTriangle size={24} />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Offline</p>
                            <h3 className="text-3xl font-bold text-red-500 mt-2">{stats.offline}</h3>
                        </div>
                        <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-xl text-red-600">
                            <XCircle size={24} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 lg:col-span-1">
                    <h3 className="text-lg font-bold mb-4">Status Distribution</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <RechartsTooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center space-x-6 mt-2">
                        {pieData.map(item => (
                            <div key={item.name} className="flex items-center space-x-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                                <span className="text-sm text-gray-600 dark:text-gray-400">{item.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 lg:col-span-2">
                    <h3 className="text-lg font-bold mb-4">Recent Alerts</h3>
                    <div className="flex items-center justify-center h-64 text-gray-400">
                        No recent alerts.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
