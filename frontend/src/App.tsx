import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
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
  const [isInitialSyncing, setIsInitialSyncing] = useState(false);

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

  useEffect(() => {
    const performInitialSync = async () => {
      if (!sessionStorage.getItem('hasSynced')) {
        setIsInitialSyncing(true);
        try {
          const token = localStorage.getItem('token') || localStorage.getItem('access_token');
          const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/printers/sync`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (res.status === 401) {
            // Token expired after backend restart — force re-login
            sessionStorage.removeItem('hasSynced');
            logout();
            navigate('/login');
            return;
          }
          sessionStorage.setItem('hasSynced', 'true');
        } catch (err) {
          // Network error — continue without sync, data will load via WebSocket
          console.warn("Initial sync skipped (network error):", err);
        } finally {
          setIsInitialSyncing(false);
        }
      }
    };
    performInitialSync();
  }, []);


  const handleLogout = () => {
    sessionStorage.removeItem('hasSynced');
    logout();
    navigate('/login');
  };

  // No blocking screen, let the initial sync happen in the background

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Top Header Row - spans full width */}
      <div className="flex h-16 flex-shrink-0">
        {/* Sidebar Logo */}
        <div className="w-64 bg-white dark:bg-gray-800 border-r border-b border-gray-200 dark:border-gray-700 flex items-center px-6">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
            BRAdmin Next
          </h1>
        </div>
        {/* Main Header */}
        <header className="flex-1 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-8 justify-between">
          <div className="flex-1"></div>
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
        <aside className="w-64 shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-y-auto">
          <nav className="flex-1 p-4 space-y-2">
            <Link to="/" className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <LayoutDashboard size={20} className="text-gray-500" />
              <span className="font-medium">Dashboard</span>
            </Link>
            <Link to="/printers" className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <Printer size={20} className="text-gray-500" />
              <span className="font-medium">Printers</span>
            </Link>
            <Link to="/reports" className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <FileText size={20} className="text-gray-500" />
              <span className="font-medium">Reports</span>
            </Link>
            <Link to="/map" className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <Map size={20} className="text-gray-500" />
              <span className="font-medium">Floor Map</span>
            </Link>
            <Link to="/groups" className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <Users size={20} className="text-gray-500" />
              <span className="font-medium">Groups</span>
            </Link>
            {user?.role === 'ADMIN' && (
              <>
                <Link to="/users" className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <Shield size={20} className="text-gray-500" />
                  <span className="font-medium">Users</span>
                </Link>
                <Link to="/logs" className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <Terminal size={20} className="text-gray-500" />
                  <span className="font-medium">System Logs</span>
                </Link>
              </>
            )}
            <Link to="/settings" className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
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
