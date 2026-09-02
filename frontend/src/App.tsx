import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { WebSocketProvider } from './contexts/WebSocketContext';
import Dashboard from './pages/Dashboard';
import PrintersList from './pages/PrintersList';
import { LayoutDashboard, Printer, Settings } from 'lucide-react';

function App() {
  return (
    <WebSocketProvider>
      <Router>
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
              <Link to="/settings" className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <Settings size={20} className="text-gray-500" />
                <span className="font-medium">Settings</span>
              </Link>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-8">
              <div className="flex-1"></div>
              <div className="flex items-center space-x-4">
                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                  <span className="text-sm font-medium text-indigo-700">AD</span>
                </div>
              </div>
            </header>
            <div className="p-8">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/printers" element={<PrintersList />} />
              </Routes>
            </div>
          </main>
        </div>
      </Router>
    </WebSocketProvider>
  );
}

export default App;
