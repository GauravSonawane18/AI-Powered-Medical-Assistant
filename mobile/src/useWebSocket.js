import { useCallback, useEffect, useRef } from 'react';
import { getToken } from './storage';
import { API_BASE_URL } from './api';

/**
 * Connects to the backend WebSocket and calls onMessage(data) for every
 * JSON event received. Automatically reconnects on disconnect.
 */
export function useWebSocket(onMessage) {
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const pingInterval = useRef(null);
  const activeRef = useRef(true);
  // Always call the latest onMessage without re-connecting
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(async () => {
    if (!activeRef.current) return;
    const token = await getToken();
    if (!token) return;

    const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + '/ws?token=' + encodeURIComponent(token);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        clearTimeout(reconnectTimer.current);
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          onMessageRef.current?.(data);
        } catch {
          // non-JSON frames (server pong) – ignore
        }
      };

      ws.onclose = () => {
        if (activeRef.current) {
          reconnectTimer.current = setTimeout(connect, 4000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      if (activeRef.current) {
        reconnectTimer.current = setTimeout(connect, 4000);
      }
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    connect();

    // Keepalive ping every 25 s so idle connections stay open
    pingInterval.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send('ping');
      }
    }, 25000);

    return () => {
      activeRef.current = false;
      clearInterval(pingInterval.current);
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);
}
