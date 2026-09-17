import React from 'react';
import { Printer, AlertTriangle, CheckCircle2, XCircle, Layers, Activity } from 'lucide-react';

interface MetricGridProps {
    total: number;
    online: number;
    activeAlerts: number;
    criticalAlerts: number;
    offline: number;
    pagesPrinted: number;
    lowToner: number;
    avgResponse: string;
}

export const MetricGrid: React.FC<MetricGridProps> = ({
    total,
    online,
    activeAlerts,
    criticalAlerts,
    offline,
    pagesPrinted,
    lowToner,
    avgResponse
}) => {
    const formatNumber = (num: number) => {
        return new Intl.NumberFormat().format(num);
    };

    const cards = [
        {
            label: 'Total Printers',
            value: formatNumber(total),
            icon: <Printer size={18} />,
            accent: 'text-slate-700 dark:text-slate-200',
            iconBg: 'bg-slate-100 dark:bg-slate-700',
            glowColor: '#94a3b8'
        },
        {
            label: 'Online',
            value: formatNumber(online),
            icon: <CheckCircle2 size={18} />,
            accent: 'text-emerald-700 dark:text-emerald-400',
            iconBg: 'bg-emerald-50 dark:bg-emerald-950',
            glowColor: '#34d399'
        },
        {
            label: 'Active Alerts',
            value: formatNumber(activeAlerts),
            icon: <AlertTriangle size={18} />,
            accent: 'text-amber-700 dark:text-amber-400',
            iconBg: 'bg-amber-50 dark:bg-amber-950',
            glowColor: '#fbbf24'
        },
        {
            label: 'Critical Alerts',
            value: formatNumber(criticalAlerts),
            icon: <AlertTriangle size={18} />,
            accent: 'text-red-700 dark:text-red-400',
            iconBg: 'bg-red-50 dark:bg-red-950',
            glowColor: '#f87171'
        },
        {
            label: 'Offline',
            value: formatNumber(offline),
            icon: <Printer size={18} />,
            accent: 'text-slate-700 dark:text-slate-200',
            iconBg: 'bg-slate-100 dark:bg-slate-700',
            glowColor: '#94a3b8'
        },
        {
            label: 'Pages Printed',
            value: formatNumber(pagesPrinted),
            icon: <Layers size={18} />,
            accent: 'text-indigo-700 dark:text-indigo-400',
            iconBg: 'bg-indigo-50 dark:bg-indigo-950',
            glowColor: '#818cf8'
        },
        {
            label: 'Low Toner Printers',
            value: formatNumber(lowToner),
            icon: <AlertTriangle size={18} />,
            accent: 'text-amber-700 dark:text-amber-400',
            iconBg: 'bg-amber-50 dark:bg-amber-950',
            glowColor: '#fbbf24'
        },
        {
            label: 'Avg Response',
            value: avgResponse,
            icon: <Activity size={18} />,
            accent: 'text-cyan-700 dark:text-cyan-400',
            iconBg: 'bg-cyan-50 dark:bg-cyan-950',
            glowColor: '#22d3ee'
        }
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {cards.map((card, idx) => (
                <div 
                    key={idx} 
                    className="group relative rounded-xl border border-slate-200/80 bg-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:border-gray-700/50 dark:bg-gray-800/40 overflow-hidden"
                >
                    <div 
                        className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 blur-2xl transition-all duration-500 group-hover:scale-150 group-hover:opacity-40" 
                        style={{ backgroundColor: card.glowColor }} 
                    />
                    <div className="flex items-center space-x-4 p-5 relative z-10">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 ${card.iconBg} ${card.accent}`}>
                            {card.icon}
                        </div>
                        <div className="flex-1">
                            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{card.label}</h3>
                            <div className={`text-2xl font-black tracking-tight transition-colors duration-300 ${card.accent}`}>{card.value}</div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
