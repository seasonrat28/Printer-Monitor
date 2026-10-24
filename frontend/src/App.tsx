import { BrowserRouter as Router, Routes, Route, NavLink, Link, useNavigate } from 'react-router-dom';
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
import { LayoutDashboard, Printer, Settings, FileText, Map, Shield, Terminal, Filter, Layers, Wrench, Bell, ChevronLeft, ChevronRight, Power, Sun, Moon, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { ToastProvider } from './contexts/ToastContext';
import { Toaster } from 'react-hot-toast';
import { CommandPalette } from './components/CommandPalette';
import { AlertProvider, useAlerts } from './contexts/AlertContext';

const MainLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

// Persist dark mode across refreshes (Default is Light Mode)
const initDarkMode = () => {
  const saved = localStorage.getItem('darkMode');
  if (saved === 'true') { // Only dark if explicitly enabled by user
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};
initDarkMode();

  const { activeAlertsCount } = useAlerts();

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  const toggleDarkMode = () => {
    const nextDark = !document.documentElement.classList.contains('dark');
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
    setIsDark(nextDark);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('hasSynced');
    logout();
    navigate('/login');
  };

  // No blocking screen, let the initial sync happen in the background

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen h-full w-full flex-col overflow-hidden bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-all duration-500 ease-in-out">
      {/* Mobile Top App Bar */}
      <header className="md:hidden h-14 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 flex items-center justify-between z-30 shrink-0 shadow-sm">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 -ml-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            aria-label="Open Navigation"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Printer className="w-6 h-6 text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
            <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
              Enterprise<span className="text-blue-600 dark:text-blue-400">PM</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleDarkMode}
            className="p-2 text-slate-500 hover:text-amber-500 rounded-full transition-colors"
            title="Toggle theme"
          >
            {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-slate-600" />}
          </button>
          <NavLink
            to="/alerts"
            className="p-2 text-slate-500 hover:text-blue-600 relative rounded-full transition-colors"
          >
            <Bell size={18} />
            {activeAlertsCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900">
                {activeAlertsCount > 99 ? '99+' : activeAlertsCount}
              </span>
            )}
          </NavLink>
        </div>
      </header>

      {/* Mobile Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 md:hidden animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Desktop Sidebar: Clean flex item, always visible on desktop (hidden on mobile) */}
        <aside
          className={`
            hidden md:flex flex-col shrink-0 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-[2px_0_24px_rgba(0,0,0,0.02)] transition-all duration-300 ease-in-out relative z-30
            ${isSidebarExpanded ? 'w-[280px]' : 'w-16'}
          `}
        >
          {/* Logo Section */}
          <div className={`h-20 flex items-center justify-between shrink-0 whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarExpanded ? 'px-6' : 'justify-center px-0'}`}>
            <div className="flex items-center gap-3 relative">
              <Printer className="w-8 h-8 shrink-0 text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
              <div className={`flex flex-col justify-center transition-opacity duration-300 ${isSidebarExpanded ? 'opacity-100' : 'opacity-0 hidden'}`}>
                 <h1 className="text-xl font-black tracking-tight text-[#1A1D20] dark:text-white leading-none flex items-center gap-1">
                   Enterprise<span className="text-blue-600 dark:text-blue-400">PM</span>
                 </h1>
                 <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 leading-none mt-1 uppercase tracking-wider">
                   Printer Monitoring Suite
                 </span>
              </div>
            </div>
          </div>
          
          {/* Desktop Collapse/Expand Toggle Button */}
          <button 
            onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
            className="absolute -right-3.5 top-[88px] bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 p-1.5 rounded-full shadow-md hover:text-blue-600 dark:hover:text-blue-400 hover:scale-110 transition-all z-50 border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center justify-center"
            title={isSidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
            aria-label={isSidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isSidebarExpanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
          
          {/* Desktop Navigation */}
          <nav className={`flex-1 py-2 overflow-y-auto overflow-x-hidden relative space-y-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] ${isSidebarExpanded ? 'px-4' : 'px-2'}`}>
            {/* Group 1: NAVIGATION */}
            <div className="space-y-1">
              <p className={`pl-4 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 transition-opacity duration-300 whitespace-nowrap ${isSidebarExpanded ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden pb-0'}`}>Navigation</p>
              {[
                { to: "/", icon: LayoutDashboard, label: "Dashboard", exact: true },
                { to: "/printers", icon: Printer, label: "Printers" },
                { to: "/alerts", icon: Bell, label: "Alerts", badge: activeAlertsCount > 0 ? activeAlertsCount : undefined },
                { to: "/map", icon: Map, label: "Floor Map" },
              ].map(item => (
                <div key={item.to} className="relative group/navitem">
                  <NavLink
                    title={!isSidebarExpanded ? item.label : undefined}
                    to={item.to}
                    end={item.exact}
                    className={({ isActive }) => `flex items-center w-full py-3 rounded-xl overflow-hidden transition-colors duration-200 whitespace-nowrap ${isSidebarExpanded ? 'px-[14px]' : 'justify-center'} ${isActive ? 'bg-blue-50/80 text-blue-700 font-semibold dark:bg-blue-900/30 dark:text-blue-300' : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#2A2D30] dark:hover:text-slate-200'}`}
                  >
                    <item.icon size={20} className="shrink-0" strokeWidth={2} />
                    <span className={`transition-all duration-300 ${isSidebarExpanded ? 'ml-3 opacity-100' : 'w-0 opacity-0 overflow-hidden hidden'}`}>{item.label}</span>
                    {item.badge && (
                      <span className={`ml-auto flex h-5 items-center justify-center rounded-full bg-red-100 px-2 text-[10px] font-bold text-red-600 dark:bg-red-500/20 dark:text-red-400 transition-all duration-300 ${isSidebarExpanded ? 'opacity-100' : 'w-0 opacity-0 overflow-hidden hidden'}`}>
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
                  <NavLink
                    title={!isSidebarExpanded ? item.label : undefined}
                    to={item.to}
                    className={({ isActive }) => `flex items-center w-full py-3 rounded-xl overflow-hidden transition-colors duration-200 whitespace-nowrap ${isSidebarExpanded ? 'px-[14px]' : 'justify-center'} ${isActive ? 'bg-blue-50/80 text-blue-700 font-semibold dark:bg-blue-900/30 dark:text-blue-300' : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#2A2D30] dark:hover:text-slate-200'}`}
                  >
                    <item.icon size={20} className="shrink-0" strokeWidth={2} />
                    <span className={`transition-all duration-300 ${isSidebarExpanded ? 'ml-3 opacity-100' : 'w-0 opacity-0 overflow-hidden hidden'}`}>{item.label}</span>
                  </NavLink>
                </div>
              ))}
              
              {user?.role === 'ADMIN' && (
                <>
                  <div className="relative group/navitem">
                    <NavLink
                      title={!isSidebarExpanded ? "Users" : undefined}
                      to="/users"
                      className={({ isActive }) => `flex items-center w-full py-3 rounded-xl overflow-hidden transition-colors duration-200 whitespace-nowrap ${isSidebarExpanded ? 'px-[14px]' : 'justify-center'} ${isActive ? 'bg-blue-50/80 text-blue-700 font-semibold dark:bg-blue-900/30 dark:text-blue-300' : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#2A2D30] dark:hover:text-slate-200'}`}
                    >
                      <Shield size={20} className="shrink-0" strokeWidth={2} />
                      <span className={`transition-all duration-300 ${isSidebarExpanded ? 'ml-3 opacity-100' : 'w-0 opacity-0 overflow-hidden hidden'}`}>Users</span>
                    </NavLink>
                  </div>
                  <div className="relative group/navitem">
                    <NavLink
                      title={!isSidebarExpanded ? "System Logs" : undefined}
                      to="/logs"
                      className={({ isActive }) => `flex items-center w-full py-3 rounded-xl overflow-hidden transition-colors duration-200 whitespace-nowrap ${isSidebarExpanded ? 'px-[14px]' : 'justify-center'} ${isActive ? 'bg-blue-50/80 text-blue-700 font-semibold dark:bg-blue-900/30 dark:text-blue-300' : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#2A2D30] dark:hover:text-slate-200'}`}>
                      <Terminal size={20} className="shrink-0" strokeWidth={2} />
                      <span className={`transition-all duration-300 ${isSidebarExpanded ? 'ml-3 opacity-100' : 'w-0 opacity-0 overflow-hidden hidden'}`}>System Logs</span>
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
                  <NavLink
                    title={!isSidebarExpanded ? item.label : undefined}
                    to={item.to}
                    className={({ isActive }) => `flex items-center w-full py-3 rounded-xl overflow-hidden transition-colors duration-200 whitespace-nowrap ${isSidebarExpanded ? 'px-[14px]' : 'justify-center'} ${isActive ? 'bg-blue-50/80 text-blue-700 font-semibold dark:bg-blue-900/30 dark:text-blue-300' : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#2A2D30] dark:hover:text-slate-200'}`}
                  >
                    <item.icon size={20} className="shrink-0" strokeWidth={2} />
                    <span className={`transition-all duration-300 ${isSidebarExpanded ? 'ml-3 opacity-100' : 'w-0 opacity-0 overflow-hidden hidden'}`}>{item.label}</span>
                  </NavLink>
                </div>
              ))}
            </div>
          </nav>

          {/* Desktop Footer User Profile & Theme Toggle */}
          <div className={`shrink-0 whitespace-nowrap overflow-hidden flex flex-col gap-4 border-t border-slate-100 dark:border-slate-800 ${isSidebarExpanded ? 'p-4' : 'py-4 px-0'}`}>
            <div className={`flex items-center justify-between ${isSidebarExpanded ? '' : 'flex-col gap-4'}`}>
              <Link
                to="/profile"
                className={`flex items-center overflow-hidden group/profile hover:bg-slate-50 dark:hover:bg-[#2A2D30] rounded-xl transition-colors cursor-pointer ${isSidebarExpanded ? 'gap-3 p-2 flex-1' : 'w-11 h-11 mx-auto justify-center'}`}
              >
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
                  className={`text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors rounded-full hover:bg-amber-50 dark:hover:bg-[#2A2D30] shrink-0 flex items-center justify-center ${isSidebarExpanded ? 'p-2' : 'w-11 h-11 mx-auto'}`}
                  title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                  {isDark ? (
                    <Sun size={18} className="text-amber-400 transition-transform duration-300 rotate-0 hover:rotate-90" />
                  ) : (
                    <Moon size={18} className="text-slate-600 transition-transform duration-300 rotate-0 hover:-rotate-12" />
                  )}
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

        {/* Mobile Slide-Over Drawer: Only shown when isMobileMenuOpen is true */}
        <aside
          className={`
            fixed inset-y-0 left-0 w-[280px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl z-50 flex flex-col overflow-hidden transition-transform duration-300 ease-in-out md:hidden
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'}
          `}
        >
          {/* Mobile Drawer Header */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-2.5">
              <Printer className="w-7 h-7 text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
              <div className="flex flex-col">
                <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white leading-none">
                  Enterprise<span className="text-blue-600 dark:text-blue-400">PM</span>
                </span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Mobile Suite</span>
              </div>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Mobile Drawer Nav Links */}
          <nav className="flex-1 py-3 px-3 overflow-y-auto space-y-4">
            <div>
              <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Navigation</p>
              <div className="space-y-1">
                {[
                  { to: "/", icon: LayoutDashboard, label: "Dashboard", exact: true },
                  { to: "/printers", icon: Printer, label: "Printers" },
                  { to: "/alerts", icon: Bell, label: "Alerts", badge: activeAlertsCount > 0 ? activeAlertsCount : undefined },
                  { to: "/map", icon: Map, label: "Floor Map" },
                ].map(item => (
                  <NavLink
                    key={item.to}
                    onClick={() => setIsMobileMenuOpen(false)}
                    to={item.to}
                    end={item.exact}
                    className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${isActive ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                  >
                    <item.icon size={19} className="shrink-0" />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto flex h-5 items-center justify-center rounded-full bg-rose-500 px-2 text-[10px] font-bold text-white">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>

            <div>
              <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Management</p>
              <div className="space-y-1">
                {[
                  { to: "/groups", icon: Layers, label: "Groups" },
                  { to: "/inventory", icon: Wrench, label: "Inventory" },
                  { to: "/reports", icon: FileText, label: "Reports" },
                ].map(item => (
                  <NavLink
                    key={item.to}
                    onClick={() => setIsMobileMenuOpen(false)}
                    to={item.to}
                    className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${isActive ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                  >
                    <item.icon size={19} className="shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
                {user?.role === 'ADMIN' && (
                  <>
                    <NavLink
                      onClick={() => setIsMobileMenuOpen(false)}
                      to="/users"
                      className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${isActive ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                      <Shield size={19} className="shrink-0" />
                      <span>Users</span>
                    </NavLink>
                    <NavLink
                      onClick={() => setIsMobileMenuOpen(false)}
                      to="/logs"
                      className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${isActive ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                      <Terminal size={19} className="shrink-0" />
                      <span>System Logs</span>
                    </NavLink>
                  </>
                )}
              </div>
            </div>

            <div>
              <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Configuration</p>
              <div className="space-y-1">
                {[
                  { to: "/smart-filters", icon: Filter, label: "Smart Filters" },
                  { to: "/settings", icon: Settings, label: "Settings" },
                ].map(item => (
                  <NavLink
                    key={item.to}
                    onClick={() => setIsMobileMenuOpen(false)}
                    to={item.to}
                    className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${isActive ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                  >
                    <item.icon size={19} className="shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          </nav>

          {/* Mobile Drawer Footer User Info */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <Link
              to="/profile"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 flex-1 min-w-0"
            >
              <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 flex items-center justify-center font-bold text-sm shrink-0">
                {user?.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{user?.username || 'Administrator'}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">{user?.role || 'ADMIN'}</p>
              </div>
            </Link>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
              title="Logout"
            >
              <Power size={18} />
            </button>
          </div>
        </aside>

        {/* Main Content Area (Responsive padding: p-4 on mobile, p-8 on desktop, extra pb-24 on mobile for bottom bar) */}
        <main className="flex-1 min-h-0 overflow-auto bg-slate-50 dark:bg-slate-900">
          <div className="p-4 md:p-6 lg:p-8 pb-28 md:pb-16 min-h-full flex flex-col">
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

      {/* Native-Like Mobile Bottom Navigation Bar (App Experience) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800 z-40 px-3 flex items-center justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
        {[
          { to: "/", icon: LayoutDashboard, label: "Dashboard", exact: true },
          { to: "/printers", icon: Printer, label: "Printers" },
          { to: "/alerts", icon: Bell, label: "Alerts", badge: activeAlertsCount },
          { to: "/reports", icon: FileText, label: "Reports" },
          { to: "/settings", icon: Settings, label: "Settings" },
        ].map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) => `flex flex-col items-center justify-center w-14 py-1 relative transition-colors ${
              isActive ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
            }`}
          >
            <div className="relative">
              <item.icon size={20} strokeWidth={2.2} />
              {item.badge && item.badge > 0 && (
                <span className="absolute -top-1 -right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-1 tracking-tight leading-none">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <WebSocketProvider>
          <AlertProvider>
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
          </AlertProvider>
        </WebSocketProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
