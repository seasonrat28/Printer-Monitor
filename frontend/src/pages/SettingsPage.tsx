import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Save } from 'lucide-react';
import api from '../services/api';

export const SettingsPage = () => {
    const [config, setConfig] = useState({
        lineToken: '',
        teamsWebhook: '',
        smtpServer: '',
        smtpPort: '587',
        smtpUser: '',
        smtpPassword: '',
        smtpFrom: '',
        smtpTo: '',
        monitoringInterval: '60',
        snmpTimeout: '5',
        snmpRetries: '3',
        tonerWarningThreshold: '20',
        tonerCriticalThreshold: '10'
    });
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await api.get('/settings');
                setConfig(prev => ({ ...prev, ...res.data.settings }));
            } catch (err) {
                console.error("Failed to load settings", err);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setConfig({ ...config, [e.target.name]: e.target.value });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.put('/settings', { settings: config });
            alert("Settings saved successfully!");
        } catch (err) {
            alert("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8">Loading settings...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">System Settings</h2>
                <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
                    <Save size={16} /> {saving ? 'Saving...' : 'Save Configuration'}
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Monitoring & SNMP</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Monitoring Interval (sec)</label>
                                <Input name="monitoringInterval" value={config.monitoringInterval} onChange={handleChange} placeholder="60" type="number" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">SNMP Timeout (sec)</label>
                                <Input name="snmpTimeout" value={config.snmpTimeout} onChange={handleChange} placeholder="5" type="number" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">SNMP Retries</label>
                                <Input name="snmpRetries" value={config.snmpRetries} onChange={handleChange} placeholder="3" type="number" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Toner Warning (%)</label>
                                <Input name="tonerWarningThreshold" value={config.tonerWarningThreshold} onChange={handleChange} placeholder="20" type="number" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Toner Critical (%)</label>
                                <Input name="tonerCriticalThreshold" value={config.tonerCriticalThreshold} onChange={handleChange} placeholder="10" type="number" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Notifications & Alerts</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">LINE Notify Token</label>
                            <Input name="lineToken" value={config.lineToken || ''} onChange={handleChange} placeholder="Line token here" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">MS Teams Webhook URL</label>
                            <Input name="teamsWebhook" value={config.teamsWebhook || ''} onChange={handleChange} placeholder="https://..." />
                        </div>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>SMTP Email Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Server Address</label>
                                <Input name="smtpServer" value={config.smtpServer || ''} onChange={handleChange} placeholder="smtp.example.com" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Port</label>
                                <Input name="smtpPort" value={config.smtpPort || ''} onChange={handleChange} placeholder="587" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Username</label>
                                <Input name="smtpUser" value={config.smtpUser || ''} onChange={handleChange} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Password</label>
                                <Input type="password" name="smtpPassword" value={config.smtpPassword || ''} onChange={handleChange} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">From Email</label>
                                <Input name="smtpFrom" value={config.smtpFrom || ''} onChange={handleChange} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">To Email</label>
                                <Input name="smtpTo" value={config.smtpTo || ''} onChange={handleChange} />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
