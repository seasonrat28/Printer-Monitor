import React, { useState } from 'react';
import api from '../services/api';
import { X, Package } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const AddStockModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
    const [model, setModel] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [location, setLocation] = useState('คลังเครื่องสำรอง');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { addToast } = useToast();

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await api.post('/printers/stock/bulk', { model, quantity, location });
            addToast('success', `เพิ่มเครื่องสำรองสำเร็จ ${quantity} เครื่อง`);
            onSuccess();
            onClose();
        } catch (err: any) {
            addToast('error', err.response?.data?.detail || "Failed to add stock printers");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
                <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 bg-indigo-50 dark:bg-indigo-900/30">
                    <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
                        <Package size={20} />
                        เพิ่มเครื่องปริ้นเตอร์สำรองเข้าคลัง
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-500"><X size={20}/></button>
                </div>
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">รุ่นปริ้นเตอร์ (Model) *</label>
                        <input 
                            type="text" required
                            value={model} onChange={e => setModel(e.target.value)}
                            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
                            placeholder="e.g. Apeos 4620"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">จำนวนที่นำเข้า (เครื่อง) *</label>
                        <input 
                            type="number" min="1" max="500" required
                            value={quantity} onChange={e => setQuantity(parseInt(e.target.value))}
                            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">สถานที่เก็บ (Location)</label>
                        <input 
                            type="text" 
                            value={location} onChange={e => setLocation(e.target.value)}
                            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
                        />
                    </div>
                    <div className="pt-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg text-sm font-medium">ยกเลิก</button>
                        <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 text-sm font-medium">
                            {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกเข้าคลัง'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
