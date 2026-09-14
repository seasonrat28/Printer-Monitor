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
            iconBg: 'bg-slate-100 dark:bg-slate-700'
        },
        {
            label: 'Online',
            value: formatNumber(online),
            icon: <CheckCircle2 size={18} />,
            accent: 'text-emerald-700 dark:text-emerald-400',
            iconBg: 'bg-emerald-50 dark:bg-emerald-950'
        },
        {
            label: 'Active Alerts',
            value: formatNumber(activeAlerts),
            icon: <AlertTriangle size={18} />,
            accent: 'text-amber-700 dark:text-amber-400',
            iconBg: 'bg-amber-50 dark:bg-amber-950'
        },
        {
            label: 'Critical Alerts',
            value: formatNumber(criticalAlerts),
            icon: <AlertTriangle size={18} />,
            accent: 'text-red-700 dark:text-red-400',
            iconBg: 'bg-red-50 dark:bg-red-950'
        },
        {
            label: 'Offline',
            value: formatNumber(offline),
            icon: <Printer size={18} />,
            accent: 'text-slate-700 dark:text-slate-200',
            iconBg: 'bg-slate-100 dark:bg-slate-700'
        },
        {
            label: 'Pages Printed',
            value: formatNumber(pagesPrinted),
            icon: <Layers size={18} />,
            accent: 'text-indigo-700 dark:text-indigo-400',
            iconBg: 'bg-indigo-50 dark:bg-indigo-950'
        },
        {
            label: 'Low Toner Printers',
            value: formatNumber(lowToner),
            icon: <AlertTriangle size={18} />,
            accent: 'text-amber-700 dark:text-amber-400',
            iconBg: 'bg-amber-50 dark:bg-amber-950'
        },
        {
            label: 'Avg Response',
            value: avgResponse,
            icon: <Activity size={18} />,
            accent: 'text-cyan-700 dark:text-cyan-400',
            iconBg: 'bg-cyan-50 dark:bg-cyan-950'
        }
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {cards.map((card, idx) => (
                <div 
                    key={idx} 
                    className="rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-[#1e1e1e]"
                >
                    <div className="flex items-center space-x-4 p-5">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${card.iconBg} ${card.accent}`}>
                            {card.icon}
                        </div>
                        <div className="flex-1">
                            <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{card.label}</h3>
                            <div className={`text-xl font-semibold ${card.accent}`}>{card.value}</div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
