import React, { useEffect, useState, useRef } from 'react';
import { printerService } from '../services/api';
import { useWebSocket } from '../contexts/WebSocketContext';
import { Printer as PrinterIcon, Plus, Trash2, RefreshCw, Upload, Download, ExternalLink, Info, Star, ChevronDown, History } from 'lucide-react';
import api from '../services/api';

interface Printer {
    id: number;
    ip_address: string;
    hostname: string;
    model: string;
    manufacturer: string;
    status: string;
    last_seen: string;
    toner_level?: number;
    drum_level?: number;
    location?: string;
    serial_number?: string;
}

const PrintersList = () => {
    const [printers, setPrinters] = useState<Printer[]>([]);
    const [loading, setLoading] = useState(true);
    const { lastEvent } = useWebSocket();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [rawIps, setRawIps] = useState('');

    useEffect(() => {
        fetchPrinters();
    }, []);

    useEffect(() => {
        if (lastEvent?.type === 'STATUS_UPDATE') {
            setPrinters(prev => prev.map(p => 
                p.id === lastEvent.data.printer_id 
                    ? { 
                        ...p, 
                        status: lastEvent.data.status,
                        hostname: lastEvent.data.hostname !== undefined ? lastEvent.data.hostname : p.hostname,
                        location: lastEvent.data.location !== undefined ? lastEvent.data.location : p.location,
                        serial_number: lastEvent.data.serial_number !== undefined ? lastEvent.data.serial_number : p.serial_number,
                        model: lastEvent.data.model !== undefined ? lastEvent.data.model : p.model
                      } 
                    : p
            ));
        } else if (lastEvent?.type === 'SUPPLY_UPDATE') {
            setPrinters(prev => prev.map(p => {
                if (p.id === lastEvent.data.printer_id) {
                    return { 
                        ...p, 
                        toner_level: lastEvent.data.toner_level !== undefined ? lastEvent.data.toner_level : p.toner_level,
                        drum_level: lastEvent.data.drum_level !== undefined ? lastEvent.data.drum_level : p.drum_level,
                        hostname: lastEvent.data.hostname !== undefined ? lastEvent.data.hostname : p.hostname,
                        location: lastEvent.data.location !== undefined ? lastEvent.data.location : p.location,
                        serial_number: lastEvent.data.serial_number !== undefined ? lastEvent.data.serial_number : p.serial_number,
                        model: lastEvent.data.model !== undefined ? lastEvent.data.model : p.model
                    };
                }
                return p;
            }));
        }
    }, [lastEvent]);

    const fetchPrinters = async () => {
        try {
            setLoading(true);
            const response = await printerService.getPrinters();
            setPrinters(response.data);
        } catch (error) {
            console.error("Failed to fetch printers", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm("Are you sure you want to delete this printer?")) {
            try {
                await printerService.deletePrinter(id);
                fetchPrinters();
            } catch (error) {
                console.error("Failed to delete printer", error);
            }
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            await api.post('/printers/import/csv', formData);
            alert('Printers imported successfully!');
            fetchPrinters();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Failed to import printers');
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleExport = async () => {
        try {
            const response = await api.get('/printers/export/csv', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'printers_export.csv');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error("Failed to export printers", err);
            alert("Failed to export printers");
        }
    };

    const handleAddPrinter = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            const response = await api.post('/printers/bulk', { raw_ips: rawIps });
            alert(response.data.message);
            setIsAddModalOpen(false);
            setRawIps('');
            fetchPrinters();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Failed to add printers');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ONLINE': return 'border-emerald-500 bg-emerald-500 text-emerald-700';
            case 'WARNING': return 'border-amber-500 bg-amber-500 text-amber-700';
            case 'OFFLINE': return 'border-red-500 bg-red-500 text-red-700';
            default: return 'border-gray-400 bg-gray-400 text-gray-700';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'ONLINE': return 'Ready';
            case 'WARNING': return 'Warning';
            case 'OFFLINE': return 'Error';
            default: return 'Unknown';
        }
    };

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'ONLINE': return 'bg-emerald-100 text-emerald-700 border-emerald-500';
            case 'WARNING': return 'bg-amber-100 text-amber-700 border-amber-500';
            case 'OFFLINE': return 'bg-red-100 text-red-700 border-red-500';
            default: return 'bg-gray-100 text-gray-700 border-gray-400';
        }
    };

    const getStatusCardBorder = (status: string) => {
        switch (status) {
            case 'ONLINE': return 'border-emerald-500';
            case 'WARNING': return 'border-amber-500';
            case 'OFFLINE': return 'border-red-500';
            default: return 'border-gray-300';
        }
    };

    const renderProgressBar = (label: string, level?: number) => {
        if (level === undefined || level === null) return (
             <div className="flex-1 flex flex-col items-center opacity-50">
                <span className="text-[10px] uppercase font-bold text-gray-500 flex items-center space-x-1">
                    <span>✏️</span> <span>{label}</span>
                </span>
                <span className="text-xl font-bold text-gray-400 my-1">-</span>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
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
                <span className="text-[10px] uppercase font-bold text-gray-500 flex items-center space-x-1 tracking-wider">
                    <span className="opacity-70">{label === 'TONER' ? '✒️' : '🗞️'}</span> 
                    <span>{label}</span>
                </span>
                <span className={`text-2xl font-bold my-1 ${textColor}`}>{level}%</span>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                    <div className={`${colorClass} h-1.5 rounded-full`} style={{ width: `${level}%` }}></div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">Printers Directory</h2>
                <div className="flex space-x-3">
                    <button 
                        onClick={fetchPrinters}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg flex items-center space-x-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm"
                    >
                        <RefreshCw size={16} />
                        <span>Refresh</span>
                    </button>
                    <input 
                        type="file" 
                        accept=".csv" 
                        className="hidden" 
                        ref={fileInputRef} 
                        onChange={handleImport} 
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg flex items-center space-x-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm"
                    >
                        <Upload size={16} />
                        <span>Import CSV</span>
                    </button>
                    <button 
                        onClick={handleExport}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg flex items-center space-x-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm"
                    >
                        <Download size={16} />
                        <span>Export CSV</span>
                    </button>
                    <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center space-x-2 hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        <Plus size={16} />
                        <span>Add Printers</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading printers...</div>
            ) : printers.length === 0 ? (
                <div className="text-center py-12 text-gray-500 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    No printers found. Add one to get started.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {printers.map(printer => (
                        <div key={printer.id} className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow group flex flex-col relative overflow-hidden border-2 ${getStatusCardBorder(printer.status)}`}>
                            
                            {/* Card Content */}
                            <div className="p-5 flex-1 flex flex-col">
                                
                                {/* Header */}
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center space-x-2 w-full">
                                        <PrinterIcon className="text-gray-400" size={20} />
                                        <h3 className="font-bold text-gray-800 text-lg truncate flex-1" title={printer.hostname || printer.model || printer.ip_address}>
                                            {printer.hostname || printer.model || printer.ip_address}
                                        </h3>
                                        <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white uppercase tracking-wider ${getStatusColor(printer.status).split(' ')[1]}`}>
                                            {printer.status}
                                        </div>
                                        <button className="text-gray-300 hover:text-amber-400 transition-colors ml-1">
                                            <Star size={18} />
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Detailed Info */}
                                <div className="text-xs text-gray-500 space-y-2 mb-4 w-full">
                                    <div className="flex justify-between border-b border-gray-100 pb-1">
                                        <span className="font-medium">IP:</span> 
                                        <span className="text-gray-800">{printer.ip_address}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-100 pb-1">
                                        <span className="font-medium">Location:</span> 
                                        <span className="text-gray-800 truncate max-w-[150px] text-right" title={printer.location || '-'}>{printer.location || '-'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-100 pb-1">
                                        <span className="font-medium">Serial No.:</span> 
                                        <span className="text-gray-800">{printer.serial_number || '-'}</span>
                                    </div>
                                </div>

                                {/* Status Box */}
                                <div className={`px-3 py-1.5 rounded-md border text-xs font-bold w-full text-center mb-5 ${getStatusBadgeClass(printer.status)}`}>
                                    Status: {getStatusText(printer.status)}
                                </div>

                                {/* Progress Bars */}
                                <div className="flex items-center justify-between space-x-6 px-2 mb-4">
                                    {renderProgressBar("TONER", printer.toner_level)}
                                    {/* Vertical Divider */}
                                    <div className="h-10 w-px bg-gray-200"></div>
                                    {renderProgressBar("DRUM", printer.drum_level)}
                                </div>
                                
                            </div>

                            {/* Footer */}
                            <div className="bg-gray-50/80 px-4 py-2 border-t border-gray-100 flex flex-col items-center justify-center">
                                <div className="flex items-center text-[10px] text-gray-400 mb-2 space-x-1">
                                    <RefreshCw size={10} className={printer.status === 'ONLINE' ? 'text-emerald-500' : ''} />
                                    <span>อัพเดทล่าสุด: {printer.last_seen ? new Date(printer.last_seen).toLocaleString('en-GB') : 'Never'}</span>
                                </div>
                                <button className="flex items-center space-x-1 text-[11px] text-gray-500 hover:text-gray-800 transition-colors font-medium">
                                    <History size={12} />
                                    <span>ประวัติ</span>
                                    <ChevronDown size={12} />
                                </button>
                            </div>
                            
                            {/* Hover Actions */}
                            <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-md shadow-sm p-1">
                                <a href={`http://${printer.ip_address}`} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Open Web Management">
                                    <ExternalLink size={14} />
                                </a>
                                <button onClick={() => handleDelete(printer.id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete Printer">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/75 transition-opacity backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all w-full max-w-lg border border-gray-200 dark:border-gray-700">
                        <form onSubmit={handleAddPrinter}>
                            <div className="px-6 py-6">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2" id="modal-title">
                                    Add Printers
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                                    Enter IP addresses. You can use ranges (e.g., <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">192.168.1.10-50</code>), comma-separated, or one per line.
                                </p>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="rawIps" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">IP Addresses *</label>
                                        <textarea id="rawIps" required
                                            rows={6}
                                            className="block w-full border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent sm:text-sm dark:bg-gray-700 dark:text-white transition-colors resize-none"
                                            value={rawIps} onChange={e => setRawIps(e.target.value)}
                                            placeholder="10.119.34.21&#10;10.119.34.22-30"
                                        />
                                    </div>
                                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 flex items-start space-x-2 text-sm text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
                                        <Info className="flex-shrink-0 w-4 h-4 mt-0.5" />
                                        <p>SNMP settings (public / v2c) will be applied by default. The system will automatically fetch hostnames and models once online.</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 flex justify-end space-x-3 border-t border-gray-200 dark:border-gray-700">
                                <button type="button" onClick={() => setIsAddModalOpen(false)} className="inline-flex justify-center rounded-xl border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSubmitting || !rawIps.trim()} className="inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors">
                                    {isSubmitting ? 'Adding...' : 'Add Printers'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PrintersList;
