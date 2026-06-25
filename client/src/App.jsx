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
  { id: 'All',    label: 'ALL SPORTS' },
  { id: 'NBA',    label: 'NBA',       color: '#f97316' },
  { id: 'NFL',    label: 'NFL',       color: '#22c55e' },
  { id: 'MLB',    label: 'MLB',       color: '#3b82f6' },
  { id: 'Soccer', label: 'SOCCER',    color: '#6366f1' },
  { id: 'F1',     label: 'F1',        color: '#e74c3c' },
  { id: 'Tennis', label: 'TENNIS',    color: '#f5c518' },
];

const NAV_TABS = [
  { id: 'News',    label: 'NEWS' },
  { id: 'Scores',  label: 'SCORES' },
  { id: 'Odds',    label: 'ODDS' },
  { id: 'Tracker', label: 'TRACKER' },
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
        <Topbar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onShare={() => navigator.clipboard.writeText(window.location.href).then(() => showToast('Link copied!'))}
        />

        {slowBanner && <ColdStartBanner onDismiss={dismissBanner} />}
        <MarketTicker />

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <LeftSidebar
            activeSport={activeSport}
            onSportChange={id => { setActiveSport(id); setActiveTab('News'); }}
          />

          <main style={{ flex: 1, overflowY: 'auto', minWidth: 0, position: 'relative' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                style={{ height: '100%' }}
              >
                {activeTab === 'News'    && <NewsFeed activeSport={activeSport} onDataLoaded={dismissBanner} />}
                {activeTab === 'Odds'    && <div style={{ padding: 16 }}><OddsTab /></div>}
                {activeTab === 'Tracker' && <div style={{ padding: 16 }}><TrackerTab /></div>}
                {activeTab === 'Scores'  && <div style={{ padding: 16 }}><ScoresTab /></div>}
              </motion.div>
            </AnimatePresence>
          </main>

          <RightPanel />
        </div>

        <AnimatePresence>
          {toastMsg && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed', bottom: 16, right: 16,
                background: 'var(--bg-card)', color: 'var(--text-primary)',
                border: '1px solid var(--border-hover)',
                fontSize: 11, fontFamily: 'var(--mono)',
                padding: '6px 14px', borderRadius: 2,
                boxShadow: '0 4px 16px rgba(0,0,0,0.6)', zIndex: 9999,
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
      borderTop: '3px solid var(--brand)',
      height: 46, display: 'flex', alignItems: 'center',
      background: 'var(--bg-panel)',
      borderBottom: '1px solid var(--border)',
      padding: '0 14px', flexShrink: 0, gap: 0,
    }}>
      {/* Wordmark */}
      <span style={{
        fontFamily: 'var(--font-hero)', fontSize: 22,
        color: 'var(--brand)', letterSpacing: '0.04em', whiteSpace: 'nowrap',
        marginRight: 20,
      }}>
        SPORTSPULSE
      </span>

      {/* Nav — bottom-border underline style */}
      <nav style={{ display: 'flex', height: '100%', flex: 1, justifyContent: 'center' }}>
        {NAV_TABS.map(t => {
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => onTabChange(t.id)} style={{
              height: '100%', padding: '0 16px',
              background: 'transparent', border: 'none',
              borderBottom: active ? '2px solid var(--brand)' : '2px solid transparent',
              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
              fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
              letterSpacing: '0.08em', cursor: 'pointer',
              transition: 'color 0.12s, border-color 0.12s',
              marginBottom: '-1px',
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-secondary)'; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
        <HeatTicker />
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <WsStatus />
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <button onClick={onShare} title="Copy link" style={{
          background: 'none', border: '1px solid var(--border)', borderRadius: 2,
          color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer',
          padding: '2px 7px', fontFamily: 'var(--mono)', letterSpacing: '0.04em',
          transition: 'border-color 0.1s',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          SHARE
        </button>
        <LiveClock />
      </div>
    </header>
  );
}

function WsStatus() {
  const { connected } = useWebSocket();
  return (
    <span title={connected ? 'Live' : 'Connecting…'}
      style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.06em' }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
        background: connected ? 'var(--positive)' : 'var(--text-muted)',
        animation: connected ? 'glow-pulse 2.5s ease-in-out infinite' : 'none',
      }} />
      <span style={{ color: connected ? 'var(--positive)' : 'var(--text-muted)' }}>
        {connected ? 'LIVE' : 'OFF'}
      </span>
    </span>
  );
}

function HeatTicker() {
  const wsData = useWebSocket();
  const { data: heatHttp } = useApi('/api/heat-scores');
  const heatScores = wsData?.heatScores || heatHttp || {};

  const entries = ['NBA', 'NFL', 'MLB', 'Soccer', 'F1'].map(s => ({
    s, score: heatScores[s],
  })).filter(x => x.score != null);

  if (!entries.length) return null;

  return (
    <div style={{ display: 'flex', gap: 10, overflow: 'hidden' }}>
      {entries.map(({ s, score }) => {
        const color = heatColor(score);
        return (
          <span key={s} style={{
            fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.06em',
            display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap',
          }}>
            <span style={{ color: 'var(--text-muted)' }}>{s}</span>
            <span style={{ color, fontWeight: 700 }}>{score}</span>
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
  return (
    <span style={{
      fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-muted)',
      letterSpacing: '0.04em', whiteSpace: 'nowrap',
    }}>
      {time}
    </span>
  );
}

// ── Market Ticker ─────────────────────────────────────────────────────────────

function MarketTicker() {
  const wsData = useWebSocket();
  const { data: httpData } = useApi('/api/kalshi/sports-markets');
  const raw = wsData?.markets || httpData?.markets || [];
  const items = raw.slice(0, 12);

  if (!items.length) return null;

  const all = [...items, ...items]; // duplicate for seamless loop

  return (
    <div className="ticker-container" style={{
      height: 24, background: 'var(--bg-panel)',
      borderBottom: '1px solid var(--border)',
      overflow: 'hidden', flexShrink: 0,
    }}>
      <div className="ticker-track">
        {all.map((m, i) => {
          const yes = m.yes_price ?? 50;
          const priceColor = yes > 65 ? 'var(--positive)' : yes < 35 ? 'var(--negative)' : 'var(--text-secondary)';
          return (
            <span key={`${m.id}-${i}`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '0 20px', height: 24, whiteSpace: 'nowrap',
              borderRight: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 8, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                {m.sport_tag}
              </span>
              <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-secondary)' }}>
                {(m.title || '').slice(0, 32)}
              </span>
              <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: priceColor }}>
                {yes}¢
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
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
      <div style={{
        padding: '10px 12px 6px',
        fontSize: 9, fontFamily: 'var(--font-display)', fontWeight: 700,
        color: 'var(--text-muted)', letterSpacing: '0.14em',
        borderBottom: '1px solid var(--border)',
      }}>
        LEAGUES
      </div>

      {SPORTS.map(s => {
        const score = s.id === 'All' ? null : heatScores[s.id];
        const heatCol = heatColor(score);
        const isActive = activeSport === s.id;
        const sportColor = s.color || 'var(--brand)';

        return (
          <button key={s.id} onClick={() => onSportChange(s.id)} style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '8px 12px 8px 9px',
            background: isActive ? 'rgba(255,255,255,0.03)' : 'transparent',
            borderLeft: isActive ? `3px solid ${sportColor}` : '3px solid transparent',
            borderTop: 'none', borderRight: 'none', borderBottom: 'none',
            cursor: 'pointer', transition: 'background 0.1s',
            width: '100%',
          }}>
            <span style={{
              flex: 1, textAlign: 'left',
              fontSize: 12, letterSpacing: '0.04em',
              fontFamily: isActive ? 'var(--font-display)' : 'var(--font-sans)',
              fontWeight: isActive ? 700 : 400,
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}>
              {s.label}
            </span>
            {score != null && (
              <span style={{
                fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700,
                color: heatCol, letterSpacing: '-0.02em',
              }}>
                {score}
              </span>
            )}
          </button>
        );
      })}

      {lastUpdated && (
        <div style={{
          marginTop: 'auto', padding: '8px 12px',
          fontSize: 8, fontFamily: 'var(--mono)', color: 'var(--text-muted)',
          borderTop: '1px solid var(--border)', letterSpacing: '0.06em',
        }}>
          UPDATED {secs}s AGO
        </div>
      )}
    </aside>
  );
}

// ── Cold Start Banner ─────────────────────────────────────────────────────────

function ColdStartBanner({ onDismiss }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '3px 14px',
      background: 'rgba(192,57,43,0.06)', borderBottom: '1px solid rgba(192,57,43,0.15)',
      color: 'var(--text-muted)', fontSize: 9, fontFamily: 'var(--mono)',
      letterSpacing: '0.06em', flexShrink: 0,
    }}>
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--brand)', opacity: 0.6 }} />
      WARMING UP — FIRST LOAD MAY TAKE A MOMENT
      <button onClick={onDismiss} style={{
        marginLeft: 'auto', background: 'none', border: 'none',
        color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, lineHeight: 1,
        padding: '0 2px',
      }}>✕</button>
    </div>
  );
}
