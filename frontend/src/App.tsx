import { BrowserRouter as Router, Routes, Route, Navigate, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import PrintersList from './pages/PrintersList';
import { SettingsPage } from './pages/SettingsPage';
import { ReportsPage } from './pages/ReportsPage';
import { FloorMapPage } from './pages/FloorMapPage';
import { GroupsPage } from './pages/GroupsPage';
import { SmartFiltersPage } from './pages/SmartFiltersPage';
import { UsersPage } from './pages/UsersPage';
import AlertsPage from './pages/AlertsPage';
import SystemLogs from './pages/SystemLogs';
import { ProfilePage } from './pages/ProfilePage';
import { InventoryPage } from './pages/InventoryPage';
import { OfflinePage } from './pages/OfflinePage';
import { LayoutDashboard, Printer, Settings, LogOut, FileText, Map, Shield, Terminal, Filter, Layers, Wrench, Bell, ChevronLeft, ChevronRight, Power, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ToastProvider } from './contexts/ToastContext';
import { Toaster } from 'react-hot-toast';
import { CommandPalette } from './components/CommandPalette';

const MainLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Persist dark mode across refreshes
  useEffect(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved === 'true') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', String(isDark));
  };

  const handleLogout = () => {
    sessionStorage.removeItem('hasSynced');
    logout();
    navigate('/login');
  };

  // No blocking screen, let the initial sync happen in the background

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 dark:bg-[#121212] text-slate-900 dark:text-slate-100 transition-all duration-700 ease-in-out">
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Spacer for collapsed sidebar */}
        <div className={`shrink-0 hidden sm:block bg-slate-50 dark:bg-[#121212] transition-all duration-300 ease-in-out z-0 ${isSidebarExpanded ? 'w-[280px]' : 'w-20'}`}></div>

        {/* Sidebar */}
        <aside className={`absolute left-0 top-0 h-full z-40 shrink-0 bg-white dark:bg-[#1A1D20] border-r border-slate-200 dark:border-slate-800 shadow-[2px_0_24px_rgba(0,0,0,0.02)] dark:shadow-none flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${isSidebarExpanded ? 'w-[280px]' : 'w-20'}`}>
          {/* Logo Section */}
          <div className="h-20 flex items-center px-6 shrink-0 whitespace-nowrap overflow-hidden">
            <div className="flex items-center gap-3 relative">
              <Printer className="w-8 h-8 shrink-0 text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
              <div className={`flex flex-col transition-opacity duration-300 ${isSidebarExpanded ? 'opacity-100' : 'opacity-0 hidden'}`}>
                 <h1 className="text-xl font-bold tracking-tight text-[#1A1D20] dark:text-white leading-none mt-1">BRAdmin <span className="font-light text-slate-500">Next</span></h1>
              </div>
            </div>
          </div>
          
          {/* Toggle Button */}
          <button 
            onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
            className="absolute -right-3 top-20 bg-white dark:bg-[#2A2D30] text-slate-500 dark:text-slate-400 p-1 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.1)] hover:text-blue-600 dark:hover:text-blue-400 transition-colors z-50 border border-slate-200 dark:border-slate-700 hidden sm:block"
          >
            {isSidebarExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
          
          {/* Navigation */}
          <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden relative px-4 space-y-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
            {/* Group 1: NAVIGATION */}
            <div className="space-y-1">
              <p className={`pl-4 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 transition-opacity duration-300 whitespace-nowrap ${isSidebarExpanded ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden pb-0'}`}>Navigation</p>
              {[
                { to: "/", icon: LayoutDashboard, label: "Dashboard", exact: true },
                { to: "/printers", icon: Printer, label: "Printers" },
                { to: "/alerts", icon: Bell, label: "Alerts", badge: 7 },
                { to: "/map", icon: Map, label: "Floor Map" },
              ].map(item => (
                <div key={item.to} className="relative group/navitem">
                  <NavLink title={!isSidebarExpanded ? item.label : undefined} to={item.to} end={item.exact} className={({ isActive }) => `flex items-center w-full pl-[14px] pr-[14px] py-3 rounded-xl overflow-hidden transition-colors duration-200 whitespace-nowrap ${isActive ? 'bg-blue-50/80 text-blue-700 font-semibold dark:bg-blue-900/30 dark:text-blue-300' : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#2A2D30] dark:hover:text-slate-200'}`}>
                    <item.icon size={20} className="shrink-0" strokeWidth={2} />
                    <span className={`ml-3 transition-opacity duration-300 ${isSidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>{item.label}</span>
                    {item.badge && (
                      <span className={`ml-auto flex h-5 items-center justify-center rounded-full bg-red-100 px-2 text-[10px] font-bold text-red-600 dark:bg-red-500/20 dark:text-red-400 transition-opacity duration-300 ${isSidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                </div>
              ))}
            </div>

            {/* Group 2: MANAGEMENT & LOGS */}
            <div className="space-y-1">
              <p className={`pl-4 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 transition-opacity duration-300 whitespace-nowrap ${isSidebarExpanded ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden pb-0'}`}>Management & Logs</p>
              {[
                { to: "/groups", icon: Layers, label: "Groups" },
                { to: "/inventory", icon: Wrench, label: "Inventory" },
                { to: "/reports", icon: FileText, label: "Reports" },
              ].map(item => (
                <div key={item.to} className="relative group/navitem">
                  <NavLink title={!isSidebarExpanded ? item.label : undefined} to={item.to} className={({ isActive }) => `flex items-center w-full pl-[14px] pr-[14px] py-3 rounded-xl overflow-hidden transition-colors duration-200 whitespace-nowrap ${isActive ? 'bg-blue-50/80 text-blue-700 font-semibold dark:bg-blue-900/30 dark:text-blue-300' : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#2A2D30] dark:hover:text-slate-200'}`}>
                    <item.icon size={20} className="shrink-0" strokeWidth={2} />
                    <span className={`ml-3 transition-opacity duration-300 ${isSidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>{item.label}</span>
                  </NavLink>
                </div>
              ))}
              
              {user?.role === 'ADMIN' && (
                <>
                  <div className="relative group/navitem">
                    <NavLink title={!isSidebarExpanded ? "Users" : undefined} to="/users" className={({ isActive }) => `flex items-center w-full pl-[14px] pr-[14px] py-3 rounded-xl overflow-hidden transition-colors duration-200 whitespace-nowrap ${isActive ? 'bg-blue-50/80 text-blue-700 font-semibold dark:bg-blue-900/30 dark:text-blue-300' : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#2A2D30] dark:hover:text-slate-200'}`}>
                      <Shield size={20} className="shrink-0" strokeWidth={2} />
                      <span className={`ml-3 transition-opacity duration-300 ${isSidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>Users</span>
                    </NavLink>
                  </div>
                  <div className="relative group/navitem">
                    <NavLink title={!isSidebarExpanded ? "System Logs" : undefined} to="/logs" className={({ isActive }) => `flex items-center w-full pl-[14px] pr-[14px] py-3 rounded-xl overflow-hidden transition-colors duration-200 whitespace-nowrap ${isActive ? 'bg-blue-50/80 text-blue-700 font-semibold dark:bg-blue-900/30 dark:text-blue-300' : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#2A2D30] dark:hover:text-slate-200'}`}>
                      <Terminal size={20} className="shrink-0" strokeWidth={2} />
                      <span className={`ml-3 transition-opacity duration-300 ${isSidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>System Logs</span>
                    </NavLink>
                  </div>
                </>
              )}
            </div>

            {/* Group 3: CONFIGURATION */}
            <div className="space-y-1">
              <p className={`pl-4 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 transition-opacity duration-300 whitespace-nowrap ${isSidebarExpanded ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden pb-0'}`}>Configuration</p>
              {[
                { to: "/smart-filters", icon: Filter, label: "Smart Filters" },
                { to: "/settings", icon: Settings, label: "Settings" },
              ].map(item => (
                <div key={item.to} className="relative group/navitem">
                  <NavLink title={!isSidebarExpanded ? item.label : undefined} to={item.to} className={({ isActive }) => `flex items-center w-full pl-[14px] pr-[14px] py-3 rounded-xl overflow-hidden transition-colors duration-200 whitespace-nowrap ${isActive ? 'bg-blue-50/80 text-blue-700 font-semibold dark:bg-blue-900/30 dark:text-blue-300' : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#2A2D30] dark:hover:text-slate-200'}`}>
                    <item.icon size={20} className="shrink-0" strokeWidth={2} />
                    <span className={`ml-3 transition-opacity duration-300 ${isSidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>{item.label}</span>
                  </NavLink>
                </div>
              ))}
            </div>
          </nav>

          {/* Gradient Info Card & Footer Components */}
          <div className={`shrink-0 whitespace-nowrap overflow-hidden flex flex-col gap-4 ${isSidebarExpanded ? 'p-4' : 'py-4 px-0'}`}>
            
            {/* Gradient Card (REMOVED) */}

            {/* User Profile & Theme Toggle */}
            <div className={`flex items-center justify-between ${isSidebarExpanded ? '' : 'flex-col gap-4'}`}>
              <Link to="/profile" className={`flex items-center overflow-hidden group/profile hover:bg-slate-50 dark:hover:bg-[#2A2D30] rounded-xl transition-colors cursor-pointer ${isSidebarExpanded ? 'gap-3 p-2 flex-1' : 'w-11 h-11 mx-auto justify-center'}`}>
                <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 flex items-center justify-center font-bold text-sm shrink-0 border border-blue-200 dark:border-blue-800 transition-colors">
                  {user?.username?.[0]?.toUpperCase() || 'U'}
                </div>
                {isSidebarExpanded && (
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="text-sm font-semibold text-[#1A1D20] dark:text-white truncate">{user?.username || 'Administrator'}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider truncate">
                      {user?.role || 'ADMIN'}
                    </p>
                  </div>
                )}
              </Link>
              
              <div className={`flex items-center gap-1 ${isSidebarExpanded ? '' : 'flex-col'}`}>
                <button 
                  onClick={toggleDarkMode}
                  className={`text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors rounded-full hover:bg-amber-50 dark:hover:bg-[#2A2D30] shrink-0 flex items-center ${isSidebarExpanded ? 'p-2' : 'w-11 h-11 mx-auto justify-center'}`}
                  title="Toggle Theme"
                >
                  <span className="dark:hidden"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg></span>
                  <span className="hidden dark:block"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg></span>
                </button>
                <button 
                  onClick={handleLogout}
                  className={`text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-full hover:bg-red-50 dark:hover:bg-[#2A2D30] shrink-0 flex items-center ${isSidebarExpanded ? 'p-2' : 'w-11 h-11 mx-auto justify-center'}`}
                  title="Log out"
                >
                  <Power size={18} />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-h-0 overflow-auto">
          <div className="p-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/printers" element={<PrintersList />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/map" element={<FloorMapPage />} />
              <Route path="/groups" element={<GroupsPage />} />
              <Route path="/smart-filters" element={<SmartFiltersPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/logs" element={<SystemLogs />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <WebSocketProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/offline" element={<OfflinePage />} />
              <Route path="/*" element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              } />
            </Routes>
            <Toaster position="bottom-right" />
            <CommandPalette />
          </Router>
        </WebSocketProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
