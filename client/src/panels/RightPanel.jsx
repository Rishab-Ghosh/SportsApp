import React, { useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { useWebSocket } from '../hooks/useWebSocket';

// Generate fake sparkline history by walking backward from current price
function fakeSparkline(currentPrice, n = 20) {
  const pts = [currentPrice];
  for (let i = 1; i < n; i++) {
    const prev = pts[pts.length - 1];
    const delta = (Math.random() - 0.48) * 4;
    pts.push(Math.min(99, Math.max(1, Math.round(prev - delta))));
  }
  return pts.reverse();
}

function Sparkline({ price, width = 48, height = 32 }) {
  const pts = useMemo(() => fakeSparkline(price), [price]);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const step = width / (pts.length - 1);
  const coords = pts.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });
  const pathD = 'M ' + coords.join(' L ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={coords.join(' ')} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Right Panel ───────────────────────────────────────────────────────────────

export default function RightPanel() {
  return (
    <aside style={{
      width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: 'var(--bg-panel)', borderLeft: '1px solid var(--border)',
      overflowY: 'auto',
    }}>
      <KalshiSection />
      <LiveScoresSection />
    </aside>
  );
}

// ── Kalshi Markets (top half) ─────────────────────────────────────────────────

function KalshiSection() {
  const wsData = useWebSocket();
  const { data: httpData } = useApi('/api/kalshi/sports-markets');
  const raw = wsData?.markets || httpData?.markets || [];
  const markets = useMemo(() =>
    [...raw].sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 10),
    [raw]
  );

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <PanelHeader label="KALSHI MARKETS" sub="prediction · by volume" />
      <div style={{ padding: '0 0 8px' }}>
        {markets.length === 0 ? (
          <PanelEmpty msg="No market data" />
        ) : (
          markets.map(m => <KalshiCard key={m.id} market={m} />)
        )}
      </div>
    </div>
  );
}

function KalshiCard({ market }) {
  const yes = market.yes_price ?? 50;
  const prev = market.yes_prev ?? yes;
  const delta = yes - prev;
  const vol = market.volume || 0;

  const closeLabel = (() => {
    if (!market.close_time) return null;
    const diff = new Date(market.close_time) - Date.now();
    if (diff < 0) return 'Closed';
    const days = Math.floor(diff / 86400000);
    if (days > 0) return `${days}d`;
    return `${Math.floor(diff / 3600000)}h`;
  })();

  return (
    <div style={{
      padding: '10px 12px',
      borderBottom: '1px solid var(--border)',
      transition: 'background 0.12s',
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {/* Title */}
      <p style={{
        fontSize: 10, color: 'var(--text-muted)', marginBottom: 6,
        lineHeight: '1.4', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {market.title}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        {/* YES% large */}
        <span style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, color: 'var(--green)', lineHeight: 1 }}>
          {yes}<span style={{ fontSize: 11 }}>¢</span>
        </span>

        {/* Delta badge */}
        {delta !== 0 && (
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600,
            color: delta > 0 ? 'var(--green)' : 'var(--red)',
          }}>
            {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
          </span>
        )}

        {/* Sparkline */}
        <Sparkline price={yes} />
      </div>

      {/* Odds bar */}
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginBottom: 5 }}>
        <div style={{ height: '100%', width: `${yes}%`, background: 'var(--green)', borderRadius: 2 }} />
      </div>

      {/* Vol + close */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>
        <span>VOL <span style={{ color: 'var(--text-secondary)' }}>{fmtVol(vol)}</span></span>
        {closeLabel && <span>CLOSES <span style={{ color: 'var(--text-secondary)' }}>{closeLabel}</span></span>}
      </div>
    </div>
  );
}

// ── Live Scores (bottom half) ─────────────────────────────────────────────────

const SCORE_SPORTS = ['nba', 'nfl', 'mlb', 'soccer'];

function LiveScoresSection() {
  return (
    <div>
      <PanelHeader label="LIVE SCORES" sub="ESPN · active games" />
      {SCORE_SPORTS.map(s => <SportScores key={s} sport={s} />)}
    </div>
  );
}

function SportScores({ sport }) {
  const { data } = useApi(`/api/scores/${sport}`, [sport]);
  const wsData = useWebSocket();
  const { data: marketsHttp } = useApi('/api/kalshi/sports-markets');
  const markets = wsData?.markets || marketsHttp?.markets || [];

  const games = data?.games || [];
  const live = games.filter(g => g.is_live);
  const upcoming = games.filter(g => !g.is_live && !g.is_final).slice(0, 2);
  const shown = [...live, ...upcoming].slice(0, 3);

  if (shown.length === 0) return null;

  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <div style={{ padding: '6px 12px 2px', fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        {sport}
      </div>
      {shown.map(g => <ScoreRow key={g.id} game={g} markets={markets} />)}
    </div>
  );
}

function ScoreRow({ game, markets }) {
  const isLive = game.is_live;
  const winMarket = useMemo(() => findWinMarket(game, markets), [game, markets]);

  return (
    <div style={{
      padding: '6px 12px',
      borderBottom: '1px solid rgba(30,45,64,0.6)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        {isLive && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%', background: 'var(--red)',
              animation: 'pulse 1s infinite',
            }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--red)', fontWeight: 700 }}>LIVE</span>
          </span>
        )}
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-muted)' }}>{game.status}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', truncate: true, maxWidth: '80%', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {game.away_team}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
          {game.away_score}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: '80%', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {game.home_team}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
          {game.home_score}
        </span>
      </div>

      {winMarket && (
        <div style={{ marginTop: 4, fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--green)' }}>
          Kalshi: YES {winMarket.yes_price}¢
        </div>
      )}
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function PanelHeader({ label, sub }) {
  return (
    <div style={{
      padding: '10px 12px 8px',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.12em' }}>{label}</div>
      {sub && <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function PanelEmpty({ msg }) {
  return (
    <div style={{ padding: '16px 12px', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
      {msg}
    </div>
  );
}

function fmtVol(v) {
  if (!v) return '—';
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
  return `$${v}`;
}

function tokenize(str) {
  return (str || '').toLowerCase().split(/\W+/).filter(w => w.length >= 4 && !['team', 'city', 'wins', 'game'].includes(w));
}

function findWinMarket(game, markets) {
  const tokens = new Set([...tokenize(game.home_team), ...tokenize(game.away_team)]);
  if (!tokens.size) return null;
  for (const m of markets) {
    const mt = (m.title || '').toLowerCase();
    if ([...tokens].some(t => mt.includes(t))) return m;
  }
  return null;
}
