import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

type WebSocketEvent = {
    type: string;
    data: any;
};

interface WebSocketContextType {
    lastEvent: WebSocketEvent | null;
    isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType>({ lastEvent: null, isConnected: false });

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
    const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Adjust URL for production vs dev
        const wsBase = import.meta.env.VITE_API_URL?.replace(/^http/, 'ws') || `ws://${window.location.hostname}:8000`;
        const wsUrl = `${wsBase}/api/v1/ws/dashboard`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => setIsConnected(true);
        ws.onclose = () => setIsConnected(false);
        ws.onmessage = (event) => {
            try {
                const parsed = JSON.parse(event.data);
                setLastEvent(parsed);
            } catch (err) {
                console.error("Failed to parse WS message", err);
            }
        };

        return () => {
            ws.close();
        };
    }, []);

    return (
        <WebSocketContext.Provider value={{ lastEvent, isConnected }}>
            {children}
        </WebSocketContext.Provider>
    );
};
