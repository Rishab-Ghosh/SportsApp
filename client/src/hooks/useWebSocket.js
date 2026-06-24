import { useContext } from 'react';
import { WebSocketContext } from '../context/WebSocketContext';

/**
 * Returns live WebSocket state: { markets, scores, heatScores, lastUpdated, connected }.
 * Returns null values until the first WS message arrives — components fall back to useApi data.
 */
export function useWebSocket() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error('useWebSocket must be used inside WebSocketProvider');
  return ctx;
}
