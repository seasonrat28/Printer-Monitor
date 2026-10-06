import { ServerCrash } from 'lucide-react';

export const OfflinePage = () => {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-[#111827]">
      <div className="text-center max-w-md p-8 bg-white dark:bg-[#1A1D20] rounded-2xl shadow-2xl border border-red-500/20">
        <div className="relative mx-auto w-24 h-24 mb-6">
          <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping"></div>
          <div className="relative flex items-center justify-center w-full h-full bg-red-500/10 rounded-full border border-red-500/30">
            <ServerCrash size={40} className="text-red-500" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Server Offline</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8">
          Cannot connect to the backend server. The services might be starting up or currently unavailable.
        </p>
        <button 
          onClick={() => window.location.href = '/'} 
          className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
        >
          Try Again
        </button>
      </div>
    </div>
  );
};
