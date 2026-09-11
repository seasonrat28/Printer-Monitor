import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Map, Upload, Trash2, Printer as PrinterIcon, Check, X } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';

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

    const mapContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (selectedMap) {
            fetchPins(selectedMap.id);
        }
    }, [selectedMap]);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const [mapsRes, printersRes] = await Promise.all([
                api.get('/floormaps'),
                api.get('/printers')
            ]);
            setMaps(mapsRes.data);
            setPrinters(printersRes.data);
            if (mapsRes.data.length > 0) {
                setSelectedMap(mapsRes.data[0]);
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
        if (!isAddingPin || !selectedPrinterToAdd || !selectedMap || !mapContainerRef.current) return;

        const rect = mapContainerRef.current.getBoundingClientRect();
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

    const handleDeletePin = async (e: React.MouseEvent, pinId: number) => {
        e.stopPropagation();
        if (!window.confirm("Delete this pin?")) return;
        
        try {
            await api.delete(`/floormaps/${selectedMap.id}/pins/${pinId}`);
            setPins(pins.filter(p => p.id !== pinId));
            addToast('success', 'Success', 'Pin deleted');
        } catch (err) {
            addToast('error', 'Error', 'Failed to delete pin');
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

                    <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md flex items-center space-x-2 transition-colors">
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
                        <CardContent className="p-4">
                            {isAddingPin ? (
                                <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 p-4 rounded-lg text-sm flex flex-col space-y-3">
                                    <p>คลิกที่แผนผังอาคารเพื่อวางหมุดปริ้นเตอร์: <strong>{printers.find(p => p.id === selectedPrinterToAdd)?.hostname}</strong></p>
                                    <Button onClick={() => setIsAddingPin(false)} variant="outline" className="w-full bg-white text-gray-700">ยกเลิก</Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <select 
                                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-sm"
                                        value={selectedPrinterToAdd || ''}
                                        onChange={(e) => setSelectedPrinterToAdd(parseInt(e.target.value))}
                                    >
                                        <option value="">-- เลือกปริ้นเตอร์ --</option>
                                        {printers.map(p => {
                                            const isPinned = pins.some(pin => pin.printer_id === p.id);
                                            return (
                                                <option key={p.id} value={p.id} disabled={isPinned}>
                                                    {p.hostname || p.ip_address} {isPinned ? '(Pinned)' : ''}
                                                </option>
                                            );
                                        })}
                                    </select>
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
                                            onClick={(e) => pin.id && handleDeletePin(e, pin.id)}
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
                    <Card className="h-[600px] overflow-hidden flex flex-col">
                        {selectedMap ? (
                            <div 
                                className={`relative flex-1 bg-gray-100 dark:bg-gray-900 overflow-hidden ${isAddingPin ? 'cursor-crosshair' : ''}`}
                                ref={mapContainerRef}
                                onClick={handleMapClick}
                            >
                                <img 
                                    src={`${apiUrl}${selectedMap.image_url}`} 
                                    alt="Floor Map"
                                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                                    crossOrigin="anonymous"
                                />
                                
                                {/* Render Pins */}
                                {pins.map(pin => (
                                    <div 
                                        key={pin.id}
                                        className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                                        style={{ left: `${pin.x_percent}%`, top: `${pin.y_percent}%` }}
                                    >
                                        <div className={`w-8 h-8 rounded-full shadow-lg border-2 border-white flex items-center justify-center transition-transform hover:scale-110 ${
                                            pin.printer?.status === 'ONLINE' ? 'bg-emerald-500' :
                                            pin.printer?.status === 'WARNING' ? 'bg-amber-500' :
                                            'bg-red-500'
                                        }`}>
                                            <PrinterIcon size={16} className="text-white" />
                                        </div>
                                        
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
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 space-y-4">
                                <Map size={48} className="text-gray-300 dark:text-gray-600" />
                                <p>ยังไม่มีแผนผังอาคาร. อัพโหลดรูปภาพแปลนเพื่อเริ่มต้น</p>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
};
