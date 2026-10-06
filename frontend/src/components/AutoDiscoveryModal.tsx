import React, { useState } from 'react';
import { Search, Server, Wifi, Loader2, CheckSquare, Square, Plus } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface DiscoveredPrinter {
    ip_address: string;
    hostname: string;
    manufacturer: string;
    model: string;
}

interface AutoDiscoveryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const AutoDiscoveryModal: React.FC<AutoDiscoveryModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [cidr, setCidr] = useState('10.119.34.0/24');
    const [snmpCommunity, setSnmpCommunity] = useState('public');
    const [isScanning, setIsScanning] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [results, setResults] = useState<DiscoveredPrinter[]>([]);
    const [selectedIps, setSelectedIps] = useState<Set<string>>(new Set());
    const [hasScanned, setHasScanned] = useState(false);

    if (!isOpen) return null;

    const handleScan = async () => {
        if (!cidr.trim()) {
            toast.error("Please enter a valid CIDR (e.g. 192.168.1.0/24)");
            return;
        }

        setIsScanning(true);
        setResults([]);
        setHasScanned(false);
        setSelectedIps(new Set());

        try {
            const res = await api.post('/discovery/scan', {
                cidr: cidr.trim(),
                snmp_community: snmpCommunity.trim(),
                snmp_version: 'v2c'
            });
            const found: DiscoveredPrinter[] = res.data;
            setResults(found);
            // Select all by default
            setSelectedIps(new Set(found.map(p => p.ip_address)));
            toast.success(`Found ${found.length} printers!`);
        } catch (err: any) {
            toast.error(err.response?.data?.detail || "Scan failed. Please check network format.");
        } finally {
            setIsScanning(false);
            setHasScanned(true);
        }
    };

    const toggleSelect = (ip: string) => {
        setSelectedIps(prev => {
            const next = new Set(prev);
            if (next.has(ip)) next.delete(ip);
            else next.add(ip);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIps.size === results.length) {
            setSelectedIps(new Set());
        } else {
            setSelectedIps(new Set(results.map(p => p.ip_address)));
        }
    };

    const handleAddSelected = async () => {
        if (selectedIps.size === 0) return;
        
        setIsAdding(true);
        const ipsToAdd = Array.from(selectedIps).join('\n');
        
        try {
            const response = await api.post('/printers/bulk', { raw_ips: ipsToAdd });
            toast.success(response.data.message);
            onSuccess(); // Refresh lists
            onClose();
        } catch (err: any) {
            toast.error(err.response?.data?.detail || 'Failed to add printers');
        } finally {
            setIsAdding(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0 animate-in fade-in duration-200">
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
            <div className="relative w-full max-w-3xl transform overflow-hidden rounded-xl bg-white dark:bg-[#1e1e2e] shadow-2xl ring-1 ring-black/5 dark:ring-white/10 transition-all flex flex-col max-h-[85vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex items-center space-x-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                            <Wifi className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Auto Discovery</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">สแกนหาเครื่องพิมพ์ในวง LAN อัตโนมัติ</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-500 focus:outline-none">
                        <span className="sr-only">Close</span>
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 flex flex-col gap-6 overflow-y-auto">
                    
                    {/* Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="col-span-1">
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Subnet CIDR</label>
                            <input
                                type="text"
                                className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                value={cidr}
                                onChange={e => setCidr(e.target.value)}
                                placeholder="192.168.1.0/24"
                                disabled={isScanning}
                            />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">SNMP Community</label>
                            <input
                                type="text"
                                className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                value={snmpCommunity}
                                onChange={e => setSnmpCommunity(e.target.value)}
                                placeholder="public"
                                disabled={isScanning}
                            />
                        </div>
                        <div className="col-span-1">
                            <button
                                onClick={handleScan}
                                disabled={isScanning}
                                className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                <span>{isScanning ? 'Scanning...' : 'Scan Network'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Results Area */}
                    <div className="flex-1 flex flex-col min-h-[300px] border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
                        {isScanning ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500 dark:text-slate-400">
                                <div className="relative mb-4">
                                    <div className="h-16 w-16 rounded-full border-4 border-indigo-100 dark:border-indigo-900/30"></div>
                                    <div className="absolute top-0 left-0 h-16 w-16 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
                                    <Server className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-indigo-500 animate-pulse" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">กำลังสแกนเครือข่าย...</h3>
                                <p className="text-sm mt-1 text-center max-w-md">ระบบกำลังส่งคำสั่ง Ping และตรวจสอบ SNMP/HTTP ไปยังทุก IP ใน Subnet ที่ระบุ กระบวนการนี้อาจใช้เวลาสักครู่</p>
                            </div>
                        ) : hasScanned && results.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500 dark:text-slate-400">
                                <Server className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-4" />
                                <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300">ไม่พบเครื่องพิมพ์ใหม่</h3>
                                <p className="text-sm mt-1">ลองเปลี่ยน IP Range หรือ SNMP Community แล้วสแกนอีกครั้ง</p>
                            </div>
                        ) : results.length > 0 ? (
                            <div className="flex flex-col h-full">
                                <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                    <button 
                                        onClick={toggleSelectAll}
                                        className="flex items-center space-x-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                                    >
                                        {selectedIps.size === results.length ? <CheckSquare className="h-4 w-4 text-indigo-600" /> : <Square className="h-4 w-4" />}
                                        <span>Select All ({selectedIps.size}/{results.length})</span>
                                    </button>
                                </div>
                                <div className="overflow-y-auto flex-1 p-2 space-y-1">
                                    {results.map((p, idx) => (
                                        <div 
                                            key={idx}
                                            onClick={() => toggleSelect(p.ip_address)}
                                            className={`flex items-center px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                                                selectedIps.has(p.ip_address) 
                                                    ? 'bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' 
                                                    : 'bg-white dark:bg-slate-800 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                            }`}
                                        >
                                            <div className="shrink-0 mr-4">
                                                {selectedIps.has(p.ip_address) ? (
                                                    <CheckSquare className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                                                ) : (
                                                    <Square className="h-5 w-5 text-slate-300 dark:text-slate-600" />
                                                )}
                                            </div>
                                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                <div>
                                                    <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">{p.ip_address}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{p.manufacturer}</p>
                                                </div>
                                                <div className="flex items-center sm:justify-end">
                                                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                        {p.model}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 dark:text-slate-500">
                                <Wifi className="h-16 w-16 mb-4 opacity-20" />
                                <p>ระบุ IP Range ด้านบนแล้วกดปุ่ม Scan Network</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-slate-900/50 flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg font-medium text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        disabled={isAdding || isScanning}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleAddSelected}
                        disabled={selectedIps.size === 0 || isAdding || isScanning}
                        className="flex items-center space-x-2 px-5 py-2 rounded-lg font-medium text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        <span>Add {selectedIps.size} Printers</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
