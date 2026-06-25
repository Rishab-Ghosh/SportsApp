
import React, { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { useApi } from '../hooks/useApi';
import { useWebSocket } from '../hooks/useWebSocket';

const BASE = import.meta.env.VITE_API_BASE_URL || '';

export default function RightPanel({ compact = false, stacked = false }) {
  return (
    <aside style={{
      width: compact ? '100%' : 256,
      flexShrink: 0,
      display: 'flex',
      flexDirection: compact ? (stacked ? 'column' : 'row') : 'column',
      gap: compact ? 10 : 0,
      background: 'var(--bg-panel)',
      borderLeft: compact ? 'none' : '1px solid var(--border)',
      borderTop: compact ? '1px solid var(--border)' : 'none',
      overflowY: compact ? 'visible' : 'auto',
      padding: compact ? 10 : 0,
    }}>
      <KalshiSection compact={compact} />
      <LiveScoresSection compact={compact} />
    </aside>
  );
}

function KalshiSection({ compact }) {
  const wsData = useWebSocket();
  const { data: httpData } = useApi('/api/kalshi/sports-markets');
  const raw = wsData?.markets || httpData?.markets || [];
  const markets = useMemo(
    () => [...raw].sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, compact ? 6 : 12),
    [raw, compact]
  );

  return (
    <section style={{
      borderBottom: compact ? 'none' : '1px solid var(--border)',
      border: compact ? '1px solid var(--border)' : 'none',
      flex: compact ? '1 1 0' : 'initial',
      minWidth: compact ? 0 : 'auto',
      background: compact ? 'var(--bg-panel)' : 'transparent',
    }}>
      <PanelHeader label="MARKETS" sub="Kalshi · live paths" />
      <div>
        {markets.length === 0
          ? <PanelEmpty msg="Warming up…" />
          : markets.map(m => <KalshiCard key={m.id} market={m} />)
        }
      </div>
    </section>
  );
}

function KalshiCard({ market }) {
  const yes = market.yes_price ?? 50;
  const prev = market.yes_prev ?? yes;
  const delta = yes - prev;
  const vol = market.volume || 0;
  const closeLabel = getCloseLabel(market.close_time);

  return (
    <div
      style={{
        padding: '10px 10px 9px',
        borderBottom: '1px solid rgba(40,40,40,0.8)',
        transition: 'background 0.1s, border-color 0.1s',
        cursor: 'default',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        {market.sport_tag && (
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: 8, fontWeight: 800,
            letterSpacing: '0.14em', color: 'var(--accent)',
          }}>
            {market.sport_tag}
          </span>
        )}
        {delta !== 0 && (
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 800,
            color: delta > 0 ? 'var(--positive)' : 'var(--negative)',
            marginLeft: 'auto', letterSpacing: '0.04em',
          }}>
            {delta > 0 ? '▲' : '▼'}{Math.abs(delta)}¢
          </span>
        )}
        {delta === 0 && closeLabel && (
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text-muted)' }}>{closeLabel}</span>
        )}
      </div>

      <p style={{
        fontSize: 10, color: 'var(--text-secondary)', marginBottom: 8,
        lineHeight: '1.35', fontFamily: 'var(--font-sans)',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {market.title}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '58px 1fr', gap: 8, alignItems: 'end', marginBottom: 7 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 900,
              color: yes >= prev ? 'var(--positive)' : 'var(--negative)', lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {yes}
            </span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text-muted)' }}>¢</span>
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text-muted)', marginTop: 2 }}>YES</div>
        </div>
        <MiniMarketChart market={market} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `${Math.max(1, yes)}fr ${Math.max(1, 100 - yes)}fr`, height: 4, background: 'var(--border)', overflow: 'hidden', marginBottom: 5 }}>
        <div style={{ background: 'var(--positive)' }} />
        <div style={{ background: 'rgba(231,76,60,0.8)' }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 8, fontFamily: 'var(--mono)', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
        <span>VOL <span style={{ color: 'var(--text-secondary)' }}>{fmtVol(vol)}</span></span>
        <span>NO <span style={{ color: 'var(--negative)' }}>{100 - yes}¢</span></span>
        {closeLabel && <span>{closeLabel}</span>}
      </div>
    </div>
  );
}

