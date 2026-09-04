import React, { useEffect, useState, useRef } from 'react';
import { printerService } from '../services/api';
import { useWebSocket } from '../contexts/WebSocketContext';
import { Printer as PrinterIcon, Plus, Trash2, RefreshCw, Upload, Download, ExternalLink } from 'lucide-react';
import api from '../services/api';

interface Printer {
    id: number;
    ip_address: string;
    hostname: string;
    model: string;
    manufacturer: string;
    status: string;
    last_seen: string;
}

const PrintersList = () => {
    const [printers, setPrinters] = useState<Printer[]>([]);
    const [loading, setLoading] = useState(true);
    const { lastEvent } = useWebSocket();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newPrinter, setNewPrinter] = useState({ ip_address: '', hostname: '', manufacturer: '', model: '', snmp_community: 'public' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchPrinters();
    }, []);

    useEffect(() => {
        if (lastEvent?.type === 'STATUS_UPDATE') {
            setPrinters(prev => prev.map(p => 
                p.id === lastEvent.data.printer_id 
                    ? { ...p, status: lastEvent.data.status } 
                    : p
            ));
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
            await printerService.addPrinter(newPrinter);
            setIsAddModalOpen(false);
            setNewPrinter({ ip_address: '', hostname: '', manufacturer: '', model: '', snmp_community: 'public' });
            fetchPrinters();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Failed to add printer');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">Printers Directory</h2>
                <div className="flex space-x-3">
                    <button 
                        onClick={fetchPrinters}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg flex items-center space-x-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
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
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg flex items-center space-x-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                        <Upload size={16} />
                        <span>Import CSV</span>
                    </button>
                    <button 
                        onClick={handleExport}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg flex items-center space-x-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                        <Download size={16} />
                        <span>Export CSV</span>
                    </button>
                    <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center space-x-2 hover:bg-indigo-700 transition-colors"
                    >
                        <Plus size={16} />
                        <span>Add Printer</span>
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-sm uppercase tracking-wider text-gray-500 font-semibold">
                            <th className="p-4">IP Address</th>
                            <th className="p-4">Manufacturer</th>
                            <th className="p-4">Model</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Last Seen</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-gray-500">Loading printers...</td>
                            </tr>
                        ) : printers.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-gray-500">No printers found.</td>
                            </tr>
                        ) : (
                            printers.map(printer => (
                                <tr key={printer.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                                    <td className="p-4 font-medium flex items-center space-x-3">
                                        <PrinterIcon size={18} className="text-gray-400" />
                                        <span>{printer.ip_address}</span>
                                    </td>
                                    <td className="p-4 text-gray-600 dark:text-gray-300">{printer.manufacturer || '-'}</td>
                                    <td className="p-4 text-gray-600 dark:text-gray-300">{printer.model || '-'}</td>
                                    <td className="p-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                            ${printer.status === 'ONLINE' ? 'bg-green-100 text-green-800' : 
                                              printer.status === 'OFFLINE' ? 'bg-red-100 text-red-800' : 
                                              'bg-yellow-100 text-yellow-800'}`}>
                                            {printer.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-500 text-sm">
                                        {printer.last_seen ? new Date(printer.last_seen).toLocaleString() : 'Never'}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end space-x-2">
                                            <a 
                                                href={`http://${printer.ip_address}`} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="text-gray-400 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100 p-2"
                                                title="Open Web Management"
                                            >
                                                <ExternalLink size={18} />
                                            </a>
                                            <button 
                                                onClick={() => handleDelete(printer.id)}
                                                className="text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100 p-2"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/75 transition-opacity">
                    <div className="bg-white dark:bg-gray-800 rounded-xl text-left overflow-hidden shadow-2xl transform transition-all w-full max-w-lg border border-gray-200 dark:border-gray-700">
                        <form onSubmit={handleAddPrinter}>
                            <div className="px-6 py-5">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white" id="modal-title">
                                    Add New Printer
                                </h3>
                                <div className="mt-6 space-y-4">
                                    <div>
                                        <label htmlFor="ip_address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">IP Address *</label>
                                        <input type="text" id="ip_address" required
                                            className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent sm:text-sm dark:bg-gray-700 dark:text-white transition-colors"
                                            value={newPrinter.ip_address} onChange={e => setNewPrinter({...newPrinter, ip_address: e.target.value})}
                                            placeholder="e.g. 192.168.1.100"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="hostname" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Hostname (Optional)</label>
                                        <input type="text" id="hostname"
                                            className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent sm:text-sm dark:bg-gray-700 dark:text-white transition-colors"
                                            value={newPrinter.hostname} onChange={e => setNewPrinter({...newPrinter, hostname: e.target.value})}
                                            placeholder="e.g. PRINTER-01"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="manufacturer" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Manufacturer (Optional)</label>
                                        <input type="text" id="manufacturer"
                                            className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent sm:text-sm dark:bg-gray-700 dark:text-white transition-colors"
                                            value={newPrinter.manufacturer} onChange={e => setNewPrinter({...newPrinter, manufacturer: e.target.value})}
                                            placeholder="e.g. HP, Canon"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="model" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Model (Optional)</label>
                                        <input type="text" id="model"
                                            className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent sm:text-sm dark:bg-gray-700 dark:text-white transition-colors"
                                            value={newPrinter.model} onChange={e => setNewPrinter({...newPrinter, model: e.target.value})}
                                            placeholder="e.g. LaserJet Pro"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="snmp_community" className="block text-sm font-medium text-gray-700 dark:text-gray-300">SNMP Community</label>
                                        <input type="text" id="snmp_community"
                                            className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent sm:text-sm dark:bg-gray-700 dark:text-white transition-colors"
                                            value={newPrinter.snmp_community} onChange={e => setNewPrinter({...newPrinter, snmp_community: e.target.value})}
                                            placeholder="public"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 flex justify-end space-x-3 border-t border-gray-200 dark:border-gray-700">
                                <button type="button" onClick={() => setIsAddModalOpen(false)} className="inline-flex justify-center rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSubmitting} className="inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors">
                                    {isSubmitting ? 'Adding...' : 'Add Printer'}
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
