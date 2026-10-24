import React from 'react';
import { Printer, AlertTriangle, CheckCircle2, Layers, Activity } from 'lucide-react';

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
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            {cards.map((card, idx) => {
                // Enterprise gradient & border tokens
                let gradientClass = 'from-slate-700 via-slate-800 to-slate-900 border-slate-600/30';
                let glowColor = 'rgba(148, 163, 184, 0.15)';
                
                if (card.label === 'Pages Printed') {
                    gradientClass = 'from-indigo-600 via-indigo-700 to-violet-800 border-indigo-400/30';
                    glowColor = 'rgba(99, 102, 241, 0.25)';
                } else if (card.label === 'Online') {
                    gradientClass = 'from-emerald-600 via-emerald-700 to-teal-800 border-emerald-400/30';
                    glowColor = 'rgba(16, 185, 129, 0.25)';
                } else if (card.label === 'Active Alerts' || card.label === 'Low Toner Printers') {
                    gradientClass = 'from-amber-500 via-amber-600 to-orange-700 border-amber-300/30';
                    glowColor = 'rgba(245, 158, 11, 0.25)';
                } else if (card.label === 'Critical Alerts') {
                    gradientClass = 'from-rose-600 via-rose-700 to-red-800 border-rose-400/30';
                    glowColor = 'rgba(244, 63, 94, 0.3)';
                } else if (card.label === 'Total Printers') {
                    gradientClass = 'from-blue-600 via-blue-700 to-cyan-800 border-blue-400/30';
                    glowColor = 'rgba(59, 130, 246, 0.25)';
                } else if (card.label === 'Offline') {
                    gradientClass = 'from-slate-600 via-slate-700 to-slate-800 border-slate-500/30';
                    glowColor = 'rgba(100, 116, 139, 0.2)';
                } else if (card.label === 'Avg Response') {
                    gradientClass = 'from-cyan-600 via-cyan-700 to-teal-800 border-cyan-400/30';
                    glowColor = 'rgba(6, 182, 212, 0.25)';
                }

                return (
                    <div 
                        key={idx} 
                        style={{ boxShadow: `0 8px 20px -6px ${glowColor}` }}
                        className={`group relative rounded-2xl border ${gradientClass} overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl bg-gradient-to-br text-white cursor-default select-none`}
                    >
                        {/* Subtle decorative background watermark */}
                        <div className="absolute -top-1 -right-1 p-2 opacity-15 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6 pointer-events-none">
                            {React.cloneElement(card.icon as React.ReactElement<any>, { size: 68 })}
                        </div>
                        
                        <div className="flex items-center space-x-3 sm:space-x-4 p-3.5 sm:p-5 relative z-10">
                            <div className="flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl backdrop-blur-md shadow-sm transition-transform duration-300 group-hover:scale-110 bg-white/20 text-white border border-white/25">
                                {card.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="mb-0.5 sm:mb-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white/80 truncate">{card.label}</h3>
                                <div className="text-xl sm:text-2xl font-black tracking-tight text-white truncate">{card.value}</div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
