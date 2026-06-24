import React, { createContext, useReducer, useEffect, useRef } from 'react';

function resolveWsUrl() {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  const proto = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
  const host = window.location.host.replace(':5173', ':3001');
  return `${proto}${host}`;
}

export const WebSocketContext = createContext(null);

const initialState = {
  markets: null,
  scores: null,
  heatScores: null,
  lastUpdated: null,
  connected: false,
};

function reducer(state, action) {
  switch (action.type) {
    case 'update':
      return {
        ...state,
        markets: action.payload.kalshi ?? state.markets,
        scores: action.payload.scores ?? state.scores,
        heatScores: action.payload.heat ?? state.heatScores,
        lastUpdated: action.payload.lastUpdated ?? Date.now(),
      };
    case 'connected':
      return { ...state, connected: true };
    case 'disconnected':
      return { ...state, connected: false };
    default:
      return state;
  }
}

export function WebSocketProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const attemptRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      if (!mountedRef.current) return;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

      try {
        const ws = new WebSocket(resolveWsUrl());
        wsRef.current = ws;

        ws.onopen = () => {
          if (!mountedRef.current) return;
          attemptRef.current = 0;
          dispatch({ type: 'connected' });
        };

        ws.onmessage = (e) => {
          if (!mountedRef.current) return;
          try {
            const payload = JSON.parse(e.data);
            if (payload.type === 'update') dispatch({ type: 'update', payload });
          } catch {
            // ignore malformed messages
          }
        };

        ws.onclose = () => {
          if (!mountedRef.current) return;
          dispatch({ type: 'disconnected' });
          // exponential backoff: 1s, 2s, 4s, 8s … cap at 30s
          const delay = Math.min(1000 * 2 ** attemptRef.current, 30000);
          attemptRef.current += 1;
          reconnectTimerRef.current = setTimeout(connect, delay);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        const delay = Math.min(1000 * 2 ** attemptRef.current, 30000);
        attemptRef.current += 1;
        reconnectTimerRef.current = setTimeout(connect, delay);
      }
    }

    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <WebSocketContext.Provider value={state}>
      {children}
    </WebSocketContext.Provider>
  );
}
