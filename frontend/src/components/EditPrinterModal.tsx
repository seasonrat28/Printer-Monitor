import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../services/api';
import type { Printer } from '../types';

interface EditPrinterModalProps {
    isOpen: boolean;
    onClose: () => void;
    printer: Printer | null;
    onSaved: () => void;
}

export const EditPrinterModal: React.FC<EditPrinterModalProps> = ({ isOpen, onClose, printer, onSaved }) => {
    const [formData, setFormData] = useState<Partial<Printer>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (printer && isOpen) {
            setFormData({
                asset_status: printer.asset_status || 'Deployed',
                purchase_date: printer.purchase_date ? printer.purchase_date.split('T')[0] : '',
                warranty_expiry: printer.warranty_expiry ? printer.warranty_expiry.split('T')[0] : '',
                lease_provider: printer.lease_provider || '',
                lease_start_date: printer.lease_start_date ? printer.lease_start_date.split('T')[0] : '',
                lease_end_date: printer.lease_end_date ? printer.lease_end_date.split('T')[0] : '',
            });
        }
    }, [printer, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value === '' ? null : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!printer) return;
        setIsSubmitting(true);
        try {
            const payload = { ...formData };
            if (payload.purchase_date === '') payload.purchase_date = null;
            if (payload.warranty_expiry === '') payload.warranty_expiry = null;
            if (payload.lease_start_date === '') payload.lease_start_date = null;
            if (payload.lease_end_date === '') payload.lease_end_date = null;

            await api.put(`/printers/${printer.id}`, payload);
            onSaved();
            onClose();
        } catch (err) {
            console.error("Failed to update printer", err);
            alert("Failed to update printer");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !printer) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 dark:bg-black/70 transition-opacity">
            <div className="bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-2xl transform transition-all w-full max-w-lg border border-gray-300 dark:border-gray-600">
                <div className="flex justify-between items-center px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200">
                        Edit Asset Info: {printer.ip_address}
                    </h3>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                        <X size={16} />
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4">
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                            <div className="sm:col-span-2 lg:col-span-1">
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Asset Status</label>
                                <div className="relative">
                                    <select 
                                        name="asset_status" 
                                        value={formData.asset_status || ''} 
                                        onChange={handleChange}
                                        className="w-full text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 py-2.5 px-3 appearance-none"
                                    >
                                        <option value="Deployed">🟢 Deployed</option>
                                        <option value="In Storage">🟡 In Storage</option>
                                        <option value="In Repair">🟠 In Repair</option>
                                        <option value="Retired">🔴 Retired</option>
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                </div>
                            </div>
                            <div className="hidden lg:block"></div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Purchase Date</label>
                                <input 
                                    type="date" 
                                    name="purchase_date" 
                                    value={formData.purchase_date || ''} 
                                    onChange={handleChange}
                                    className="w-full text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 py-2 px-3"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Warranty Expiry</label>
                                <input 
                                    type="date" 
                                    name="warranty_expiry" 
                                    value={formData.warranty_expiry || ''} 
                                    onChange={handleChange}
                                    className="w-full text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 py-2 px-3"
                                />
                            </div>
                        </div>

                        <hr className="border-gray-200 dark:border-gray-700 my-4" />
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Lease Tracking</h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Lease Provider</label>
                                <input 
                                    type="text" 
                                    name="lease_provider" 
                                    value={formData.lease_provider || ''} 
                                    onChange={handleChange}
                                    placeholder="e.g. Ricoh Thailand, FujiXerox"
                                    className="w-full text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 py-2 px-3"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Lease Start Date</label>
                                <input 
                                    type="date" 
                                    name="lease_start_date" 
                                    value={formData.lease_start_date || ''} 
                                    onChange={handleChange}
                                    className="w-full text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 py-2 px-3"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Lease End Date</label>
                                <input 
                                    type="date" 
                                    name="lease_end_date" 
                                    value={formData.lease_end_date || ''} 
                                    onChange={handleChange}
                                    className="w-full text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 py-2 px-3"
                                />
                            </div>
                        </div>

                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 flex justify-end space-x-2 border-t border-gray-200 dark:border-gray-600">
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex justify-center rounded border border-gray-300 dark:border-gray-500 px-4 py-1.5 bg-white dark:bg-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-500 focus:outline-none min-w-[80px]"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="inline-flex justify-center rounded border border-transparent px-6 py-1.5 bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none disabled:opacity-50 min-w-[80px]"
                        >
                            {isSubmitting ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
