import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import HomeTab from './tabs/HomeTab';
import OddsTab from './tabs/OddsTab';
import TrackerTab from './tabs/TrackerTab';
import NewsTab from './tabs/NewsTab';
import ScoresTab from './tabs/ScoresTab';
import { WebSocketProvider } from './context/WebSocketContext';
import { useWebSocket } from './hooks/useWebSocket';

const TABS = ['Home', 'Odds', 'Tracker', 'News', 'Scores'];

export default function App() {
  const [activeTab, setActiveTab] = useState('Home');

  return (
    <WebSocketProvider>
      <div className="flex h-screen overflow-hidden bg-bg text-gray-200">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} tabs={TABS} />
        <main className="flex-1 overflow-y-auto">
          <Header activeTab={activeTab} />
          <div className="p-4">
            {activeTab === 'Home' && <HomeTab />}
            {activeTab === 'Odds' && <OddsTab />}
            {activeTab === 'Tracker' && <TrackerTab />}
            {activeTab === 'News' && <NewsTab />}
            {activeTab === 'Scores' && <ScoresTab />}
          </div>
        </main>
      </div>
    </WebSocketProvider>
  );
}

function Header({ activeTab }) {
  const now = new Date();
  const ts = now.toLocaleTimeString('en-US', { hour12: false }) + ' EDT';
  const date = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/60 sticky top-0 z-10 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <span className="text-accent font-mono font-semibold text-sm tracking-widest uppercase">SportsPulse</span>
        <span className="text-border">|</span>
        <span className="text-label text-xs font-mono">{activeTab.toUpperCase()}</span>
      </div>
      <div className="flex items-center gap-4 text-xs font-mono text-muted">
        <WsStatus />
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-positive animate-pulse" />
          LIVE
        </span>
        <span>{date}</span>
        <LiveClock />
      </div>
    </div>
  );
}

function WsStatus() {
  const { connected, lastUpdated } = useWebSocket();
  return (
    <span className="flex items-center gap-1" title={connected ? 'WebSocket connected' : 'WebSocket disconnected'}>
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-accent' : 'bg-muted'}`} />
      <span className={connected ? 'text-accent' : 'text-muted'}>WS</span>
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
  return <span className="text-accent">{time} EDT</span>;
}
