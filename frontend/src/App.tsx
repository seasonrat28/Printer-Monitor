import { BrowserRouter as Router, Routes, Route, Link, NavLink, useNavigate } from 'react-router-dom';
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
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-[#121212] text-slate-900 dark:text-slate-100">
      {/* Top Header Row - spans full width */}
      <div className="flex h-16 shrink-0">
        {/* Sidebar Logo */}
        <div className="w-64 bg-[#10243e] border-r border-[#1d3858] flex items-center px-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Operations</p>
            <h1 className="text-xl font-semibold tracking-tight text-white">BRAdmin Next</h1>
          </div>
        </div>
        {/* Main Header */}
        <header className="flex-1 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-8 justify-between">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Monitoring active</span>
          </div>
          <div className="flex items-center space-x-4">
            <button 
                onClick={toggleDarkMode}
                className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Toggle Dark Mode"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
            </button>
            <div className="flex items-center space-x-2 border-l pl-4 border-gray-200 dark:border-gray-700">
              <span className="text-sm font-medium">{user?.username}</span>
              <button 
                onClick={handleLogout}
                className="p-2 text-gray-500 hover:text-red-500 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Log out"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </header>
      </div>

      {/* Body Row */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar Nav */}
        <aside className="w-64 shrink-0 bg-[#10243e] border-r border-[#1d3858] flex flex-col overflow-y-auto">
          <nav className="flex-1 p-4 space-y-2">
            <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Workspace</p>
            <NavLink to="/" end className={({ isActive }) => `flex items-center space-x-3 rounded-md border-l-2 px-4 py-3 transition-colors ${isActive ? 'border-sky-300 bg-[#18395d] text-white' : 'border-transparent text-slate-300 hover:bg-[#163452] hover:text-white'}`}>
              <LayoutDashboard size={19} />
              <span className="font-medium">Dashboard</span>
            </NavLink>
            <NavLink to="/printers" className={({ isActive }) => `flex items-center space-x-3 rounded-md border-l-2 px-4 py-3 transition-colors ${isActive ? 'border-sky-300 bg-[#18395d] text-white' : 'border-transparent text-slate-300 hover:bg-[#163452] hover:text-white'}`}>
              <Printer size={19} />
              <span className="font-medium">Printers</span>
            </NavLink>
            <Link to="/reports" className="flex items-center space-x-3 px-4 py-3 rounded-md text-slate-300 hover:bg-[#163452] hover:text-white transition-colors">
              <FileText size={20} className="text-gray-500" />
              <span className="font-medium">Reports</span>
            </Link>
            <Link to="/map" className="flex items-center space-x-3 px-4 py-3 rounded-md text-slate-300 hover:bg-[#163452] hover:text-white transition-colors">
              <Map size={20} className="text-gray-500" />
              <span className="font-medium">Floor Map</span>
            </Link>
            <Link to="/groups" className="flex items-center space-x-3 px-4 py-3 rounded-md text-slate-300 hover:bg-[#163452] hover:text-white transition-colors">
              <Users size={20} className="text-gray-500" />
              <span className="font-medium">Groups</span>
            </Link>
            {user?.role === 'ADMIN' && (
              <>
                <Link to="/users" className="flex items-center space-x-3 px-4 py-3 rounded-md text-slate-300 hover:bg-[#163452] hover:text-white transition-colors">
                  <Shield size={20} className="text-gray-500" />
                  <span className="font-medium">Users</span>
                </Link>
                <Link to="/logs" className="flex items-center space-x-3 px-4 py-3 rounded-md text-slate-300 hover:bg-[#163452] hover:text-white transition-colors">
                  <Terminal size={20} className="text-gray-500" />
                  <span className="font-medium">System Logs</span>
                </Link>
              </>
            )}
            <Link to="/settings" className="flex items-center space-x-3 px-4 py-3 rounded-md text-slate-300 hover:bg-[#163452] hover:text-white transition-colors">
              <Settings size={20} className="text-gray-500" />
              <span className="font-medium">Settings</span>
            </Link>
          </nav>
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
