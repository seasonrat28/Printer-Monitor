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
            icon: <Printer size={20} className="text-white" />,
            gradient: 'from-[#4776E6] to-[#8E54E9]',
            iconBg: 'bg-white/20'
        },
        {
            label: 'Online',
            value: formatNumber(online),
            icon: <CheckCircle2 size={20} className="text-white" />,
            gradient: 'from-[#11998e] to-[#38ef7d]',
            iconBg: 'bg-white/20'
        },
        {
            label: 'Active Alerts',
            value: formatNumber(activeAlerts),
            icon: <AlertTriangle size={20} className="text-white" />,
            gradient: 'from-[#ff9966] to-[#ff5e62]',
            iconBg: 'bg-white/20'
        },
        {
            label: 'Critical Alerts',
            value: formatNumber(criticalAlerts),
            icon: <AlertTriangle size={20} className="text-white" />,
            gradient: 'from-[#cb2d3e] to-[#ef473a]',
            iconBg: 'bg-white/20'
        },
        {
            label: 'Offline',
            value: formatNumber(offline),
            icon: <Printer size={20} className="text-white" />,
            gradient: 'from-[#4b6cb7] to-[#182848]',
            iconBg: 'bg-white/20'
        },
        {
            label: 'Pages Printed',
            value: formatNumber(pagesPrinted),
            icon: <Layers size={20} className="text-white" />,
            gradient: 'from-[#834d9b] to-[#d04ed6]',
            iconBg: 'bg-white/20'
        },
        {
            label: 'Low Toner Printers',
            value: formatNumber(lowToner),
            icon: <AlertTriangle size={20} className="text-white" />,
            gradient: 'from-[#f7971e] to-[#ffd200]',
            iconBg: 'bg-white/20'
        },
        {
            label: 'Avg Response',
            value: avgResponse,
            icon: <Activity size={20} className="text-white" />,
            gradient: 'from-[#00b4db] to-[#0083b0]',
            iconBg: 'bg-white/20'
        }
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {cards.map((card, idx) => (
                <div 
                    key={idx} 
                    className={`rounded-xl shadow-md overflow-hidden bg-gradient-to-r ${card.gradient} transition-transform hover:scale-105 duration-300`}
                >
                    <div className="p-5 flex items-center space-x-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${card.iconBg}`}>
                            {card.icon}
                        </div>
                        <div className="flex-1">
                            <h3 className="text-white/90 text-xs font-bold uppercase tracking-wider mb-1">{card.label}</h3>
                            <div className="text-white text-2xl font-black">{card.value}</div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
