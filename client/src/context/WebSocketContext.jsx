import React, { createContext, useReducer, useEffect, useRef } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

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
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      if (!mountedRef.current) return;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          if (mountedRef.current) dispatch({ type: 'connected' });
        };

        ws.onmessage = (e) => {
          if (!mountedRef.current) return;
          try {
            const payload = JSON.parse(e.data);
            if (payload.type === 'update') {
              dispatch({ type: 'update', payload });
            }
          } catch {
            // ignore malformed messages
          }
        };

        ws.onclose = () => {
          if (!mountedRef.current) return;
          dispatch({ type: 'disconnected' });
          reconnectTimerRef.current = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          // onclose will fire after onerror, triggering reconnect
          ws.close();
        };
      } catch {
        // WebSocket constructor can throw if URL is invalid
        reconnectTimerRef.current = setTimeout(connect, 3000);
      }
    }

    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on unmount
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
