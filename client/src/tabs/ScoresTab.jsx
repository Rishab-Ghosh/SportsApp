import React, { useState, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { useWebSocket } from '../hooks/useWebSocket';
import { SkeletonCard } from '../components/Skeleton';

const SPORTS = [
  { id: 'nba', label: 'NBA', icon: '🏀' },
  { id: 'nfl', label: 'NFL', icon: '🏈' },
  { id: 'mlb', label: 'MLB', icon: '⚾' },
  { id: 'soccer', label: 'Soccer', icon: '⚽' },
  { id: 'f1', label: 'F1', icon: '🏎' },
];

// Try to match a game to a Kalshi market by overlapping team/location tokens
function findWinMarket(game, markets) {
  const homeTokens = tokenize(game.home_team);
  const awayTokens = tokenize(game.away_team);
  const teamTokens = new Set([...homeTokens, ...awayTokens]);
  if (teamTokens.size === 0) return null;

  for (const m of markets) {
    const mt = (m.title || '').toLowerCase();
    if ([...teamTokens].some(t => mt.includes(t))) return m;
  }
  return null;
}

function tokenize(str) {
  return (str || '')
    .toLowerCase()
    .split(/\W+/)
    .filter(w => w.length >= 4 && !['team', 'city', 'wins', 'game'].includes(w));
}

export default function ScoresTab() {
  const [activeSport, setActiveSport] = useState('nba');

  // Kalshi markets: prefer WS data, fall back to HTTP
  const wsData = useWebSocket();
  const { data: marketsHttpData } = useApi('/api/kalshi/sports-markets');
  const markets = wsData?.markets || marketsHttpData?.markets || [];

  return (
    <div>
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
        {SPORTS.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSport(s.id)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-mono font-semibold border transition-all ${
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
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} lines={5} />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-negative/10 border border-negative/30 rounded text-negative text-xs font-mono">
        Failed to load {sport.toUpperCase()} scores: {error}
      </div>
    );
  }

  const games = data?.games || [];

  if (games.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-4xl mb-3">{SPORTS.find(s => s.id === sport)?.icon}</div>
        <p className="text-muted font-mono text-sm">No {sport.toUpperCase()} games scheduled</p>
        <p className="text-muted font-mono text-xs mt-1">Check back during the season</p>
      </div>
    );
  }

  if (sport === 'f1') {
    return (
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        {games.map(g => <F1Card key={g.id} session={g} />)}
      </div>
    );
  }

  const live = games.filter(g => g.is_live);
  const final = games.filter(g => g.is_final);
  const scheduled = games.filter(g => !g.is_live && !g.is_final);

  return (
    <div className="space-y-6">
      {live.length > 0 && <ScoreSection label="LIVE NOW" games={live} markets={markets} accent />}
      {scheduled.length > 0 && <ScoreSection label="UPCOMING" games={scheduled} markets={markets} />}
      {final.length > 0 && <ScoreSection label="FINAL" games={final} markets={markets} />}
    </div>
  );
}

function ScoreSection({ label, games, markets, accent }) {
  return (
    <div>
      <div className={`flex items-center gap-2 mb-3 pb-1.5 border-b ${accent ? 'border-accent/40' : 'border-border'}`}>
        {accent && <span className="w-1.5 h-1.5 rounded-full bg-positive animate-pulse" />}
        <span className={`text-xs font-mono font-semibold tracking-widest ${accent ? 'text-positive' : 'text-accent'}`}>
          {label}
        </span>
        <span className="text-[10px] text-muted font-mono ml-1">({games.length})</span>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        {games.map(g => <GameCard key={g.id} game={g} markets={markets} live={accent} />)}
      </div>
    </div>
  );
}

