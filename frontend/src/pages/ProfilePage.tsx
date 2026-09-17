import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Phone, Briefcase, Shield } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../components/ui/card';
import api from '../services/api';

export const ProfilePage = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);

    const [profileDetails, setProfileDetails] = useState({
        fullName: 'Loading...',
        position: 'Loading...',
        affiliation: 'Loading...',
        email: 'Loading...',
        phone: 'Loading...',
        location: 'Loading...'
    });

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await api.get('/users/me');
                const data = res.data;
                setProfileDetails({
                    fullName: data.display_name || data.username,
                    position: data.position || 'Not specified',
                    affiliation: data.affiliation || 'Not specified',
                    email: data.email || 'Not specified',
                    phone: data.phone || 'Not specified',
                    location: data.location || 'Not specified'
                });
            } catch (error) {
                console.error("Failed to fetch profile", error);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    return (
        <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <User className="text-indigo-500" />
                Profile
            </h2>

            {/* Profile Header Card */}
            <Card className="bg-white/70 dark:bg-[#1e1b4b]/40 backdrop-blur-md border-indigo-100 dark:border-indigo-900/50 overflow-hidden shadow-lg">
                <div className="p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-4xl font-bold shadow-xl shadow-indigo-500/20 shrink-0">
                            {user?.username?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-bold text-slate-800 dark:text-white uppercase">
                                {profileDetails.fullName}
                            </h3>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                                <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                                    <Briefcase size={16} className="text-indigo-400" />
                                    {profileDetails.position}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Phone size={16} className="text-sky-400" />
                                    Contact phone not specified
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Mail size={16} className="text-purple-400" />
                                    Email not specified
                                </span>
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Role</span>
                                <span className="text-[10px] px-2 py-1 rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-medium uppercase tracking-wider">
                                    {user?.role || 'VIEWER'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex px-8 border-t border-slate-200 dark:border-indigo-900/40 bg-slate-50/50 dark:bg-black/10">
                    {['Overview', 'Teams', 'Role', 'Approve Relation', 'Logs'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab.toLowerCase())}
                            className={`px-6 py-4 text-sm font-medium transition-colors relative ${
                                activeTab === tab.toLowerCase() 
                                    ? 'text-indigo-600 dark:text-indigo-400' 
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                            }`}
                        >
                            {tab}
                            {activeTab === tab.toLowerCase() && (
                                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 rounded-t-full shadow-[0_-2px_8px_rgba(99,102,241,0.5)]" />
                            )}
                        </button>
                    ))}
                </div>
            </Card>

            {/* Profile Details Content */}
            {activeTab === 'overview' && (
                <Card className="bg-white/70 dark:bg-[#1e1b4b]/40 backdrop-blur-md border-indigo-100 dark:border-indigo-900/50 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <CardHeader className="border-b border-slate-100 dark:border-indigo-900/30 pb-4 bg-slate-50/50 dark:bg-black/10">
                        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-sm tracking-wide">
                            <User size={18} />
                            Profile Details
                        </div>
                    </CardHeader>
                    <CardContent className="p-8">
                        <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-y-6 gap-x-4 text-sm">
                            <div className="text-slate-500 dark:text-slate-400">Full Name</div>
                            <div className="text-slate-900 dark:text-slate-200 font-semibold uppercase">{profileDetails.fullName}</div>

                            <div className="text-slate-500 dark:text-slate-400">Position</div>
                            <div className="text-slate-900 dark:text-slate-200 font-medium text-indigo-600 dark:text-indigo-400">{profileDetails.position}</div>

                            <div className="text-slate-500 dark:text-slate-400">Affiliation details</div>
                            <div className="text-slate-900 dark:text-slate-200">{profileDetails.affiliation}</div>

                            <div className="text-slate-500 dark:text-slate-400">Email</div>
                            <div className="text-slate-900 dark:text-slate-200">{profileDetails.email}</div>

                            <div className="text-slate-500 dark:text-slate-400">Contact Phone</div>
                            <div className="text-slate-900 dark:text-slate-200">{profileDetails.phone}</div>

                            <div className="text-slate-500 dark:text-slate-400">Location Detail</div>
                            <div className="text-slate-900 dark:text-slate-200">{profileDetails.location}</div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {activeTab === 'teams' && (
                <Card className="bg-white/70 dark:bg-[#1e1b4b]/40 backdrop-blur-md border-indigo-100 dark:border-indigo-900/50 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <CardHeader className="border-b border-slate-100 dark:border-indigo-900/30 pb-4 bg-slate-50/50 dark:bg-black/10">
                        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-sm tracking-wide">
                            <User size={18} />
                            The group of staff members of which I am a member.
                        </div>
                    </CardHeader>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50/50 dark:bg-white/5 border-b border-slate-200 dark:border-indigo-900/40">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Group Name</th>
                                    <th className="px-6 py-4 font-semibold">Description</th>
                                    <th className="px-6 py-4 font-semibold">Member Total</th>
                                    <th className="px-6 py-4 font-semibold">Incident Total</th>
                                    <th className="px-6 py-4 font-semibold">Request Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-indigo-900/30">
                                <tr className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-200">IT Support PLK</td>
                                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">IT Support Paolo Kaset</td>
                                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">0</td>
                                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">9653</td>
                                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">0</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {activeTab === 'role' && (
                <Card className="bg-white/70 dark:bg-[#1e1b4b]/40 backdrop-blur-md border-indigo-100 dark:border-indigo-900/50 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50/50 dark:bg-white/5 border-b border-slate-200 dark:border-indigo-900/40">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Name</th>
                                    <th className="px-6 py-4 font-semibold">Technician Allowed to ...</th>
                                    <th className="px-6 py-4 font-semibold">Role</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-indigo-900/30">
                                <tr className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-200">System Access</td>
                                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">All allowed permissions</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 text-[10px] font-semibold rounded uppercase border
                                            ${user?.role === 'ADMIN' ? 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30' :
                                              user?.role === 'ENGINEER' ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30' :
                                              user?.role === 'OPERATOR' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30' :
                                              'bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/30'}`}>
                                            {user?.role || 'Unassigned'}
                                        </span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {activeTab === 'approve relation' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Card className="bg-white/70 dark:bg-[#1e1b4b]/40 backdrop-blur-md border-indigo-100 dark:border-indigo-900/50 shadow-lg">
                        <CardHeader className="border-b border-slate-100 dark:border-indigo-900/30 pb-4 bg-slate-50/50 dark:bg-black/10">
                            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-sm tracking-wide">
                                <User size={18} />
                                The group of approvers who do not have the authority to approve my work.
                            </div>
                        </CardHeader>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50/50 dark:bg-white/5 border-b border-slate-200 dark:border-indigo-900/40">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold">Group Name</th>
                                        <th className="px-6 py-4 font-semibold">Description</th>
                                        <th className="px-6 py-4 font-semibold">Relation</th>
                                        <th className="px-6 py-4 font-semibold">Member Total</th>
                                        <th className="px-6 py-4 font-semibold">Member</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-indigo-900/30">
                                    <tr className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-200">อนุมัติการติดตั้งโปรแกรม</td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400"></td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 text-[11px] rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/20">
                                                manager
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">1</td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 text-[11px] rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium border border-sky-500/20">
                                                {user?.username}
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    <Card className="bg-white/70 dark:bg-[#1e1b4b]/40 backdrop-blur-md border-indigo-100 dark:border-indigo-900/50 shadow-lg">
                        <CardHeader className="border-b border-slate-100 dark:border-indigo-900/30 pb-4 bg-slate-50/50 dark:bg-black/10">
                            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-sm tracking-wide">
                                <User size={18} />
                                The group of approvers of which I am a member.
                            </div>
                        </CardHeader>
                        <div className="p-12 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                            <Shield size={32} className="mb-3 opacity-20" />
                            <p>No Data</p>
                        </div>
                    </Card>
                </div>
            )}

            {activeTab === 'logs' && (
                <Card className="bg-white/70 dark:bg-[#1e1b4b]/40 backdrop-blur-md border-indigo-100 dark:border-indigo-900/50 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50/50 dark:bg-white/5 border-b border-slate-200 dark:border-indigo-900/40">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Message</th>
                                    <th className="px-6 py-4 font-semibold">Type</th>
                                    <th className="px-6 py-4 font-semibold">Category</th>
                                    <th className="px-6 py-4 font-semibold">Command</th>
                                    <th className="px-6 py-4 font-semibold">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-indigo-900/30">
                                {[...Array(8)].map((_, i) => (
                                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-3 font-medium text-slate-700 dark:text-slate-300 text-xs font-mono">
                                            ::ffff:10.197.11.198 connected, User: {user?.username}
                                        </td>
                                        <td className="px-6 py-3 text-slate-500 dark:text-slate-400">STATUS</td>
                                        <td className="px-6 py-3 text-slate-500 dark:text-slate-400">WEBSETTING</td>
                                        <td className="px-6 py-3 text-slate-500 dark:text-slate-400">WEBLOGON</td>
                                        <td className="px-6 py-3 text-slate-500 dark:text-slate-400 text-xs">
                                            {new Date(Date.now() - i * 3600000).toLocaleString('en-GB')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
};
