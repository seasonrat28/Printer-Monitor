import { createContext, useContext, useEffect, useState, useRef } from 'react';
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

    // All mutable state lives in refs so closures never go stale
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const retryCountRef = useRef(0);
    const isMountedRef = useRef(true);
    const MAX_RETRY_DELAY = 30000;

    useEffect(() => {
        isMountedRef.current = true;

        function connect() {
            // Cancel any pending reconnect timer
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }

            // Null out handlers on the old socket so its onclose doesn't fire a reconnect
            if (wsRef.current) {
                wsRef.current.onopen = null;
                wsRef.current.onclose = null;
                wsRef.current.onerror = null;
                wsRef.current.onmessage = null;
                if (
                    wsRef.current.readyState === WebSocket.OPEN ||
                    wsRef.current.readyState === WebSocket.CONNECTING
                ) {
                    wsRef.current.close(1000, 'reconnect');
                }
                wsRef.current = null;
            }

            if (!isMountedRef.current) return;

            const wsBase =
                import.meta.env.VITE_API_URL?.replace(/^http/, 'ws') ||
                `ws://${window.location.hostname}:8000`;
            const wsUrl = `${wsBase}/api/v1/ws/dashboard`;

            let ws: WebSocket;
            try {
                ws = new WebSocket(wsUrl);
            } catch (err) {
                console.error('Failed to create WebSocket:', err);
                scheduleReconnect();
                return;
            }
            wsRef.current = ws;

            ws.onopen = () => {
                if (!isMountedRef.current) return;
                retryCountRef.current = 0;
                setIsConnected(true);
            };

            ws.onclose = (evt) => {
                if (!isMountedRef.current) return;
                setIsConnected(false);
                // Only reconnect when it wasn't an intentional unmount close
                if (wsRef.current === ws) {
                    scheduleReconnect();
                }
            };

            ws.onerror = () => {
                // onclose fires right after onerror; reconnect is handled there
            };

            ws.onmessage = (event) => {
                if (!isMountedRef.current) return;
                try {
                    const parsed = JSON.parse(event.data);
                    setLastEvent(parsed);
                } catch (err) {
                    console.error('Failed to parse WS message', err);
                }
            };
        }

        function scheduleReconnect() {
            if (!isMountedRef.current) return;
            // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
            const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), MAX_RETRY_DELAY);
            retryCountRef.current += 1;
            console.log(`WebSocket reconnecting in ${delay}ms (attempt ${retryCountRef.current})`);
            reconnectTimerRef.current = setTimeout(connect, delay);
        }

        connect();

        return () => {
            isMountedRef.current = false;
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
            if (wsRef.current) {
                wsRef.current.onopen = null;
                wsRef.current.onclose = null;
                wsRef.current.onerror = null;
                wsRef.current.onmessage = null;
                wsRef.current.close(1000, 'unmount');
                wsRef.current = null;
            }
        };
    }, []); // ← empty deps: runs exactly once on mount, cleans up on unmount

    return (
        <WebSocketContext.Provider value={{ lastEvent, isConnected }}>
            {children}
        </WebSocketContext.Provider>
    );
};
