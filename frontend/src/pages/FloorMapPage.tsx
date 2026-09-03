import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';

// Printer type for the map
interface PrinterPin {
    id: number;
    ip_address: string;
    model: string;
    status: string;
    x: number; // percent
    y: number; // percent
}

const STATUS_COLOR: Record<string, string> = {
    ONLINE: '#22c55e',
    OFFLINE: '#ef4444',
    WARNING: '#f59e0b',
    ERROR: '#ef4444',
    UNKNOWN: '#94a3b8',
};

const SAMPLE_PRINTERS: PrinterPin[] = [
    { id: 1, ip_address: '10.119.43.10', model: 'Brother MFC-L8900CDW', status: 'ONLINE', x: 20, y: 30 },
    { id: 2, ip_address: '10.119.43.11', model: 'HP LaserJet Pro', status: 'OFFLINE', x: 55, y: 20 },
    { id: 3, ip_address: '10.119.34.20', model: 'Canon ImageCLASS', status: 'WARNING', x: 75, y: 65 },
    { id: 4, ip_address: '10.119.34.21', model: 'Brother HL-L2375DW', status: 'ONLINE', x: 35, y: 70 },
];

export const FloorMapPage = () => {
    const [printers] = useState<PrinterPin[]>(SAMPLE_PRINTERS);
    const [hovered, setHovered] = useState<PrinterPin | null>(null);
    const [tooltip, setTooltip] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e: React.MouseEvent, printer: PrinterPin) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setTooltip({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top + 12 });
        setHovered(printer);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">Floor Plan Map</h2>
                <div className="flex items-center gap-4 text-sm">
                    {Object.entries(STATUS_COLOR).map(([status, color]) => (
                        <span key={status} className="flex items-center gap-1">
                            <span className="inline-block w-3 h-3 rounded-full" style={{ background: color }}></span>
                            {status}
                        </span>
                    ))}
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Office Floor Plan — All Floors</CardTitle>
                </CardHeader>
                <CardContent>
                    <div
                        className="relative w-full bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden"
                        style={{ height: '520px' }}
                        onMouseLeave={() => setHovered(null)}
                    >
                        {/* Grid lines to simulate floor plan */}
                        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(100,116,139,0.15)" strokeWidth="1"/>
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#grid)" />
                            {/* Room outlines */}
                            <rect x="5%" y="5%" width="40%" height="40%" rx="4" fill="none" stroke="rgba(100,116,139,0.4)" strokeWidth="1.5" strokeDasharray="6 3"/>
                            <rect x="50%" y="5%" width="45%" height="30%" rx="4" fill="none" stroke="rgba(100,116,139,0.4)" strokeWidth="1.5" strokeDasharray="6 3"/>
                            <rect x="5%" y="50%" width="40%" height="45%" rx="4" fill="none" stroke="rgba(100,116,139,0.4)" strokeWidth="1.5" strokeDasharray="6 3"/>
                            <rect x="50%" y="40%" width="45%" height="55%" rx="4" fill="none" stroke="rgba(100,116,139,0.4)" strokeWidth="1.5" strokeDasharray="6 3"/>
                            {/* Room labels */}
                            <text x="7%" y="12%" fill="rgba(100,116,139,0.7)" fontSize="11" fontFamily="Inter, sans-serif">IT Department</text>
                            <text x="52%" y="12%" fill="rgba(100,116,139,0.7)" fontSize="11" fontFamily="Inter, sans-serif">Conference Room A</text>
                            <text x="7%" y="57%" fill="rgba(100,116,139,0.7)" fontSize="11" fontFamily="Inter, sans-serif">HR / Finance</text>
                            <text x="52%" y="47%" fill="rgba(100,116,139,0.7)" fontSize="11" fontFamily="Inter, sans-serif">Operations</text>
                        </svg>

                        {/* Printer Pins */}
                        {printers.map((printer) => (
                            <div
                                key={printer.id}
                                className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-125"
                                style={{ left: `${printer.x}%`, top: `${printer.y}%` }}
                                onMouseMove={(e) => handleMouseMove(e, printer)}
                            >
                                <div className="relative">
                                    {/* Pulse ring for online printers */}
                                    {printer.status === 'ONLINE' && (
                                        <span className="absolute inset-0 rounded-full animate-ping opacity-60"
                                            style={{ background: STATUS_COLOR[printer.status] }}></span>
                                    )}
                                    <div
                                        className="relative w-5 h-5 rounded-full border-2 border-white shadow-lg"
                                        style={{ background: STATUS_COLOR[printer.status] || '#94a3b8' }}
                                    />
                                </div>
                            </div>
                        ))}

                        {/* Tooltip */}
                        {hovered && (
                            <div
                                className="absolute z-10 bg-gray-900 text-white rounded-lg p-3 text-sm shadow-xl pointer-events-none"
                                style={{ left: tooltip.x, top: tooltip.y, maxWidth: 200 }}
                            >
                                <p className="font-bold">{hovered.ip_address}</p>
                                <p className="text-gray-300 text-xs">{hovered.model}</p>
                                <p className="mt-1 flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: STATUS_COLOR[hovered.status] }}></span>
                                    {hovered.status}
                                </p>
                            </div>
                        )}
                    </div>
                    <p className="text-xs text-gray-400 mt-3 text-center">
                        Hover over a pin to see printer details. Pin positions can be adjusted from the Printers management page.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};
