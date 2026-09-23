import React, { useState } from 'react';
import api from '../services/api';
import { X, Send } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import type { Printer } from '../types';

interface Props {
    printer: Printer | null;
    onClose: () => void;
    onSuccess: () => void;
}

export const DeployModal: React.FC<Props> = ({ printer, onClose, onSuccess }) => {
    const [ipAddress, setIpAddress] = useState('');
    const [hostname, setHostname] = useState('');
    const [location, setLocation] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { addToast } = useToast();

    if (!printer) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await api.post(`/printers/${printer.id}/deploy`, { 
                ip_address: ipAddress, 
                hostname: hostname || undefined,
                location: location || undefined 
            });
            addToast('success', `ติดตั้งปริ้นเตอร์และเริ่มมอนิเตอร์ IP: ${ipAddress} สำเร็จ`);
            onSuccess();
            onClose();
        } catch (err: any) {
            addToast('error', err.response?.data?.detail || "Failed to deploy printer");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
                <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 bg-emerald-50 dark:bg-emerald-900/30">
                    <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                        <Send size={20} />
                        นำเครื่องไปติดตั้ง (Deploy)
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-500"><X size={20}/></button>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        คุณกำลังนำ <strong>{printer.model || 'Unknown Model'}</strong> ออกจากคลัง
                        กรุณาระบุ IP Address เพื่อเริ่มการมอนิเตอร์
                    </p>
                </div>
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">IP Address *</label>
                        <input 
                            type="text" required
                            value={ipAddress} onChange={e => setIpAddress(e.target.value)}
                            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm font-mono"
                            placeholder="192.168.1.50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">ชื่อเครื่อง (Hostname)</label>
                        <input 
                            type="text" 
                            value={hostname} onChange={e => setHostname(e.target.value)}
                            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
                            placeholder="PRN-HR-01"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">สถานที่ติดตั้ง (Location)</label>
                        <input 
                            type="text" 
                            value={location} onChange={e => setLocation(e.target.value)}
                            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
                            placeholder="แผนก HR ชั้น 2"
                        />
                    </div>
                    <div className="pt-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg text-sm font-medium">ยกเลิก</button>
                        <button type="submit" disabled={isSubmitting || !ipAddress} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50 text-sm font-medium">
                            {isSubmitting ? 'กำลังทำงาน...' : 'ยืนยันการติดตั้ง'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