function GameCard({ game, markets, live }) {
  const homeWin = parseInt(game.home_score) > parseInt(game.away_score);
  const awayWin = parseInt(game.away_score) > parseInt(game.home_score);
  const isFinal = game.is_final;

  const winMarket = useMemo(() => findWinMarket(game, markets), [game, markets]);

  return (
    <div className={`bg-card border rounded p-4 ${live ? 'border-accent/40 live-indicator' : 'border-border'}`}>
      {live && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-positive animate-pulse" />
          <span className="text-[9px] font-mono text-positive font-bold tracking-widest">LIVE</span>
        </div>
      )}

      {/* Away team */}
      <div className={`flex items-center justify-between mb-1.5 ${awayWin && isFinal ? 'opacity-100' : isFinal ? 'opacity-50' : ''}`}>
        {game.away_logo ? (
          <img src={game.away_logo} alt="" className="w-5 h-5 object-contain mr-2 opacity-90" />
        ) : null}
        <span className={`text-sm flex-1 truncate ${awayWin && isFinal ? 'text-white font-semibold' : 'text-gray-300'}`}>
          {game.away_team}
        </span>
        <span className={`font-mono font-bold text-lg ml-3 tabular-nums ${awayWin && isFinal ? 'text-positive' : 'text-gray-200'}`}>
          {game.away_score}
        </span>
      </div>

      {/* Divider */}
      <div className="border-t border-border my-2" />

      {/* Home team */}
      <div className={`flex items-center justify-between ${homeWin && isFinal ? 'opacity-100' : isFinal ? 'opacity-50' : ''}`}>
        {game.home_logo ? (
          <img src={game.home_logo} alt="" className="w-5 h-5 object-contain mr-2 opacity-90" />
        ) : null}
        <span className={`text-sm flex-1 truncate ${homeWin && isFinal ? 'text-white font-semibold' : 'text-gray-300'}`}>
          {game.home_team}
        </span>
        <span className={`font-mono font-bold text-lg ml-3 tabular-nums ${homeWin && isFinal ? 'text-positive' : 'text-gray-200'}`}>
          {game.home_score}
        </span>
      </div>

      {/* Status footer */}
      <div className="mt-3 pt-2 border-t border-border flex items-center justify-between">
        <span className="text-[10px] font-mono text-muted">{game.status}</span>
        {game.venue && (
          <span className="text-[10px] font-mono text-muted truncate ml-2 max-w-[120px]">{game.venue}</span>
        )}
      </div>

      {/* Kalshi win probability — only when a matching market exists */}
      {winMarket && (
        <WinProbRow market={winMarket} />
      )}
    </div>
  );
}

function WinProbRow({ market }) {
  const yes = market.yes_price ?? 50;
  const no = market.no_price ?? (100 - yes);

  return (
    <div className="mt-2 pt-2 border-t border-accent/20">
      <div className="text-[9px] font-mono text-accent tracking-widest mb-1.5">KALSHI MARKET ODDS</div>
      <div className="flex h-1.5 rounded overflow-hidden gap-px mb-1">
        <div className="bg-positive" style={{ width: `${yes}%` }} />
        <div className="bg-negative" style={{ width: `${Math.max(0, 100 - yes)}%` }} />
      </div>
      <div className="flex justify-between text-[9px] font-mono">
        <span className="text-positive">YES {yes}¢</span>
        <span className="text-muted truncate mx-2 flex-1 text-center" title={market.title}>{market.title?.slice(0, 30)}…</span>
        <span className="text-negative">NO {no}¢</span>
      </div>
    </div>
  );
}

function F1Card({ session }) {
  const isPast = session.is_final;
  const isLive = session.is_live;
  const startDate = session.start_time ? new Date(session.start_time) : null;

  return (
    <div className={`bg-card border rounded p-4 ${isLive ? 'border-accent/50 live-indicator' : 'border-border'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[10px] font-mono text-muted mb-0.5">FORMULA 1 · 2025</div>
          <p className="text-sm font-semibold text-gray-100 leading-snug">{session.name}</p>
        </div>
        <StatusBadge live={isLive} final={isPast} />
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

function StatusBadge({ live, final }) {
  if (live) return (
    <span className="text-[9px] font-mono font-bold text-positive border border-positive/40 bg-positive/10 rounded px-1.5 py-0.5 tracking-widest">LIVE</span>
  );
  if (final) return (
    <span className="text-[9px] font-mono font-bold text-muted border border-muted/40 bg-muted/10 rounded px-1.5 py-0.5 tracking-widest">FINAL</span>
  );
  return (
    <span className="text-[9px] font-mono font-bold text-accent border border-accent/40 bg-accent/10 rounded px-1.5 py-0.5 tracking-widest">SCHED</span>
  );
}
