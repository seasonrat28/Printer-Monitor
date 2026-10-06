import React, { useState, useEffect, useRef } from 'react';
import { Search, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import type { Printer as PrinterType } from '../types';

export const CommandPalette: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [printers, setPrinters] = useState<PrinterType[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen((prev) => !prev);
            }
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            api.get('/printers/').then(res => setPrinters(res.data)).catch(console.error);
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const filtered = printers.filter(p => {
        const q = query.toLowerCase();
        return (p.hostname || '').toLowerCase().includes(q) ||
               (p.ip_address || '').toLowerCase().includes(q) ||
               (p.location || '').toLowerCase().includes(q) ||
               (p.model || '').toLowerCase().includes(q) ||
               (p.serial_number || '').toLowerCase().includes(q);
    }).slice(0, 8);

    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    const handleSelect = (printer: PrinterType) => {
        setIsOpen(false);
        navigate(`/printers`);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % filtered.length);
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length);
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered[selectedIndex]) {
                handleSelect(filtered[selectedIndex]);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] sm:pt-[20vh] animate-in fade-in duration-200">
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsOpen(false)} />
            <div className="relative w-full max-w-2xl transform overflow-hidden rounded-xl bg-white dark:bg-[#1e1e2e] shadow-2xl ring-1 ring-black/5 dark:ring-white/10 transition-all animate-in zoom-in-95 duration-200">
                <div className="flex items-center border-b border-slate-100 dark:border-slate-800 px-4">
                    <Search className="h-6 w-6 text-indigo-500" />
                    <input
                        ref={inputRef}
                        type="text"
                        className="h-16 w-full border-0 bg-transparent pl-4 pr-4 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-0 sm:text-lg"
                        placeholder="ค้นหาเครื่องพิมพ์ (IP, ชื่อ, สถานที่, หรือซีเรียลนัมเบอร์)..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <div className="flex shrink-0 items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        ESC
                    </div>
                </div>

                {filtered.length > 0 ? (
                    <ul className="max-h-96 scroll-py-3 overflow-y-auto p-3">
                        {filtered.map((printer, index) => (
                            <li
                                key={printer.id}
                                className={`flex cursor-pointer select-none items-center rounded-lg px-4 py-3 transition-colors ${
                                    index === selectedIndex
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                                onClick={() => handleSelect(printer)}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                <div className={`flex h-10 w-10 flex-none items-center justify-center rounded-lg ${index === selectedIndex ? 'bg-indigo-500 text-white' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'}`}>
                                    <Printer className="h-5 w-5" />
                                </div>
                                <div className="ml-4 flex-auto truncate">
                                    <p className="font-semibold text-[15px]">{printer.hostname || printer.ip_address}</p>
                                    <p className={`text-xs mt-0.5 ${index === selectedIndex ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'}`}>
                                        {printer.location || printer.model || printer.ip_address}
                                    </p>
                                </div>
                                <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                    index === selectedIndex ? 'bg-white/20 text-white' :
                                    printer.status === 'ONLINE' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' : 
                                    printer.status === 'WARNING' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400' : 
                                    'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
                                }`}>
                                    {printer.status}
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    query !== '' && (
                        <div className="px-6 py-14 text-center text-sm sm:px-14">
                            <Printer className="mx-auto h-8 w-8 text-slate-400 mb-4 opacity-50" />
                            <p className="mt-4 font-semibold text-slate-900 dark:text-slate-200">ไม่พบเครื่องพิมพ์ที่ค้นหา</p>
                            <p className="mt-2 text-slate-500 dark:text-slate-400">
                                ไม่พบข้อมูลที่ตรงกับ "{query}" กรุณาลองใช้คำค้นหาอื่น
                            </p>
                        </div>
                    )
                )}
                
                <div className="flex flex-wrap items-center bg-slate-50/50 dark:bg-[#1A1D20]/50 px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
                    <span className="flex items-center"><kbd className="mx-1 flex h-5 w-5 items-center justify-center rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-semibold sm:mx-2">↑</kbd><kbd className="mx-1 flex h-5 w-5 items-center justify-center rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-semibold sm:mx-2">↓</kbd> เพื่อเลื่อน</span>
                    <span className="flex items-center ml-4"><kbd className="mx-1 flex px-2 h-5 items-center justify-center rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-semibold sm:mx-2">Enter</kbd> เพื่อเลือก</span>
                </div>
            </div>
        </div>
    );
};
