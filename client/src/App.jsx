import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { WebSocketProvider } from './context/WebSocketContext';
import { useWebSocket } from './hooks/useWebSocket';
import { useApi } from './hooks/useApi';
import NewsFeed from './panels/NewsFeed';
import RightPanel from './panels/RightPanel';
import OddsTab from './tabs/OddsTab';
import TrackerTab from './tabs/TrackerTab';
import ScoresTab from './tabs/ScoresTab';

const BASE = import.meta.env.VITE_API_BASE_URL || '';

const SPORTS = [
  { id: 'All',    emoji: '🌐', label: 'All Sports' },
  { id: 'NBA',    emoji: '🏀', label: 'NBA' },
  { id: 'NFL',    emoji: '🏈', label: 'NFL' },
  { id: 'MLB',    emoji: '⚾', label: 'MLB' },
  { id: 'Soccer', emoji: '⚽', label: 'Soccer' },
  { id: 'F1',     emoji: '🏎', label: 'Formula 1' },
  { id: 'Tennis', emoji: '🎾', label: 'Tennis' },
];

const NAV_TABS = [
  { id: 'News',    label: 'NEWS' },
  { id: 'Odds',    label: 'ODDS' },
  { id: 'Tracker', label: 'TRACKER' },
  { id: 'Scores',  label: 'SCORES' },
];

function heatColor(score) {
  if (!score && score !== 0) return 'var(--text-muted)';
  if (score >= 86) return 'var(--negative)';
  if (score >= 66) return 'var(--orange)';
  if (score >= 41) return 'var(--yellow)';
  return 'var(--text-muted)';
}

export default function App() {
  const [activeTab, setActiveTab]     = useState('News');
  const [activeSport, setActiveSport] = useState('All');
  const [toastMsg, setToastMsg]       = useState('');
  const [slowBanner, setSlowBanner]   = useState(false);

  useEffect(() => {
    const ping = () => fetch(`${BASE}/api/ping`).catch(() => {});
    ping();
    const id = setInterval(ping, 14 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSlowBanner(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2000);
  }, []);

  const dismissBanner = useCallback(() => setSlowBanner(false), []);

  return (
    <WebSocketProvider>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-base)' }}>
        <Topbar activeTab={activeTab} onTabChange={setActiveTab}
          onShare={() => navigator.clipboard.writeText(window.location.href).then(() => showToast('Link copied!'))} />

        {slowBanner && <ColdStartBanner onDismiss={dismissBanner} />}

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <LeftSidebar activeSport={activeSport}
            onSportChange={id => { setActiveSport(id); setActiveTab('News'); }} />

          <main style={{ flex: 1, overflowY: 'auto', minWidth: 0, position: 'relative' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                style={{ height: '100%' }}
              >
                {activeTab === 'News' && <NewsFeed activeSport={activeSport} onDataLoaded={dismissBanner} />}
                {activeTab === 'Odds' && <div style={{ padding: 16 }}><OddsTab /></div>}
                {activeTab === 'Tracker' && <div style={{ padding: 16 }}><TrackerTab /></div>}
                {activeTab === 'Scores' && <div style={{ padding: 16 }}><ScoresTab /></div>}
              </motion.div>
            </AnimatePresence>
          </main>

          <RightPanel />
        </div>

        <AnimatePresence>
          {toastMsg && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed', bottom: 16, right: 16,
                background: 'var(--accent)', color: '#fff',
                fontSize: 12, fontFamily: 'var(--mono)',
                padding: '6px 14px', borderRadius: 4,
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 9999,
              }}
            >
              {toastMsg}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </WebSocketProvider>
  );
}

// ── Topbar ────────────────────────────────────────────────────────────────────

function Topbar({ activeTab, onTabChange, onShare }) {
  return (
    <header style={{
      height: 48, display: 'flex', alignItems: 'center',
      background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)',
      padding: '0 16px', flexShrink: 0, gap: 16,
    }}>
      <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 14, color: 'var(--accent)', letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>
        SPORTSPULSE
      </span>

      <nav style={{ display: 'flex', gap: 2, flex: 1, justifyContent: 'center' }}>
        {NAV_TABS.map(t => (
          <button key={t.id} onClick={() => onTabChange(t.id)} style={{
            padding: '4px 14px',
            background: activeTab === t.id ? 'rgba(56,189,248,0.12)' : 'transparent',
            border: activeTab === t.id ? '1px solid rgba(56,189,248,0.4)' : '1px solid transparent',
            borderRadius: 4,
            color: activeTab === t.id ? 'var(--accent)' : 'var(--text-muted)',
            fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
            cursor: 'pointer', transition: 'all 0.15s',
          }}>
            {t.label}
          </button>
        ))}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <WsStatus />
        <HeatTicker />
        <button onClick={onShare} title="Copy link" style={{
          background: 'none', border: '1px solid var(--border)', borderRadius: 4,
          color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
          padding: '2px 7px', fontFamily: 'var(--mono)',
        }}>⎘</button>
        <LiveClock />
      </div>
    </header>
  );
}

