import React, { useState, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { useWebSocket } from '../hooks/useWebSocket';

const SPORTS = [
  { id: 'nba',    label: 'NBA',    icon: '🏀' },
  { id: 'nfl',    label: 'NFL',    icon: '🏈' },
  { id: 'mlb',    label: 'MLB',    icon: '⚾' },
  { id: 'soccer', label: 'Soccer', icon: '⚽' },
  { id: 'f1',     label: 'F1',     icon: '🏎' },
  { id: 'tennis', label: 'Tennis', icon: '🎾' },
];

function tokenize(str) {
  return (str || '').toLowerCase().split(/\W+/).filter(w => w.length >= 4 && !['team', 'city', 'wins', 'game'].includes(w));
}

function findWinMarket(game, markets) {
  const tokens = new Set([...tokenize(game.home || game.home_team), ...tokenize(game.away || game.away_team)]);
  if (!tokens.size) return null;
  for (const m of markets) {
    const mt = (m.title || '').toLowerCase();
    if ([...tokens].some(t => mt.includes(t))) return m;
  }
  return null;
}

function fmtTime(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return null; }
}

function fmtDate(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'TODAY';
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (d.toDateString() === tomorrow.toDateString()) return 'TOMORROW';
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  } catch { return null; }
}

export default function ScoresTab() {
  const [activeSport, setActiveSport] = useState('nba');
  const wsData = useWebSocket();
  const { data: marketsHttp } = useApi('/api/kalshi/sports-markets');
  const markets = wsData?.markets || marketsHttp?.markets || [];

  return (
    <div>
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
        {SPORTS.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSport(s.id)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-mono font-semibold border transition-all shrink-0 ${
              activeSport === s.id
                ? 'bg-accent border-accent text-white'
                : 'bg-card border-border text-muted hover:text-label hover:border-label'
            }`}
          >
            <span>{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>

      <ScoreBoard sport={activeSport} markets={markets} />
    </div>
  );
}

function ScoreBoard({ sport, markets }) {
  const { data, loading, error } = useApi(`/api/scores/${sport}`, [sport]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-20 rounded" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-muted font-mono text-xs py-8 text-center">SCORES UNAVAILABLE</p>
    );
  }

  const live     = data?.live     || [];
  const upcoming = data?.upcoming || [];
  const final    = data?.final    || [];

  if (live.length === 0 && upcoming.length === 0 && final.length === 0) {
    return (
      <p className="text-muted font-mono text-xs py-12 text-center">
        NO GAMES SCHEDULED · Check back later
      </p>
    );
  }

  // F1 uses a flat card layout
  if (sport === 'f1') {
    const all = data?.games || [];
    return (
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        {all.map(g => <F1Card key={g.id} session={g} />)}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {live.length > 0 && (
        <Section label="LIVE NOW" accent>
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            {live.map(g => <LiveCard key={g.id} game={g} markets={markets} />)}
          </div>
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section label="UPCOMING">
          <UpcomingList games={upcoming} markets={markets} />
        </Section>
      )}

      {final.length > 0 && (
        <Section label="RECENT RESULTS">
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            {final.slice(0, 3).map(g => <FinalCard key={g.id} game={g} markets={markets} />)}
          </div>
        </Section>
      )}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function Section({ label, accent, children }) {
  return (
    <div>
      <div className={`flex items-center gap-2 mb-3 pb-1.5 border-b ${accent ? 'border-accent/40' : 'border-border'}`}>
        {accent && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
        <span className={`text-xs font-mono font-semibold tracking-widest ${accent ? 'text-red-400' : 'text-accent'}`}>
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

// ── Live card ─────────────────────────────────────────────────────────────────

function LiveCard({ game, markets }) {
  const winMarket = useMemo(() => findWinMarket(game, markets), [game, markets]);
  const home = game.home || game.home_team;
  const away = game.away || game.away_team;
  const homeScore = game.homeScore ?? game.home_score;
  const awayScore = game.awayScore ?? game.away_score;

  return (
    <div className="bg-card border border-accent/40 rounded p-4 live-indicator">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        <span className="text-[9px] font-mono text-red-400 font-bold tracking-widest">LIVE</span>
        {game.clock && <span className="text-[9px] font-mono text-muted ml-1">{game.clock}</span>}
      </div>

      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-gray-200 truncate flex-1">{away}</span>
        <span className="font-mono font-bold text-lg ml-2 tabular-nums text-gray-100">{awayScore}</span>
      </div>
      <div className="border-t border-border my-1.5" />
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-200 truncate flex-1">{home}</span>
        <span className="font-mono font-bold text-lg ml-2 tabular-nums text-gray-100">{homeScore}</span>
      </div>

      {game.broadcast && (
        <div className="mt-2 text-[9px] font-mono text-muted">{game.broadcast}</div>
      )}

      {winMarket && <WinProbRow market={winMarket} />}
    </div>
  );
}

// ── Upcoming list ─────────────────────────────────────────────────────────────

function UpcomingList({ games, markets }) {
  const [showAll, setShowAll] = useState(false);
  const MAX = 6;
  const shown = showAll ? games : games.slice(0, MAX);

  return (
    <div>
      <div className="space-y-2">
        {shown.map(g => <UpcomingCard key={g.id} game={g} markets={markets} />)}
      </div>
      {games.length > MAX && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-3 text-xs font-mono text-accent hover:text-white transition-colors"
        >
          Show {games.length - MAX} more →
        </button>
      )}
    </div>
  );
}

function UpcomingCard({ game, markets }) {
  const winMarket = useMemo(() => findWinMarket(game, markets), [game, markets]);
  const home = game.home || game.home_team;
  const away = game.away || game.away_team;
  const startIso = game.startTime || game.start_time;
  const dayLabel = fmtDate(startIso);
  const timeLabel = fmtTime(startIso);
  const sport = (game.sport || '').toUpperCase();

  return (
    <div className="bg-card border border-border rounded p-3 hover:border-border-hover transition-colors">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {dayLabel && <span className="text-[9px] font-mono text-muted">{dayLabel}</span>}
          {timeLabel && <span className="text-[10px] font-mono text-label font-semibold">{timeLabel}</span>}
        </div>
        {sport && (
          <span className="text-[9px] font-mono text-muted border border-border rounded px-1.5 py-0.5">{sport}</span>
        )}
      </div>

      <div className="text-sm text-gray-200 truncate">{away}</div>
      <div className="text-sm text-gray-200 truncate">{home}</div>

      {game.broadcast && (
        <div className="mt-1.5 text-[9px] font-mono text-muted">{game.broadcast}</div>
      )}

      {winMarket && (
        <div className="mt-2 pt-1.5 border-t border-border">
          <span className="text-[9px] font-mono text-positive">Kalshi YES {winMarket.yes_price}¢</span>
        </div>
      )}
    </div>
  );
}

// ── Final card ────────────────────────────────────────────────────────────────

function FinalCard({ game, markets }) {
  const winMarket = useMemo(() => findWinMarket(game, markets), [game, markets]);
  const home = game.home || game.home_team;
  const away = game.away || game.away_team;
  const homeScore = parseInt(game.homeScore ?? game.home_score) || 0;
  const awayScore = parseInt(game.awayScore ?? game.away_score) || 0;
  const homeWin = homeScore > awayScore;
  const awayWin = awayScore > homeScore;

  return (
    <div className="bg-card border border-border rounded p-4 opacity-70">
      <div className="text-[9px] font-mono text-muted mb-2 tracking-widest">FINAL</div>

      <div className={`flex justify-between items-center mb-1 ${!awayWin ? 'opacity-50' : ''}`}>
        <span className={`text-sm truncate flex-1 ${awayWin ? 'text-white font-semibold' : 'text-gray-400'}`}>{away}</span>
        <span className={`font-mono font-bold text-lg ml-2 tabular-nums ${awayWin ? 'text-positive' : 'text-gray-400'}`}>{awayScore}</span>
      </div>
      <div className="border-t border-border my-1.5" />
      <div className={`flex justify-between items-center ${!homeWin ? 'opacity-50' : ''}`}>
        <span className={`text-sm truncate flex-1 ${homeWin ? 'text-white font-semibold' : 'text-gray-400'}`}>{home}</span>
        <span className={`font-mono font-bold text-lg ml-2 tabular-nums ${homeWin ? 'text-positive' : 'text-gray-400'}`}>{homeScore}</span>
      </div>

      {winMarket && <WinProbRow market={winMarket} />}
    </div>
  );
}

// ── Kalshi row ────────────────────────────────────────────────────────────────

function WinProbRow({ market }) {
  const yes = market.yes_price ?? 50;
  const no  = market.no_price  ?? (100 - yes);
  return (
    <div className="mt-2 pt-2 border-t border-accent/20">
      <div className="text-[9px] font-mono text-accent tracking-widest mb-1">KALSHI MARKET ODDS</div>
      <div className="flex h-1.5 rounded overflow-hidden gap-px mb-1">
        <div className="bg-positive" style={{ width: `${yes}%` }} />
        <div className="bg-negative" style={{ width: `${Math.max(0, 100 - yes)}%` }} />
      </div>
      <div className="flex justify-between text-[9px] font-mono">
        <span className="text-positive">YES {yes}¢</span>
        <span className="text-muted truncate mx-2 flex-1 text-center" title={market.title}>{market.title?.slice(0, 28)}…</span>
        <span className="text-negative">NO {no}¢</span>
      </div>
    </div>
  );
}

// ── F1 card (special layout) ──────────────────────────────────────────────────

function F1Card({ session }) {
  const startDate = session.startTime || session.start_time ? new Date(session.startTime || session.start_time) : null;
  const status = session.status || (session.isLive ? 'live' : session.isFinal ? 'final' : 'upcoming');

  return (
    <div className={`bg-card border rounded p-4 ${status === 'live' ? 'border-accent/50 live-indicator' : 'border-border'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[10px] font-mono text-muted mb-0.5">FORMULA 1 · 2026</div>
          <p className="text-sm font-semibold text-gray-100 leading-snug">{session.home || session.name}</p>
        </div>
        <StatusPill status={status} />
      </div>

      {session.venue && (
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted mt-2">
          <span>🏁</span>
          <span>{session.venue}</span>
          {session.country && <span>· {session.country}</span>}
        </div>
      )}

      {startDate && (
        <div className="mt-2 text-[10px] font-mono text-muted">
          {startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          {' · '}
          {startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }) {
  if (status === 'live')
    return <span className="text-[9px] font-mono font-bold text-positive border border-positive/40 bg-positive/10 rounded px-1.5 py-0.5 tracking-widest">LIVE</span>;
  if (status === 'final')
    return <span className="text-[9px] font-mono font-bold text-muted border border-muted/40 bg-muted/10 rounded px-1.5 py-0.5 tracking-widest">FINAL</span>;
  return <span className="text-[9px] font-mono font-bold text-accent border border-accent/40 bg-accent/10 rounded px-1.5 py-0.5 tracking-widest">SCHED</span>;
}