function MiniMarketChart({ market }) {
  const yes = market.yes_price ?? 50;
  const [points, setPoints] = useState(null);
  const [source, setSource] = useState('fallback');

  useEffect(() => {
    if (!market.id) return;
    let cancelled = false;
    setPoints(null);
    setSource('loading');
    const controller = new AbortController();

    fetch(`${BASE}/api/kalshi/market/${encodeURIComponent(market.id)}/history?range=7d`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : { points: [] })
      .then(data => {
        if (cancelled) return;
        const fetched = (data.points || []).filter(p => p.price != null);
        if (fetched.length >= 2) {
          setPoints(fetched);
          setSource(data.source || 'history');
        } else {
          setPoints(buildFallbackSeries(market));
          setSource('estimated');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPoints(buildFallbackSeries(market));
          setSource('estimated');
        }
      });

    return () => { cancelled = true; controller.abort(); };
  }, [market.id, yes]);

  const chartPoints = points || buildFallbackSeries(market);
  const start = chartPoints[0]?.price ?? yes;
  const end = chartPoints[chartPoints.length - 1]?.price ?? yes;
  const up = end >= start;
  const color = up ? 'var(--positive)' : 'var(--negative)';
  const gradId = `mini-${String(market.id || 'm').replace(/[^a-zA-Z0-9_-]/g, '')}`;

  return (
    <div style={{ height: 58, position: 'relative', minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartPoints} margin={{ top: 5, right: 0, bottom: 1, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={up ? '#22c55e' : '#ef4444'} stopOpacity={0.28} />
              <stop offset="100%" stopColor={up ? '#22c55e' : '#ef4444'} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <YAxis hide domain={[dataMin => Math.max(0, Math.floor(dataMin - 4)), dataMax => Math.min(100, Math.ceil(dataMax + 4))]} />
          <Tooltip content={<MiniTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }} />
          <Area type="monotone" dataKey="price" stroke={color} strokeWidth={1.4} fill={`url(#${gradId})`} dot={false} activeDot={{ r: 2.5, fill: color }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
      {source === 'estimated' && (
        <span style={{ position: 'absolute', right: 1, top: 0, fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--text-muted)', opacity: 0.65 }}>EST</span>
      )}
    </div>
  );
}

function MiniTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#151515', border: '1px solid var(--border)', padding: '4px 6px', fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-primary)' }}>
      {payload[0].value}¢ YES
    </div>
  );
}

const SCORE_SPORTS = ['nba', 'nfl', 'mlb', 'soccer'];

function LiveScoresSection({ compact }) {
  return (
    <section style={{
      flex: compact ? '1 1 0' : 'initial',
      minWidth: compact ? 0 : 'auto',
      border: compact ? '1px solid var(--border)' : 'none',
      background: compact ? 'var(--bg-panel)' : 'transparent',
    }}>
      <PanelHeader label="SCORES" sub="ESPN · live & upcoming" />
      {SCORE_SPORTS.map(s => <SportScores key={s} sport={s} />)}
    </section>
  );
}

function SportScores({ sport }) {
  const { data } = useApi(`/api/scores/${sport}`, [sport]);
  const wsData = useWebSocket();
  const { data: marketsHttp } = useApi('/api/kalshi/sports-markets');
  const markets = wsData?.markets || marketsHttp?.markets || [];

  const live = data?.live || [];
  const upcoming = (data?.upcoming || []).slice(0, 2);
  const shown = live.length > 0 ? live.slice(0, 3) : upcoming;

  if (!shown.length) return null;

  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <div style={{
        padding: '5px 10px 3px',
        fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 800,
        color: 'var(--text-muted)', letterSpacing: '0.14em',
        textTransform: 'uppercase',
      }}>
        {sport}
      </div>
      {shown.map(g => <ScoreRow key={g.id} game={g} markets={markets} />)}
    </div>
  );
}

function fmtTime(iso) {
  if (!iso) return null;
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return null; }
}

