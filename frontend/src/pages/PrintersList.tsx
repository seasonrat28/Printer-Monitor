import React, { useEffect, useState } from 'react';
import { printerService } from '../services/api';
import { useWebSocket } from '../contexts/WebSocketContext';
import { Printer as PrinterIcon, Plus, Trash2, RefreshCw } from 'lucide-react';

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
                    <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center space-x-2 hover:bg-indigo-700 transition-colors">
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
                                        <button 
                                            onClick={() => handleDelete(printer.id)}
                                            className="text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PrintersList;