function WsStatus() {
  const { connected } = useWebSocket();
  return (
    <span title={connected ? 'WebSocket live' : 'WebSocket offline'}
      style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--mono)', fontSize: 10 }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: connected ? 'var(--accent)' : 'var(--text-muted)',
        // subtle pulse only when connected
        animation: connected ? 'glow-pulse 2.5s ease-in-out infinite' : 'none',
      }} />
      <span style={{ color: connected ? 'var(--accent)' : 'var(--text-muted)' }}>WS</span>
    </span>
  );
}

function HeatTicker() {
  const wsData = useWebSocket();
  const { data: heatHttp } = useApi('/api/heat-scores');
  const heatScores = wsData?.heatScores || heatHttp || {};

  return (
    <div style={{ display: 'flex', gap: 8, overflow: 'hidden' }}>
      {['NBA', 'NFL', 'MLB', 'Soccer', 'F1'].map(s => {
        const score = heatScores[s];
        if (score == null) return null;
        const color = heatColor(score);
        return (
          <span key={s} style={{ fontFamily: 'var(--mono)', fontSize: 10, display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--text-muted)' }}>{s}</span>
            <span style={{ color, fontWeight: 700 }}>{score}</span>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
          </span>
        );
      })}
    </div>
  );
}

function LiveClock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('en-US', { hour12: false }));
  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString('en-US', { hour12: false })), 1000);
    return () => clearInterval(id);
  }, []);
  return <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{time}</span>;
}

// ── Left Sidebar ──────────────────────────────────────────────────────────────

function LeftSidebar({ activeSport, onSportChange }) {
  const wsData = useWebSocket();
  const { data: heatHttp } = useApi('/api/heat-scores');
  const heatScores = wsData?.heatScores || heatHttp || {};
  const { lastUpdated } = useWebSocket();
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    if (!lastUpdated) return;
    setSecs(0);
    const id = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  return (
    <aside style={{
      width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: 'var(--bg-panel)', borderRight: '1px solid var(--border)',
      overflowY: 'auto',
    }}>
      <div style={{ padding: '12px 12px 4px', fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
        SPORTS
      </div>
      {SPORTS.map(s => {
        const score = s.id === 'All' ? null : heatScores[s.id];
        const color = heatColor(score);
        const isActive = activeSport === s.id;
        return (
          <button key={s.id} onClick={() => onSportChange(s.id)} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px',
            // Background fill for active — no left-border accent
            background: isActive ? 'rgba(56,189,248,0.07)' : 'transparent',
            border: 'none', cursor: 'pointer',
            transition: 'background 0.12s',
          }}>
            <span style={{ fontSize: 13 }}>{s.emoji}</span>
            <span style={{
              flex: 1, textAlign: 'left', fontSize: 12,
              fontFamily: 'var(--font-sans)',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: isActive ? 600 : 400,
            }}>
              {s.label}
            </span>
            {score != null && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color, fontWeight: 700 }}>{score}</span>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
              </span>
            )}
          </button>
        );
      })}
      {lastUpdated && (
        <div style={{
          marginTop: 'auto', padding: '10px 12px', fontSize: 9,
          fontFamily: 'var(--mono)', color: 'var(--text-muted)',
          borderTop: '1px solid var(--border)',
        }}>
          Updated {secs}s ago
        </div>
      )}
    </aside>
  );
}

// ── Cold Start Banner — thin muted strip, not alarming ────────────────────────

function ColdStartBanner({ onDismiss }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '4px 16px',
      background: 'rgba(80,96,112,0.12)', borderBottom: '1px solid rgba(80,96,112,0.2)',
      color: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--mono)',
      flexShrink: 0,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-muted)' }} />
      Warming up — first load may take a moment
      <button onClick={onDismiss} style={{
        marginLeft: 'auto', background: 'none', border: 'none',
        color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, lineHeight: 1,
        padding: '0 2px',
      }}>✕</button>
    </div>
  );
}
