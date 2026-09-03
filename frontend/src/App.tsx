import React from 'react';
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
import { LayoutDashboard, Printer, Settings, LogOut, FileText, Map, Users, Shield } from 'lucide-react';

const MainLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
            BRAdmin Next
          </h1>
        </div>
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
            <Link to="/users" className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <Shield size={20} className="text-gray-500" />
              <span className="font-medium">Users</span>
            </Link>
          )}
          <Link to="/settings" className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <Settings size={20} className="text-gray-500" />
            <span className="font-medium">Settings</span>
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col">
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-8 justify-between">
          <div className="flex-1"></div>
          <div className="flex items-center space-x-4">
            <button 
                onClick={() => document.documentElement.classList.toggle('dark')}
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
        <div className="p-8 flex-1">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/printers" element={<PrintersList />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/map" element={<FloorMapPage />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

function App() {
  return (
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
  );
}

export default App;
