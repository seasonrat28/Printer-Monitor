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
import { UsersPage } from './pages/UsersPage';
import SystemLogs from './pages/SystemLogs';
import { ProfilePage } from './pages/ProfilePage';
import { LayoutDashboard, Printer, Settings, LogOut, FileText, Map, Users, Shield, Terminal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ToastProvider } from './contexts/ToastContext';

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

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 dark:bg-[#151c2f] dark:bg-gradient-to-br dark:from-[#111827] dark:to-[#1e1b4b] text-slate-900 dark:text-slate-100 transition-all duration-700 ease-in-out">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 shrink-0 bg-gradient-to-b from-[#111827] to-[#1e1b4b] border-r border-indigo-900/40 shadow-xl flex flex-col">
          {/* Logo Section */}
          <div className="h-16 flex flex-col justify-center px-6 border-b border-indigo-900/40 shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Operations</p>
            <h1 className="text-xl font-semibold tracking-tight text-white">BRAdmin Next</h1>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400/80">Workspace</p>
            {[
              { to: "/", icon: LayoutDashboard, label: "Dashboard", exact: true },
              { to: "/printers", icon: Printer, label: "Printers" },
              { to: "/reports", icon: FileText, label: "Reports" },
              { to: "/map", icon: Map, label: "Floor Map" },
              { to: "/groups", icon: Users, label: "Groups" },
            ].map(item => (
              <NavLink key={item.to} to={item.to} end={item.exact} className={({ isActive }) => `flex items-center space-x-3 rounded-md border-l-2 px-4 py-3 transition-all duration-200 ${isActive ? 'border-indigo-400 bg-indigo-500/15 text-indigo-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm' : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-100 hover:translate-x-1'}`}>
                <item.icon size={19} />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            ))}
            
            {user?.role === 'ADMIN' && (
              <>
                <NavLink to="/users" className={({ isActive }) => `flex items-center space-x-3 rounded-md border-l-2 px-4 py-3 transition-all duration-200 ${isActive ? 'border-indigo-400 bg-indigo-500/15 text-indigo-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm' : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-100 hover:translate-x-1'}`}>
                  <Shield size={19} />
                  <span className="font-medium">Users</span>
                </NavLink>
                <NavLink to="/logs" className={({ isActive }) => `flex items-center space-x-3 rounded-md border-l-2 px-4 py-3 transition-all duration-200 ${isActive ? 'border-indigo-400 bg-indigo-500/15 text-indigo-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm' : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-100 hover:translate-x-1'}`}>
                  <Terminal size={19} />
                  <span className="font-medium">System Logs</span>
                </NavLink>
              </>
            )}
            <NavLink to="/settings" className={({ isActive }) => `flex items-center space-x-3 rounded-md border-l-2 px-4 py-3 transition-all duration-200 ${isActive ? 'border-indigo-400 bg-indigo-500/15 text-indigo-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm' : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-100 hover:translate-x-1'}`}>
              <Settings size={19} />
              <span className="font-medium">Settings</span>
            </NavLink>
          </nav>

          {/* User & Settings Footer */}
          <div className="p-4 border-t border-indigo-900/40 bg-black/10 shrink-0">
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Active</span>
              </div>
              <button 
                  onClick={toggleDarkMode}
                  className="p-1.5 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-white/10"
                  title="Toggle Dark Mode"
              >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
              </button>
            </div>
            
            <div className="flex items-center justify-between bg-white/5 rounded-lg p-3 border border-white/5">
              <Link to="/profile" className="flex items-center gap-3 overflow-hidden flex-1 group hover:bg-white/5 rounded-md p-1 transition-colors cursor-pointer">
                <div className="h-8 w-8 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-sm shrink-0 border border-indigo-500/30 group-hover:bg-indigo-500/30 transition-colors">
                  {user?.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-slate-200 truncate group-hover:text-indigo-200 transition-colors">{user?.username}</p>
                    {user?.role && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 whitespace-nowrap uppercase tracking-wider">
                        {user.role}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider truncate mt-0.5 group-hover:text-slate-400 transition-colors">
                    {user?.display_name || 'System User'}
                  </p>
                </div>
              </Link>
              <button 
                  onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-400 transition-colors rounded-full hover:bg-red-400/10 shrink-0"
                title="Log out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-h-0 overflow-auto">
          <div className="p-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/printers" element={<PrintersList />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/map" element={<FloorMapPage />} />
              <Route path="/groups" element={<GroupsPage />} />
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
              <Route path="/*" element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              } />
            </Routes>
          </Router>
        </WebSocketProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
