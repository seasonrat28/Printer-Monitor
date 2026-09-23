import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Map, Upload, Trash2, Printer as PrinterIcon, Check, X, Edit2, Search, ChevronDown } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useWebSocket } from '../contexts/WebSocketContext';

interface Printer {
    id: number;
    ip_address: string;
    hostname: string;
    status: string;
    toner_level: number | null;
}

interface Pin {
    id?: number;
    printer_id: number;
    x_percent: number;
    y_percent: number;
    printer?: Printer;
}

export const FloorMapPage = () => {
    const [maps, setMaps] = useState<any[]>([]);
    const [selectedMap, setSelectedMap] = useState<any>(null);
    const [pins, setPins] = useState<Pin[]>([]);
    const [printers, setPrinters] = useState<Printer[]>([]);
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();
    
    const [isAddingPin, setIsAddingPin] = useState(false);
    const [selectedPrinterToAdd, setSelectedPrinterToAdd] = useState<number | null>(null);
    const [printerSearch, setPrinterSearch] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    
    // Zoom & Pan state
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const hasDragged = useRef(false);

    // Drag & Drop state
    const [draggingPinId, setDraggingPinId] = useState<number | null>(null);
    
    // Quick View state
    const [selectedPinDetails, setSelectedPinDetails] = useState<Printer | null>(null);

    const mapContainerRef = useRef<HTMLDivElement>(null);
    const transformContainerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    
    const { lastEvent } = useWebSocket();

    // Debounced fetch for WebSocket updates
    const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastFetchRef = useRef<number>(0);

    const debouncedFetch = () => {
        const cooldown = 3000;
        const now = Date.now();
        if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
        const remaining = cooldown - (now - lastFetchRef.current);
        if (remaining <= 0) {
            fetchInitialData(false);
            if (selectedMap) fetchPins(selectedMap.id);
            lastFetchRef.current = Date.now();
        } else {
            fetchTimerRef.current = setTimeout(() => {
                fetchInitialData(false);
                if (selectedMap) fetchPins(selectedMap.id);
                lastFetchRef.current = Date.now();
            }, remaining);
        }
    };

    useEffect(() => {
        if (lastEvent) {
            debouncedFetch();
        }
    }, [lastEvent]);

    useEffect(() => {
        const container = mapContainerRef.current;
        if (!container) return;
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const zoomDelta = e.deltaY * -0.001;
            setZoom(z => Math.min(Math.max(0.2, z + zoomDelta), 5));
        };
        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, []);

    useEffect(() => {
        fetchInitialData();
        
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (selectedMap) {
            fetchPins(selectedMap.id);
        }
    }, [selectedMap]);

    const fetchInitialData = async (showLoader = true) => {
        try {
            if (showLoader) setLoading(true);
            const [mapsRes, printersRes] = await Promise.all([
                api.get('/floormaps'),
                api.get('/printers')
            ]);
            setMaps(mapsRes.data);
            setPrinters(printersRes.data);
            if (mapsRes.data.length > 0) {
                setSelectedMap(prev => {
                    if (!prev) return mapsRes.data[0];
                    const exists = mapsRes.data.find((m: any) => m.id === prev.id);
                    return exists ? exists : mapsRes.data[0];
                });
            } else {
                setSelectedMap(null);
            }
        } catch (err) {
            addToast('error', 'Error', 'Failed to load initial data');
        } finally {
            setLoading(false);
        }
    };

    const fetchPins = async (mapId: number) => {
        try {
            const res = await api.get(`/floormaps/${mapId}/pins`);
            setPins(res.data);
        } catch (err) {
            addToast('error', 'Error', 'Failed to load pins');
        }
    };

    const handleUploadMap = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const name = prompt("ชื่อแปลนอาคาร:");
        if (!name) return;

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await api.post(`/floormaps/upload?name=${encodeURIComponent(name)}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setMaps([...maps, res.data]);
            setSelectedMap(res.data);
            addToast('success', 'Success', 'Map uploaded successfully');
        } catch (err) {
            addToast('error', 'Error', 'Failed to upload map');
        }
    };

    const handleMapClick = async (e: React.MouseEvent<HTMLDivElement>) => {
        if (hasDragged.current) return; // Prevent click if we were panning or dragging
        if (!isAddingPin || !selectedPrinterToAdd || !selectedMap || !transformContainerRef.current) return;

        const rect = transformContainerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const x_percent = (x / rect.width) * 100;
        const y_percent = (y / rect.height) * 100;

        try {
            await api.post(`/floormaps/${selectedMap.id}/pins`, {
                printer_id: selectedPrinterToAdd,
                x_percent,
                y_percent
            });
            
            setIsAddingPin(false);
            setSelectedPrinterToAdd(null);
            fetchPins(selectedMap.id);
            addToast('success', 'Success', 'Pin placed successfully');
        } catch (err) {
            addToast('error', 'Error', 'Failed to place pin');
        }
    };

    const handleDeletePin = async (pinId: number) => {
        if (!selectedMap || !window.confirm('คุณต้องการลบหมุดนี้ใช่หรือไม่?')) return;
        try {
            await api.delete(`/floormaps/${selectedMap.id}/pins/${pinId}`);
            setPins(pins.filter(p => p.id !== pinId));
            addToast('success', 'Success', 'Pin deleted');
        } catch (err) {
            addToast('error', 'Error', 'Failed to delete pin');
        }
    };

    const handlePanStart = (e: React.MouseEvent) => {
        if (e.button !== 0 || draggingPinId || isAddingPin) return;
        setIsPanning(true);
        hasDragged.current = false;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handlePanMove = (e: React.MouseEvent) => {
        if (isPanning) {
            const dx = e.clientX - lastMousePos.current.x;
            const dy = e.clientY - lastMousePos.current.y;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDragged.current = true;
            setPan(p => ({ x: p.x + dx, y: p.y + dy }));
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        } else if (draggingPinId && transformContainerRef.current) {
            hasDragged.current = true;
            const rect = transformContainerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const x_percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
            const y_percent = Math.max(0, Math.min(100, (y / rect.height) * 100));
            
            setPins(prev => prev.map(p => 
                p.id === draggingPinId ? { ...p, x_percent, y_percent } : p
            ));
        }
    };

    const handlePanEnd = async () => {
        setIsPanning(false);
        if (draggingPinId && selectedMap) {
            const pin = pins.find(p => p.id === draggingPinId);
            if (pin) {
                try {
                    await api.post(`/floormaps/${selectedMap.id}/pins`, {
                        printer_id: pin.printer_id,
                        x_percent: pin.x_percent,
                        y_percent: pin.y_percent
                    });
                    addToast('success', 'Success', 'อัปเดตตำแหน่งหมุดแล้ว');
                } catch (err) {
                    addToast('error', 'Error', 'Failed to update pin location');
                }
            }
            setDraggingPinId(null);
        }
        setTimeout(() => { hasDragged.current = false; }, 50);
    };

    const handlePinMouseDown = (e: React.MouseEvent, pinId: number) => {
        if (isAddingPin) return;
        e.stopPropagation();
        setDraggingPinId(pinId);
        hasDragged.current = false;
    };

    const handlePinClick = (e: React.MouseEvent, pin: Pin) => {
        e.stopPropagation();
        if (hasDragged.current || isAddingPin) return;
        if (pin.printer) {
            setSelectedPinDetails(pin.printer);
        }
    };

    const getPinColor = (pin: Pin) => {
        if (pin.printer?.status === 'ONLINE') return 'bg-emerald-500';
        if (pin.printer?.status === 'WARNING') return 'bg-amber-500';
        return 'bg-red-500';
    };

    const handleEditMapName = async () => {
        if (!selectedMap) return;
        
        const newName = prompt("แก้ไขชื่อแปลนอาคาร:", selectedMap.name);
        if (!newName || newName === selectedMap.name) return;

        try {
            const res = await api.put(`/floormaps/${selectedMap.id}`, { name: newName });
            
            const updatedMaps = maps.map(m => m.id === selectedMap.id ? res.data : m);
            setMaps(updatedMaps);
            setSelectedMap(res.data);
            addToast('success', 'Success', 'Map renamed successfully');
        } catch (err) {
            addToast('error', 'Error', 'Failed to rename map');
        }
    };

    const handleDeleteMap = async () => {
        if (!selectedMap) return;
        
        if (!window.confirm(`คุณต้องการลบแปลน "${selectedMap.name}" ใช่หรือไม่?`)) return;

        try {
            await api.delete(`/floormaps/${selectedMap.id}`);
            
            const updatedMaps = maps.filter(m => m.id !== selectedMap.id);
            setMaps(updatedMaps);
            setSelectedMap(updatedMaps.length > 0 ? updatedMaps[0] : null);
            addToast('success', 'Success', 'Map deleted successfully');
        } catch (err) {
            addToast('error', 'Error', 'Failed to delete map');
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center space-x-2">
                    <Map className="text-indigo-600" />
                    <span>Interactive Floor Map</span>
                </h2>
                <div className="flex items-center space-x-4">
                    <select 
                        className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-4"
                        value={selectedMap?.id || ''}
                        onChange={(e) => setSelectedMap(maps.find(m => m.id === parseInt(e.target.value)))}
                    >
                        {maps.length === 0 && <option value="">No maps available</option>}
                        {maps.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>

                    {selectedMap && (
                        <div className="flex items-center space-x-2">
                            <button 
                                type="button"
                                onClick={handleEditMapName}
                                className="h-10 w-10 flex items-center justify-center rounded-md text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                                title="เปลี่ยนชื่อแปลน"
                            >
                                <Edit2 size={22} />
                            </button>
                            <button 
                                type="button"
                                onClick={handleDeleteMap}
                                className="h-10 w-10 flex items-center justify-center rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                title="ลบแปลน"
                            >
                                <Trash2 size={22} />
                            </button>
                        </div>
                    )}

                    <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md flex items-center space-x-2 transition-colors h-10">
                        <Upload size={18} />
                        <span>Upload Map</span>
                        <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={handleUploadMap} />
                    </label>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar */}
                <div className="lg:col-span-1 space-y-4">
                    <Card>
                        <CardHeader className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                            <CardTitle className="text-sm">เพิ่มปริ้นเตอร์ลงในแปลน</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 pt-6">
                            {isAddingPin ? (
                                <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 p-4 rounded-lg text-sm flex flex-col space-y-3">
                                    <p>คลิกที่แผนผังอาคารเพื่อวางหมุดปริ้นเตอร์: <strong>{printers.find(p => p.id === selectedPrinterToAdd)?.hostname}</strong></p>
                                    <button 
                                        type="button"
                                        onClick={() => setIsAddingPin(false)} 
                                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-md font-medium transition-colors"
                                    >
                                        ยกเลิก
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="relative z-50" ref={dropdownRef}>
                                        <div className="relative cursor-text" onClick={() => setIsDropdownOpen(true)}>
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Search className="h-4 w-4 text-gray-400" />
                                            </div>
                                            <input
                                                type="text"
                                                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md py-2 pl-9 pr-8 text-sm focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                                placeholder="ค้นหาหรือเลือกปริ้นเตอร์..."
                                                value={printerSearch}
                                                onChange={(e) => {
                                                    setPrinterSearch(e.target.value);
                                                    setIsDropdownOpen(true);
                                                    setSelectedPrinterToAdd(null);
                                                }}
                                                onFocus={() => setIsDropdownOpen(true)}
                                            />
                                            <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none cursor-pointer" onClick={(e) => { e.stopPropagation(); setIsDropdownOpen(!isDropdownOpen); }}>
                                                <ChevronDown className="h-4 w-4 text-gray-400" />
                                            </div>
                                        </div>
                                        
                                        {isDropdownOpen && (
                                            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
                                                {printers.filter(p => {
                                                    const search = printerSearch.toLowerCase();
                                                    const hn = p.hostname || '';
                                                    const ip = p.ip_address || '';
                                                    return hn.toLowerCase().includes(search) || ip.toLowerCase().includes(search);
                                                }).map(p => {
                                                    const isPinned = pins.some(pin => pin.printer_id === p.id);
                                                    return (
                                                        <div 
                                                            key={p.id}
                                                            className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${isPinned ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-900/50' : ''} ${selectedPrinterToAdd === p.id ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-medium' : 'text-gray-700 dark:text-gray-200'}`}
                                                            onClick={() => {
                                                                if (isPinned) return;
                                                                setSelectedPrinterToAdd(p.id);
                                                                setPrinterSearch(p.hostname || p.ip_address);
                                                                setIsDropdownOpen(false);
                                                            }}
                                                        >
                                                            {p.hostname || p.ip_address} {isPinned ? '(มีหมุดแล้ว)' : ''}
                                                        </div>
                                                    );
                                                })}
                                                {printers.filter(p => {
                                                    const search = printerSearch.toLowerCase();
                                                    const hn = p.hostname || '';
                                                    const ip = p.ip_address || '';
                                                    return hn.toLowerCase().includes(search) || ip.toLowerCase().includes(search);
                                                }).length === 0 && (
                                                    <div className="px-3 py-2 text-sm text-gray-500 text-center">ไม่พบปริ้นเตอร์ที่ค้นหา</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <Button 
                                        onClick={() => setIsAddingPin(true)} 
                                        disabled={!selectedPrinterToAdd}
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center space-x-2"
                                    >
                                        <PrinterIcon size={16} />
                                        <span>เตรียมวางหมุด</span>
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                            <CardTitle className="text-sm">ปริ้นเตอร์ในชั้นนี้ ({pins.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[400px] overflow-y-auto">
                                {pins.map(pin => (
                                    <div key={pin.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 flex justify-between items-center group">
                                        <div className="flex items-center space-x-3">
                                            <div className={`w-3 h-3 rounded-full shadow-sm ${
                                                pin.printer?.status === 'ONLINE' ? 'bg-emerald-500' :
                                                pin.printer?.status === 'WARNING' ? 'bg-amber-500' :
                                                'bg-red-500'
                                            }`} />
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                                {pin.printer?.hostname || pin.printer?.ip_address}
                                            </span>
                                        </div>
                                        <button 
                                            onClick={() => pin.id && handleDeletePin(pin.id)}
                                            className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                                {pins.length === 0 && (
                                    <div className="p-8 text-center text-sm text-gray-500">ไม่มีปริ้นเตอร์บนแผนผังนี้</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Map Area */}
                <div className="lg:col-span-3">
                    {selectedMap ? (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden relative">
                            {/* Map Controls */}
                            <div className="absolute top-4 right-4 z-20 flex flex-col space-y-2">
                                <button onClick={() => setZoom(z => Math.min(5, z + 0.2))} className="bg-white dark:bg-gray-800 p-2 rounded-md shadow border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700" title="ซูมเข้า">
                                    <span className="text-xl font-bold text-gray-700 dark:text-gray-300 leading-none">+</span>
                                </button>
                                <button onClick={() => setZoom(z => Math.max(0.2, z - 0.2))} className="bg-white dark:bg-gray-800 p-2 rounded-md shadow border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700" title="ซูมออก">
                                    <span className="text-xl font-bold text-gray-700 dark:text-gray-300 leading-none">-</span>
                                </button>
                                <button onClick={() => { setZoom(1); setPan({x:0, y:0}); }} className="bg-white dark:bg-gray-800 p-2 text-xs font-medium rounded-md shadow border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300" title="รีเซ็ต">
                                    1:1
                                </button>
                            </div>
                            
                            <div 
                                ref={mapContainerRef}
                                className={`relative bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 overflow-hidden select-none ${isAddingPin ? 'cursor-crosshair' : (isPanning ? 'cursor-grabbing' : 'cursor-grab')}`}
                                style={{ minHeight: '600px' }}
                                onClick={handleMapClick}
                                onMouseDown={handlePanStart}
                                onMouseMove={handlePanMove}
                                onMouseUp={handlePanEnd}
                                onMouseLeave={handlePanEnd}
                            >
                                <div 
                                    ref={transformContainerRef}
                                    className="absolute origin-top-left w-full transition-transform duration-75 ease-out"
                                    style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
                                >
                                    {selectedMap.image_url && (
                                        <img 
                                            src={selectedMap.image_url.startsWith('http') ? selectedMap.image_url : `${apiUrl}${selectedMap.image_url}`}
                                            alt="Floor Map" 
                                            className="w-full h-auto pointer-events-none"
                                            style={{ display: 'block' }}
                                        />
                                    )}
                                    
                                    {pins.map((pin) => (
                                        <div
                                            key={pin.id}
                                            className={`absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-white shadow-md flex items-center justify-center ${draggingPinId === pin.id ? 'scale-125 opacity-80 cursor-grabbing z-50' : 'cursor-pointer hover:scale-110 z-10'} ${getPinColor(pin)} transition-transform group`}
                                            style={{ left: `${pin.x_percent}%`, top: `${pin.y_percent}%` }}
                                            onMouseDown={(e) => handlePinMouseDown(e, pin.id!)}
                                            onClick={(e) => handlePinClick(e, pin)}
                                        >
                                            <PrinterIcon size={12} className="text-white pointer-events-none" />
                                            {/* Tooltip */}
                                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-xs rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                                                <p className="font-bold border-b border-gray-700 pb-1 mb-1">{pin.printer?.hostname}</p>
                                                <p>{pin.printer?.ip_address}</p>
                                                <p className={`font-semibold mt-1 ${
                                                    pin.printer?.status === 'ONLINE' ? 'text-emerald-400' :
                                                    pin.printer?.status === 'WARNING' ? 'text-amber-400' :
                                                    'text-red-400'
                                                }`}>Status: {pin.printer?.status}</p>
                                                {pin.printer?.toner_level !== null && (
                                                    <p className="mt-1">Toner: {pin.printer?.toner_level}%</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 h-[600px] flex flex-col items-center justify-center text-gray-500 space-y-4">
                            <Map size={48} className="text-gray-300 dark:text-gray-600" />
                            <p>ยังไม่มีแผนผังอาคาร. อัพโหลดรูปภาพแปลนเพื่อเริ่มต้น</p>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Quick View Modal */}
            {selectedPinDetails && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden relative">
                        <button 
                            onClick={() => setSelectedPinDetails(null)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                            <X size={20} />
                        </button>
                        <div className="p-6">
                            <div className="flex items-center space-x-3 mb-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                    selectedPinDetails.status === 'ONLINE' ? 'bg-emerald-100 text-emerald-600' :
                                    selectedPinDetails.status === 'WARNING' ? 'bg-amber-100 text-amber-600' :
                                    'bg-red-100 text-red-600'
                                }`}>
                                    <PrinterIcon size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{selectedPinDetails.hostname}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{selectedPinDetails.ip_address}</p>
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                                    <span className="text-gray-500 dark:text-gray-400">สถานะ</span>
                                    <span className={`font-medium ${
                                        selectedPinDetails.status === 'ONLINE' ? 'text-emerald-600 dark:text-emerald-400' :
                                        selectedPinDetails.status === 'WARNING' ? 'text-amber-600 dark:text-amber-400' :
                                        'text-red-600 dark:text-red-400'
                                    }`}>{selectedPinDetails.status}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                                    <span className="text-gray-500 dark:text-gray-400">ระดับหมึก</span>
                                    <span className="font-medium text-gray-900 dark:text-white">
                                        {selectedPinDetails.toner_level !== null ? `${selectedPinDetails.toner_level}%` : 'N/A'}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="mt-6 flex justify-end">
                                <a 
                                    href={`/printers/${selectedPinDetails.id}`} 
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors"
                                >
                                    ดูรายละเอียดเต็ม
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
