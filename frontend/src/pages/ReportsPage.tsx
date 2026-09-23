import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Download, FileText, FileSpreadsheet, Clock, RefreshCw } from 'lucide-react';
import { MetricGrid } from '../components/MetricGrid';
import { printerService } from '../services/api';
import api from '../services/api';
import { useWebSocket } from '../contexts/WebSocketContext';

export const ReportsPage = () => {
    const [summary, setSummary] = useState<any>({
        status_summary: { total: 0, online: 0, offline: 0, warning: 0 },
        metrics: { active_alerts: 0, critical_alerts: 0, pages_printed: 0, low_toner_printers: 0, avg_response: 'N/A' },
    });
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [downloading, setDownloading] = useState<'pdf' | 'excel' | 'image' | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [secondsAgo, setSecondsAgo] = useState(0);
    const { lastEvent } = useWebSocket();

    // Debounced fetch — max 1 call per 3 seconds
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastFetchRef = useRef<number>(0);

    const fetchSummary = useCallback(async () => {
        try {
            const res = await printerService.getDashboardSummary();
            setSummary(res.data);
            setLastUpdated(new Date());
            lastFetchRef.current = Date.now();
        } catch (err) {
            console.error('Failed to load report summary', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const debouncedFetch = useCallback(() => {
        const cooldown = 3000;
        const now = Date.now();
        if (timerRef.current) clearTimeout(timerRef.current);
        const remaining = cooldown - (now - lastFetchRef.current);
        if (remaining <= 0) {
            fetchSummary();
        } else {
            timerRef.current = setTimeout(fetchSummary, remaining);
        }
    }, [fetchSummary]);

    // Initial load
    useEffect(() => { fetchSummary(); }, [fetchSummary]);

    // Auto-refresh every 60s
    useEffect(() => {
        const interval = setInterval(fetchSummary, 60_000);
        return () => clearInterval(interval);
    }, [fetchSummary]);

    // WebSocket-driven refresh
    useEffect(() => {
        if (lastEvent) debouncedFetch();
    }, [lastEvent, debouncedFetch]);

    // Live "X seconds ago" counter
    useEffect(() => {
        const tick = setInterval(() => {
            if (lastUpdated) setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
        }, 1000);
        return () => clearInterval(tick);
    }, [lastUpdated]);

    const handleSyncNow = async () => {
        if (syncing) return;
        setSyncing(true);
        try {
            await api.post('/printers/sync');
            await fetchSummary();
        } catch (err) {
            console.error('Sync failed', err);
        } finally {
            setSyncing(false);
        }
    };

    const formatSecondsAgo = (secs: number) => {
        if (secs < 5)  return 'just now';
        if (secs < 60) return `${secs}s ago`;
        return `${Math.floor(secs / 60)}m ago`;
    };

    const download = async (endpoint: 'pdf' | 'excel' | 'image') => {
        if (downloading) return;
        setDownloading(endpoint);
        try {
            const response = await api.get(`/reports/${endpoint}`, { responseType: 'blob' });
            let blob = response.data as Blob;
            if (blob.size === 0) throw new Error('The report file is empty.');

            if (endpoint === 'image') {
                const svgUrl = URL.createObjectURL(blob);
                try {
                    const image = new Image();
                    image.src = svgUrl;
                    await new Promise<void>((resolve, reject) => {
                        image.onload = () => resolve();
                        image.onerror = () => reject(new Error('ไม่สามารถสร้างภาพรายงานได้'));
                    });

                    const canvas = document.createElement('canvas');
                    canvas.width = image.naturalWidth;
                    canvas.height = image.naturalHeight;
                    const context = canvas.getContext('2d');
                    if (!context) throw new Error('Browser ไม่รองรับการสร้างภาพ');
                    context.fillStyle = '#ffffff';
                    context.fillRect(0, 0, canvas.width, canvas.height);
                    context.drawImage(image, 0, 0);
                    blob = await new Promise<Blob>((resolve, reject) => {
                        canvas.toBlob(result => result ? resolve(result) : reject(new Error('ไม่สามารถบันทึก PNG ได้')), 'image/png');
                    });
                } finally {
                    URL.revokeObjectURL(svgUrl);
                }
            }

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = endpoint === 'excel'
                ? `printers_${new Date().toISOString().slice(0, 10)}.xlsx`
                : endpoint === 'image'
                    ? `printers_${new Date().toISOString().slice(0, 10)}.png`
                    : `printers_${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) {
            console.error('Report download failed', error);
            const message = error instanceof Error ? error.message : 'ไม่สามารถบันทึกรายงานได้';
            alert(`ไม่สามารถบันทึกรายงานได้\n${message}`);
        } finally {
            setDownloading(null);
        }
    };

    const { total, online, offline } = summary.status_summary;
    const metrics = summary.metrics || {};

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center bg-white dark:bg-gray-800/40 backdrop-blur-sm p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700/50">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-gray-800 dark:text-gray-200">Reports & Analytics</h2>
                    {lastUpdated && (
                        <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                            <Clock size={10} />
                            Updated {formatSecondsAgo(secondsAgo)}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSyncNow}
                        disabled={syncing}
                        title="Sync all printers now"
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border transition-all
                            ${syncing
                                ? 'bg-indigo-50 text-indigo-400 border-indigo-200 cursor-not-allowed'
                                : 'bg-white text-indigo-600 border-indigo-300 hover:bg-indigo-50 hover:border-indigo-400 active:scale-95'}`}
                    >
                        <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? 'Syncing...' : 'Sync Now'}
                    </button>
                </div>
            </div>

            {/* Metric Grid — same component as Dashboard & Printers */}
            {loading ? (
                <div className="text-gray-400 text-sm animate-pulse">Loading statistics…</div>
            ) : (
                <MetricGrid
                    total={total}
                    online={online}
                    activeAlerts={metrics.active_alerts ?? 0}
                    criticalAlerts={metrics.critical_alerts ?? 0}
                    offline={offline}
                    pagesPrinted={metrics.pages_printed ?? 0}
                    lowToner={metrics.low_toner_printers ?? 0}
                    avgResponse={metrics.avg_response ?? 'N/A'}
                />
            )}

            {/* Export Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileSpreadsheet className="text-green-600" size={20} />
                            Excel Export
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Multi-sheet workbook including:
                        </p>
                        <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc list-inside space-y-1">
                            <li>Printer Inventory (status, counters)</li>
                            <li>Supplies & Toner Levels</li>
                            <li>Active Alerts</li>
                        </ul>
                        <Button
                            onClick={() => download('excel')}
                            disabled={downloading !== null}
                            className="w-full mt-2 bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
                        >
                            <Download size={16} /> {downloading === 'excel' ? 'กำลังสร้างรายงาน...' : 'Download Excel (.xlsx)'}
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="text-red-600" size={20} />
                            PDF Export
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Formatted PDF report including:
                        </p>
                        <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc list-inside space-y-1">
                            <li>Full printer table with status color coding</li>
                            <li>Active alerts section</li>
                            <li>Timestamp and report metadata</li>
                        </ul>
                        <Button
                            onClick={() => download('pdf')}
                            disabled={downloading !== null}
                            className="w-full mt-2 bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2"
                        >
                            <Download size={16} /> {downloading === 'pdf' ? 'กำลังสร้างรายงาน...' : 'Download PDF'}
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="text-sky-600" size={20} />
                            Image Export
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Image report with the same inventory table as PDF.
                        </p>
                        <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc list-inside space-y-1">
                            <li>Status and Last Seen</li>
                            <li>Toner, Drum and Fuser %</li>
                            <li>PNG image matching the PDF layout</li>
                        </ul>
                        <Button
                            onClick={() => download('image')}
                            disabled={downloading !== null}
                            className="w-full mt-2 bg-sky-600 hover:bg-sky-700 text-white flex items-center justify-center gap-2"
                        >
                            <Download size={16} /> {downloading === 'image' ? 'กำลังสร้างรูปภาพ...' : 'Download Image (.png)'}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
