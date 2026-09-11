import React, { useState } from 'react';
import { Printer as PrinterIcon, Star, RefreshCw, History, ChevronDown, ChevronUp, ExternalLink, Trash2, BarChart2 } from 'lucide-react';
import type { Printer } from '../types';
import api from '../services/api';

interface PrinterCardProps {
    printer: Printer;
    onToggleFavorite: (printer: Printer, e: React.MouseEvent) => void;
    onOpenHistory: (printer: Printer) => void;
    onDelete: (id: number) => void;
}

export const PrinterCard: React.FC<PrinterCardProps> = ({ printer, onToggleFavorite, onOpenHistory, onDelete }) => {

    const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
    const [suppliesHistory, setSuppliesHistory] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    const toggleHistory = async () => {
        if (!isHistoryExpanded) {
            setIsHistoryExpanded(true);
            if (suppliesHistory.length === 0) {
                setIsLoadingHistory(true);
                try {
                    const res = await api.get(`/printers/${printer.id}/history?days=7`);
                    const history = res.data.supplies_history.sort((a: any, b: any) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime());

                    const processed = history.map((item: any, index: number) => {
                        const nextItem = history[index + 1];
                        let tonerDiff = 0, drumDiff = 0, fuserDiff = 0, laserDiff = 0, pfMpDiff = 0, pf1Diff = 0;
                        if (nextItem) {
                            tonerDiff = item.toner_level !== null && nextItem.toner_level !== null ? item.toner_level - nextItem.toner_level : 0;
                            drumDiff = item.drum_level !== null && nextItem.drum_level !== null ? item.drum_level - nextItem.drum_level : 0;
                            fuserDiff = item.fuser_level !== null && nextItem.fuser_level !== null ? item.fuser_level - nextItem.fuser_level : 0;
                            laserDiff = item.laser_unit_level !== null && nextItem.laser_unit_level !== null ? item.laser_unit_level - nextItem.laser_unit_level : 0;
                            pfMpDiff = item.pf_kit_mp_level !== null && nextItem.pf_kit_mp_level !== null ? item.pf_kit_mp_level - nextItem.pf_kit_mp_level : 0;
                            pf1Diff = item.pf_kit_1_level !== null && nextItem.pf_kit_1_level !== null ? item.pf_kit_1_level - nextItem.pf_kit_1_level : 0;
                        }
                        return {
                            ...item,
                            tonerDiff, drumDiff, fuserDiff, laserDiff, pfMpDiff, pf1Diff,
                            formattedDate: new Date(item.measured_at.endsWith('Z') ? item.measured_at : item.measured_at + 'Z').toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        };
                    });
                    setSuppliesHistory(processed);
                } catch (err) {
                    console.error("Failed to load inline history", err);
                } finally {
                    setIsLoadingHistory(false);
                }
            }
        } else {
            setIsHistoryExpanded(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ONLINE': return 'bg-[#009900] text-white';
            case 'WARNING': return 'bg-[#FFCC00] text-gray-900';
            case 'ERROR': return 'bg-[#FF3333] text-white';
            case 'OFFLINE': return 'bg-gray-400 text-white';
            default: return 'bg-[#666666] text-white';
        }
    };

    const getStatusText = (printer: Printer) => {
        if (printer.status_message) {
            return printer.status_message;
        }
        switch (printer.status) {
            case 'ONLINE': return 'Ready';
            case 'WARNING': return 'Warning';
            case 'OFFLINE': return 'Offline';
            default: return 'Connection error';
        }
    };

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'ONLINE': return 'bg-[#009900] text-white shadow-sm';
            case 'WARNING': return 'bg-[#FFCC00] text-gray-900 shadow-sm';
            case 'ERROR': return 'bg-[#FF3333] text-white shadow-sm';
            case 'OFFLINE': return 'bg-gray-400 text-white shadow-sm';
            default: return 'bg-[#666666] text-white shadow-sm';
        }
    };

    const getStatusCardBorder = (status: string) => {
        switch (status) {
            case 'ONLINE': return 'border-[#009900]/50';
            case 'WARNING': return 'border-[#FFCC00]/50';
            case 'ERROR': return 'border-[#FF3333]/50';
            case 'OFFLINE': return 'border-gray-300 dark:border-gray-600';
            default: return 'border-gray-300 dark:border-gray-600';
        }
    };

    const renderProgressBar = (label: string, level?: number, status?: string) => {
        const getIcon = (l: string) => {
            if (l === 'TONER') return '✒️';
            if (l === 'DRUM') return '🗞️';
            if (l === 'FUSER') return '🔥';
            if (l === 'LASER') return '⚡';
            if (l.includes('PF')) return '⚙️';
            return '🔧';
        };

        if (status === 'OFFLINE' || level === undefined || level === null) return (
            <div className="flex-1 flex flex-col items-center opacity-40 grayscale">
                <span className="text-[10px] uppercase font-bold text-gray-400 flex items-center space-x-1 tracking-wider">
                    <span className="opacity-70">{getIcon(label)}</span>
                    <span>{label}</span>
                </span>
                <span className="text-xl font-bold text-gray-400 my-1">OFFLINE</span>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                    <div className="h-1.5 rounded-full w-0"></div>
                </div>
            </div>
        );

        let colorClass = "bg-emerald-500";
        let textColor = "text-emerald-500";
        if (level < 20) {
            colorClass = "bg-red-500";
            textColor = "text-red-500";
        } else if (level <= 50) {
            colorClass = "bg-amber-400";
            textColor = "text-amber-500";
        }

        return (
            <div className="flex-1 flex flex-col items-center">
                <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 flex items-center space-x-1 tracking-wider text-center">
                    <span className="opacity-70">{getIcon(label)}</span>
                    <span>{label}</span>
                </span>
                <span className={`text-2xl font-bold my-1 ${textColor}`}>{level}%</span>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1 overflow-hidden">
                    <div
                        style={{ width: `${level}%` }}
                        className={`${colorClass} h-1.5 rounded-full transition-all duration-1000 ease-out`}
                    />
                </div>
            </div>
        );
    };

    return (
        <div
            className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg dark:shadow-gray-900/50 transition-all duration-300 transform hover:-translate-y-1 hover:scale-[1.02] group flex flex-col relative overflow-hidden border-2 animate-in fade-in zoom-in duration-500 ${getStatusCardBorder(printer.status)}`}
        >

            {/* Card Content */}
            <div className="p-5 flex-1 flex flex-col">

                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center space-x-2 w-full">
                        <PrinterIcon className="text-gray-400 dark:text-gray-500" size={20} />
                        <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg truncate flex-1" title={printer.hostname || printer.model || printer.ip_address}>
                            {printer.hostname || printer.model || printer.ip_address}
                        </h3>
                        <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(printer.status)}`}>
                            {printer.status}
                        </div>
                        <button
                            onClick={(e) => onToggleFavorite(printer, e)}
                            className={`transition-all transform hover:scale-110 active:scale-95 ml-1 ${printer.is_favorite ? 'text-amber-400' : 'text-gray-300 hover:text-amber-400'}`}
                            title={printer.is_favorite ? "Remove from favorites" : "Add to favorites"}
                        >
                            <Star size={18} fill={printer.is_favorite ? "currentColor" : "none"} />
                        </button>
                    </div>
                </div>

                {/* Detailed Info */}
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-2 mb-4 w-full">
                    <div className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-1">
                        <span className="font-medium">IP:</span>
                        <span className="text-gray-800 dark:text-gray-200">{printer.ip_address}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-1">
                        <span className="font-medium">Location:</span>
                        <span className="text-gray-800 dark:text-gray-200 truncate max-w-[150px] text-right" title={printer.location || '-'}>{printer.location || '-'}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-1">
                        <span className="font-medium">Serial No.:</span>
                        <span className="text-gray-800 dark:text-gray-200">{printer.serial_number || '-'}</span>
                    </div>
                    <div
                        className="flex justify-between border-b border-gray-100 dark:border-gray-700 pb-1 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors rounded px-1 -mx-1"
                        onClick={() => onOpenHistory(printer)}
                        title="คลิกเพื่อดูกราฟประวัติการใช้งาน"
                    >
                        <span className="font-medium flex items-center text-indigo-600 dark:text-indigo-400"><History size={10} className="mr-1" /> ประวัติการพิมพ์:</span>
                        <span className="text-gray-800 dark:text-gray-200">{printer.page_count !== undefined && printer.page_count !== null ? printer.page_count.toLocaleString() + ' แผ่น' : '-'}</span>
                    </div>
                </div>

                {/* Status Box */}
                <div className={`px-3 py-1.5 rounded-md border text-xs font-bold w-full text-center mb-3 ${getStatusBadgeClass(printer.status)}`}>
                    Status: {getStatusText(printer)}
                </div>

                {/* Critical Supply Alert */}
                {(printer.toner_level === 0 || printer.drum_level === 0) && (
                    <div className="flex items-center justify-center gap-1.5 bg-red-100 dark:bg-red-900/40 border border-red-400 dark:border-red-600 rounded-md px-3 py-1.5 mb-3 animate-pulse">
                        <span className="text-base">⚠️</span>
                        <span className="text-xs font-bold text-red-700 dark:text-red-300">
                            มีปัญหา: {printer.toner_level === 0 && printer.drum_level === 0 ? 'หมึก & ดรัมหมด' : printer.toner_level === 0 ? 'หมึกหมด' : 'ดรัมหมด'}
                        </span>
                    </div>
                )}

                {/* Progress Bars */}
                <div className="flex items-center justify-between space-x-6 px-2 mb-4">
                    {renderProgressBar("TONER", printer.toner_level, printer.status)}
                    {/* Vertical Divider */}
                    <div className="h-10 w-px bg-gray-200 dark:bg-gray-600"></div>
                    {renderProgressBar("DRUM", printer.drum_level, printer.status)}
                </div>

                {/* Additional Parts (Apeos specific) */}
                {(printer.fuser_level !== undefined && printer.fuser_level !== null) && (
                    <div className="grid grid-cols-2 gap-y-4 gap-x-6 px-2 mb-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                        {renderProgressBar("FUSER", printer.fuser_level, printer.status)}
                        {renderProgressBar("LASER", printer.laser_unit_level, printer.status)}
                        {renderProgressBar("PF KIT MP", printer.pf_kit_mp_level, printer.status)}
                        {renderProgressBar("PF KIT 1", printer.pf_kit_1_level, printer.status)}
                    </div>
                )}

            </div>

            {/* Footer */}
            <div className="bg-gray-50/80 dark:bg-gray-700/50 px-4 py-3 flex flex-col w-full relative z-10 border-t border-gray-100 dark:border-gray-700">
                <div className="flex flex-col items-center justify-center">
                    <div className="flex items-center text-[10px] text-gray-400 dark:text-gray-500 mb-3 space-x-1">
                        <RefreshCw size={10} className={printer.status === 'ONLINE' ? 'text-emerald-500' : ''} />
                        <span>อัปเดตล่าสุด: {printer.last_seen ? new Date(printer.last_seen.endsWith('Z') ? printer.last_seen : printer.last_seen + 'Z').toLocaleString('en-GB') : 'Never'}</span>
                    </div>

                    <div className="w-full">
                        <button
                            onClick={toggleHistory}
                            className="w-full flex items-center justify-center space-x-2 py-1.5 px-3 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400 rounded-full transition-colors text-xs font-bold shadow-sm"
                        >
                            <BarChart2 size={14} />
                            <span>{isHistoryExpanded ? 'ซ่อนประวัติ' : 'ดูประวัติ'}</span>
                            {isHistoryExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    </div>
                </div>

                {/* Inline History Expandable Area */}
                {isHistoryExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 w-full animate-in fade-in slide-in-from-top-2 duration-200">
                        {isLoadingHistory ? (
                            <div className="flex justify-center py-4">
                                <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
                            </div>
                        ) : suppliesHistory.length > 0 ? (
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                {suppliesHistory.map((item, idx) => (
                                    <div key={idx} className={`flex items-center justify-between p-2 rounded-lg text-xs border ${idx === 0 ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'}`}>
                                        <div className="flex items-center space-x-1 text-gray-500 dark:text-gray-400 font-medium">
                                            <History size={10} className={idx === 0 ? 'text-blue-500' : ''} />
                                            <span className={idx === 0 ? 'text-blue-600 dark:text-blue-400' : ''}>{item.formattedDate}</span>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <div className="flex items-center space-x-1">
                                                <span className="text-gray-400" title="Toner">🖍️</span>
                                                <span className="font-bold text-gray-700 dark:text-gray-200">{item.toner_level}%</span>
                                                {item.tonerDiff !== 0 && (
                                                    <span className={`px-1 rounded text-[10px] font-bold ${item.tonerDiff > 0 ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'}`}>
                                                        {item.tonerDiff > 0 ? '+' : ''}{item.tonerDiff}%
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <span className="text-gray-400" title="Drum">🗞️</span>
                                                <span className="font-bold text-gray-700 dark:text-gray-200">{item.drum_level}%</span>
                                                {item.drumDiff !== 0 && (
                                                    <span className={`px-1 rounded text-[10px] font-bold ${item.drumDiff > 0 ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'}`}>
                                                        {item.drumDiff > 0 ? '+' : ''}{item.drumDiff}%
                                                    </span>
                                                )}
                                            </div>
                                            {item.fuser_level !== null && item.fuser_level !== undefined && (
                                                <div className="flex items-center space-x-1">
                                                    <span className="text-gray-400" title="Fuser">🔥</span>
                                                    <span className="font-bold text-gray-700 dark:text-gray-200">{item.fuser_level}%</span>
                                                    {item.fuserDiff !== 0 && (
                                                        <span className={`px-1 rounded text-[10px] font-bold ${item.fuserDiff > 0 ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'}`}>
                                                            {item.fuserDiff > 0 ? '+' : ''}{item.fuserDiff}%
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            {item.laser_unit_level !== null && item.laser_unit_level !== undefined && (
                                                <div className="flex items-center space-x-1">
                                                    <span className="text-gray-400" title="Laser Unit">⚡</span>
                                                    <span className="font-bold text-gray-700 dark:text-gray-200">{item.laser_unit_level}%</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-4 text-xs text-gray-400 dark:text-gray-500">
                                ไม่มีประวัติการเปลี่ยนหมึก
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Hover Actions */}
            <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-gray-800/90 rounded-md shadow-sm p-1">
                <a href={`http://${printer.ip_address}`} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded transition-colors" title="Open Web Management">
                    <ExternalLink size={14} />
                </a>
                <button onClick={() => onDelete(printer.id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/40 rounded transition-colors" title="Delete Printer">
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
};

export default React.memo(PrinterCard);