function ScoreRow({ game, markets }) {
  const isLive = game.isLive || game.is_live;
  const isUpcoming = !game.is_live && !game.is_final && !game.isLive && !game.isFinal;
  const winMarket = useMemo(() => findWinMarket(game, markets), [game, markets]);
  const home = game.home || game.home_team || '—';
  const away = game.away || game.away_team || '—';
  const homeScore = game.homeScore ?? game.home_score;
  const awayScore = game.awayScore ?? game.away_score;
  const startIso = game.startTime || game.start_time;

  return (
    <div style={{ padding: '5px 10px 6px', borderBottom: '1px solid rgba(40,40,40,0.6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
        {isLive && (
          <>
            <span className="live-dot" style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--negative)', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 8, fontWeight: 800, color: 'var(--negative)', letterSpacing: '0.12em' }}>LIVE</span>
            {game.clock && <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text-muted)' }}>{game.clock}</span>}
          </>
        )}
        {isUpcoming && startIso && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-secondary)' }}>{fmtTime(startIso)}</span>
        )}
      </div>

      {[{ team: away, score: awayScore }, { team: home, score: homeScore }].map(({ team, score }, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 1 }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 600,
            color: 'var(--text-secondary)', letterSpacing: '0.01em',
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '76%',
            textTransform: 'uppercase',
          }}>
            {team}
          </span>
          {!isUpcoming && score != null && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{score}</span>
          )}
        </div>
      ))}

      {winMarket && (
        <div style={{ marginTop: 3, fontSize: 8, fontFamily: 'var(--mono)', color: 'var(--positive)', letterSpacing: '0.04em' }}>
          KALSHI YES {winMarket.yes_price}¢
        </div>
      )}
    </div>
  );
}

function PanelHeader({ label, sub }) {
  return (
    <div style={{ padding: '9px 10px 6px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.14em' }}>
        {label}
      </div>
      {sub && <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text-muted)', marginTop: 1, letterSpacing: '0.04em' }}>{sub}</div>}
    </div>
  );
}

function PanelEmpty({ msg }) {
  return (
    <div style={{ padding: '14px 10px', fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', letterSpacing: '0.06em' }}>
      {msg}
    </div>
  );
}

function getCloseLabel(ts) {
  if (!ts) return null;
  const diff = new Date(ts) - Date.now();
  if (diff < 0) return 'CLOSED';
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}D`;
  const hours = Math.floor(diff / 3600000);
  return `${Math.max(0, hours)}H`;
}

function fmtVol(v) {
  if (!v) return '—';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < String(str || '').length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rand(seed) {
  let x = seed || 123456;
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return ((x >>> 0) % 1000) / 1000;
  };
}

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function buildFallbackSeries(market) {
  const current = market.yes_price ?? 50;
  const previous = market.yes_prev ?? clamp(current + (current > 50 ? -4 : 4));
  const seedRand = rand(hashSeed(market.id || market.title));
  const now = Date.now();
  const count = 22;
  const start = now - 7 * 86400000;
  const points = [];
  let last = previous;
  for (let i = 0; i < count; i++) {
    const p = i / (count - 1);
    const target = previous + (current - previous) * p;
    const wiggle = (seedRand() - 0.5) * 5;
    last = i === count - 1 ? current : clamp(target * 0.7 + last * 0.3 + wiggle);
    points.push({ t: start + p * (now - start), price: Math.round(last) });
  }
  return points;
}

function tokenize(str) {
  return (str || '').toLowerCase().split(/\W+/).filter(w => w.length >= 4 && !['team','city','wins','game'].includes(w));
}

function findWinMarket(game, markets) {
  const home = game.home || game.home_team || '';
  const away = game.away || game.away_team || '';
  const tokens = new Set([...tokenize(home), ...tokenize(away)]);
  if (!tokens.size) return null;
  for (const m of markets) {
    if ([...tokens].some(t => (m.title || '').toLowerCase().includes(t))) return m;
  }
  return null;
}
