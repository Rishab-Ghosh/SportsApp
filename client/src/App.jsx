import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import HomeTab from './tabs/HomeTab';
import OddsTab from './tabs/OddsTab';
import TrackerTab from './tabs/TrackerTab';
import NewsTab from './tabs/NewsTab';
import ScoresTab from './tabs/ScoresTab';
import { WebSocketProvider } from './context/WebSocketContext';
import { useWebSocket } from './hooks/useWebSocket';

const BASE = import.meta.env.VITE_API_BASE_URL || '';
const TABS = ['Home', 'Odds', 'Tracker', 'News', 'Scores'];

export default function App() {
  const [activeTab, setActiveTab] = useState('Home');
  const [slowBanner, setSlowBanner] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // Keep-alive ping every 14 min to prevent Render free-tier sleep
  useEffect(() => {
    const ping = () => fetch(`${BASE}/api/ping`).catch(() => {});
    ping();
    const id = setInterval(ping, 14 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Show cold-start banner after 2s if any data hasn't loaded
  useEffect(() => {
    const timer = setTimeout(() => setSlowBanner(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const dismissBanner = useCallback(() => setSlowBanner(false), []);

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2000);
  }, []);

  return (
    <WebSocketProvider>
      <div className="flex h-screen overflow-hidden bg-bg text-gray-200">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} tabs={TABS} />
        <main className="flex-1 overflow-y-auto min-w-0">
          <Header activeTab={activeTab} onShare={() => {
            navigator.clipboard.writeText(window.location.href).then(() => showToast('Link copied!'));
          }} />
          <ColdStartBanner show={slowBanner} onDismiss={dismissBanner} />
          <div className="p-4">
            {activeTab === 'Home' && <HomeTab onDataLoaded={dismissBanner} />}
            {activeTab === 'Odds' && <OddsTab />}
            {activeTab === 'Tracker' && <TrackerTab />}
            {activeTab === 'News' && <NewsTab />}
            {activeTab === 'Scores' && <ScoresTab />}
          </div>
        </main>
        {toastMsg && (
          <div className="fixed bottom-4 right-4 bg-accent text-white text-xs font-mono px-3 py-2 rounded shadow-lg z-50 animate-fade-in">
            {toastMsg}
          </div>
        )}
      </div>
    </WebSocketProvider>
  );
}

function ColdStartBanner({ show, onDismiss }) {
  if (!show) return null;
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-yellow-900/40 border-b border-yellow-700/40 text-yellow-300 text-[11px] font-mono">
      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse shrink-0" />
      <span>Server waking up — first load may take 30 seconds on the free tier</span>
      <button onClick={onDismiss} className="ml-auto text-yellow-500 hover:text-yellow-200 transition-colors">✕</button>
    </div>
  );
}

function Header({ activeTab, onShare }) {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/60 sticky top-0 z-10 backdrop-blur-sm">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-accent font-mono font-semibold text-sm tracking-widest uppercase shrink-0">SportsPulse</span>
        <span className="text-border shrink-0">|</span>
        <span className="text-label text-xs font-mono truncate">{activeTab.toUpperCase()}</span>
      </div>
      <div className="flex items-center gap-3 text-xs font-mono text-muted shrink-0">
        <WsStatus />
        <LastUpdated />
        <span className="hidden sm:flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-positive animate-pulse" />
          LIVE
        </span>
        <span className="hidden md:block">{date}</span>
        <LiveClock />
        <button
          onClick={onShare}
          title="Copy link"
          className="text-muted hover:text-label transition-colors px-1.5 py-0.5 rounded border border-transparent hover:border-border"
        >
          ⎘
        </button>
      </div>
    </div>
  );
}

function WsStatus() {
  const { connected } = useWebSocket();
  return (
    <span className="flex items-center gap-1" title={connected ? 'WebSocket connected' : 'WebSocket disconnected'}>
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-accent' : 'bg-muted'}`} />
      <span className={connected ? 'text-accent' : 'text-muted'}>WS</span>
    </span>
  );
}

function LastUpdated() {
  const { lastUpdated } = useWebSocket();
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    if (!lastUpdated) return;
    setSecs(0);
    const id = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  if (!lastUpdated) return null;
  return (
    <span className="hidden sm:block text-muted text-[10px]">
      upd {secs}s ago
    </span>
  );
}

function LiveClock() {
  const [time, setTime] = React.useState(() =>
    new Date().toLocaleTimeString('en-US', { hour12: false })
  );
  React.useEffect(() => {
    const id = setInterval(() =>
      setTime(new Date().toLocaleTimeString('en-US', { hour12: false })), 1000
    );
    return () => clearInterval(id);
  }, []);
  return <span className="text-accent hidden sm:block">{time} EDT</span>;
}
