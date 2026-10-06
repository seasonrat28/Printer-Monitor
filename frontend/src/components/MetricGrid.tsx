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
            {cards.map((card, idx) => {
                // Determine gradient based on card label
                let gradientClass = 'from-slate-500 to-slate-700'; // Default
                if (card.label === 'Pages Printed') gradientClass = 'from-violet-500 to-indigo-600';
                else if (card.label === 'Online') gradientClass = 'from-emerald-400 to-emerald-600';
                else if (card.label === 'Active Alerts' || card.label === 'Low Toner Printers') gradientClass = 'from-amber-400 to-orange-500';
                else if (card.label === 'Critical Alerts') gradientClass = 'from-red-400 to-red-600';
                else if (card.label === 'Total Printers') gradientClass = 'from-blue-500 to-blue-700';
                else if (card.label === 'Offline') gradientClass = 'from-slate-400 to-slate-600';
                else if (card.label === 'Avg Response') gradientClass = 'from-cyan-400 to-cyan-600';

                return (
                    <div 
                        key={idx} 
                        className={`group relative rounded-xl border-none overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg bg-gradient-to-br ${gradientClass} text-white shadow-md`}
                    >
                        {/* Background Icon */}
                        <div className="absolute top-0 right-0 p-3 opacity-20 pointer-events-none">
                            {React.cloneElement(card.icon as React.ReactElement<any>, { size: 48 })}
                        </div>
                        
                        <div className="flex items-center space-x-4 p-5 relative z-10">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 bg-white/20 text-white">
                                {card.icon}
                            </div>
                            <div className="flex-1">
                                <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-white/80">{card.label}</h3>
                                <div className="text-2xl font-black tracking-tight transition-colors duration-300 text-white">{card.value}</div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
