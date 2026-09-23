import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
}

interface ToastContextType {
    addToast: (type: ToastType, title: string, message?: string) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const addToast = useCallback((type: ToastType, title: string, message?: string) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { id, type, title, message }]);

        // Auto remove after 5 seconds
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const getIcon = (type: ToastType) => {
        switch (type) {
            case 'success': return <CheckCircle className="text-emerald-500" size={20} />;
            case 'error': return <XCircle className="text-red-500" size={20} />;
            case 'warning': return <AlertTriangle className="text-amber-500" size={20} />;
            case 'info': return <Info className="text-blue-500" size={20} />;
        }
    };

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-[9999] flex flex-col space-y-2 max-w-sm w-full">
                {toasts.map(toast => (
                    <div 
                        key={toast.id}
                        className="bg-white dark:bg-gray-800 border-l-4 rounded shadow-lg p-4 flex items-start space-x-3 transition-all transform animate-in slide-in-from-bottom-5"
                        style={{
                            borderLeftColor: 
                                toast.type === 'success' ? '#10B981' :
                                toast.type === 'error' ? '#EF4444' :
                                toast.type === 'warning' ? '#F59E0B' : '#3B82F6'
                        }}
                    >
                        <div className="flex-shrink-0 mt-0.5">
                            {getIcon(toast.type)}
                        </div>
                        <div className="flex-1 w-0">
                            <p className="text-sm font-bold text-gray-900 dark:text-white">{toast.title}</p>
                            {toast.message && (
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{toast.message}</p>
                            )}
                        </div>
                        <div className="flex-shrink-0 flex">
                            <button
                                onClick={() => removeToast(toast.id)}
                                className="inline-flex text-gray-400 hover:text-gray-500 focus:outline-none"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
