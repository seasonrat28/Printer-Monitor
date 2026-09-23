import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Phone, Briefcase, Shield } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../components/ui/card';
import api from '../services/api';

export const ProfilePage = () => {
    const { user } = useAuth();
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
                                    {profileDetails.phone !== 'Not specified' ? profileDetails.phone : 'Contact phone not specified'}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Mail size={16} className="text-purple-400" />
                                    {profileDetails.email !== 'Not specified' ? profileDetails.email : 'Email not specified'}
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

                <div className="border-t border-slate-100 dark:border-indigo-900/30 p-8 bg-slate-50/50 dark:bg-black/10">
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-sm tracking-wide mb-6">
                        <User size={18} />
                        Profile Details
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-y-6 gap-x-4 text-sm">
                        <div className="text-slate-500 dark:text-slate-400">Full Name</div>
                        <div className="text-slate-900 dark:text-slate-200 font-semibold uppercase">{profileDetails.fullName}</div>

                        <div className="text-slate-500 dark:text-slate-400">Position</div>
                        <div className="text-slate-900 dark:text-slate-200 font-medium text-indigo-600 dark:text-indigo-400">{profileDetails.position}</div>

                        <div className="text-slate-500 dark:text-slate-400">Affiliation</div>
                        <div className="text-slate-900 dark:text-slate-200">{profileDetails.affiliation}</div>

                        <div className="text-slate-500 dark:text-slate-400">Email</div>
                        <div className="text-slate-900 dark:text-slate-200">{profileDetails.email}</div>

                        <div className="text-slate-500 dark:text-slate-400">Contact Phone</div>
                        <div className="text-slate-900 dark:text-slate-200">{profileDetails.phone}</div>

                        <div className="text-slate-500 dark:text-slate-400">Location</div>
                        <div className="text-slate-900 dark:text-slate-200">{profileDetails.location}</div>
                    </div>
                </div>
            </Card>
        </div>
    );
};
