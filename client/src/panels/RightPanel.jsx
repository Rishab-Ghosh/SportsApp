import React, { useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { useWebSocket } from '../hooks/useWebSocket';

// ── Right Panel ───────────────────────────────────────────────────────────────

export default function RightPanel() {
  return (
    <aside style={{
      width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: 'var(--bg-panel)', borderLeft: '1px solid var(--border)',
      overflowY: 'auto',
    }}>
      <KalshiSection />
      <LiveScoresSection />
    </aside>
  );
}

// ── Kalshi Markets ────────────────────────────────────────────────────────────

function KalshiSection() {
  const wsData = useWebSocket();
  const { data: httpData } = useApi('/api/kalshi/sports-markets');
  const raw = wsData?.markets || httpData?.markets || [];
  const markets = useMemo(() =>
    [...raw].sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 12),
    [raw]
  );

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <PanelHeader label="MARKETS" sub="Kalshi · by volume" />
      <div>
        {markets.length === 0
          ? <PanelEmpty msg="No market data" />
          : markets.map(m => <KalshiCard key={m.id} market={m} />)
        }
      </div>
    </div>
  );
}

function KalshiCard({ market }) {
  const yes  = market.yes_price ?? 50;
  const prev = market.yes_prev ?? yes;
  const delta = yes - prev;
  const vol  = market.volume || 0;

  const closeLabel = (() => {
    if (!market.close_time) return null;
    const diff = new Date(market.close_time) - Date.now();
    if (diff < 0) return 'Closed';
    const days = Math.floor(diff / 86400000);
    if (days > 0) return `${days}d`;
    return `${Math.floor(diff / 3600000)}h`;
  })();

  return (
    <div
      style={{
        padding: '9px 12px',
        borderBottom: '1px solid rgba(26,40,64,0.7)',
        transition: 'background 0.12s',
        cursor: 'default',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {/* Title */}
      <p style={{
        fontSize: 10, color: 'var(--text-muted)', marginBottom: 5,
        lineHeight: '1.4',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {market.title}
      </p>

      {/* YES price + delta */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 5 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--positive)', lineHeight: 1 }}>
          {yes}<span style={{ fontSize: 10, fontWeight: 400 }}>¢</span>
        </span>
        {delta !== 0 && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
            color: delta > 0 ? 'var(--positive)' : 'var(--negative)',
          }}>
            {delta > 0 ? '▲' : '▼'}{Math.abs(delta)}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--negative)' }}>
          {100 - yes}¢
        </span>
      </div>

      {/* Single probability bar */}
      <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginBottom: 5 }}>
        <div style={{
          height: '100%', width: '100%', background: 'var(--accent)',
          borderRadius: 2, transformOrigin: 'left',
          transform: `scaleX(${yes / 100})`,
          transition: 'transform 0.4s ease-out',
        }} />
      </div>

      {/* Vol + close */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
        <span>VOL <span style={{ color: 'var(--text-secondary)' }}>{fmtVol(vol)}</span></span>
        {closeLabel && <span>CLOSES <span style={{ color: 'var(--text-secondary)' }}>{closeLabel}</span></span>}
      </div>
    </div>
  );
}

// ── Live Scores ───────────────────────────────────────────────────────────────

const SCORE_SPORTS = ['nba', 'nfl', 'mlb', 'soccer'];

function LiveScoresSection() {
  return (
    <div>
      <PanelHeader label="SCORES" sub="ESPN · live & upcoming" />
      {SCORE_SPORTS.map(s => <SportScores key={s} sport={s} />)}
    </div>
  );
}

function SportScores({ sport }) {
  const { data } = useApi(`/api/scores/${sport}`, [sport]);
  const wsData = useWebSocket();
  const { data: marketsHttp } = useApi('/api/kalshi/sports-markets');
  const markets = wsData?.markets || marketsHttp?.markets || [];

  const live     = data?.live     || [];
  const upcoming = (data?.upcoming || []).slice(0, 2);
  const shown    = live.length > 0 ? live.slice(0, 3) : upcoming;

  if (!shown.length) return null;

  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <div style={{ padding: '5px 12px 2px', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
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
  const home = game.home || game.home_team;
  const away = game.away || game.away_team;
  const homeScore = game.homeScore ?? game.home_score;
  const awayScore = game.awayScore ?? game.away_score;
  const startIso  = game.startTime  || game.start_time;

  return (
    <div style={{ padding: '6px 12px', borderBottom: '1px solid rgba(26,40,64,0.5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
        {isLive && (
          <>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--negative)', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--negative)', fontWeight: 700 }}>LIVE</span>
          </>
        )}
        {isLive && game.clock && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>{game.clock}</span>
        )}
        {isUpcoming && startIso && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-secondary)' }}>{fmtTime(startIso)}</span>
        )}
      </div>

      {[{ team: away, score: awayScore }, { team: home, score: homeScore }].map(({ team, score }, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '75%' }}>
            {team}
          </span>
          {!isUpcoming && score != null && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
              {score}
            </span>
          )}
        </div>
      ))}

      {winMarket && (
        <div style={{ marginTop: 3, fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--positive)' }}>
          Kalshi YES {winMarket.yes_price}¢
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function PanelHeader({ label, sub }) {
  return (
    <div style={{ padding: '10px 12px 7px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.12em' }}>{label}</div>
      {sub && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function PanelEmpty({ msg }) {
  return (
    <div style={{ padding: '16px 12px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
      {msg}
    </div>
  );
}

function fmtVol(v) {
  if (!v) return '—';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
  return `$${v}`;
}

function tokenize(str) {
  return (str || '').toLowerCase().split(/\W+/).filter(w => w.length >= 4 && !['team', 'city', 'wins', 'game'].includes(w));
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
