import React, { useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { useWebSocket } from '../hooks/useWebSocket';

export default function RightPanel() {
  return (
    <aside style={{
      width: 256, flexShrink: 0, display: 'flex', flexDirection: 'column',
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
  const markets = useMemo(
    () => [...raw].sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 12),
    [raw]
  );

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <PanelHeader label="MARKETS" sub="Kalshi · by volume" />
      <div>
        {markets.length === 0
          ? <PanelEmpty msg="Warming up…" />
          : markets.map(m => <KalshiCard key={m.id} market={m} />)
        }
      </div>
    </div>
  );
}

function KalshiCard({ market }) {
  const yes   = market.yes_price ?? 50;
  const prev  = market.yes_prev ?? yes;
  const delta = yes - prev;
  const vol   = market.volume || 0;

  const closeLabel = (() => {
    if (!market.close_time) return null;
    const diff = new Date(market.close_time) - Date.now();
    if (diff < 0) return 'CLOSED';
    const days = Math.floor(diff / 86400000);
    if (days > 0) return `${days}D`;
    return `${Math.floor(diff / 3600000)}H`;
  })();

  return (
    <div
      style={{
        padding: '8px 10px',
        borderBottom: '1px solid rgba(40,40,40,0.8)',
        transition: 'background 0.1s', cursor: 'default',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {/* Sport tag */}
      {market.sport_tag && (
        <div style={{ marginBottom: 3 }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: 8, fontWeight: 800,
            letterSpacing: '0.14em', color: 'var(--text-muted)',
          }}>
            {market.sport_tag}
          </span>
        </div>
      )}

      {/* Title */}
      <p style={{
        fontSize: 10, color: 'var(--text-secondary)', marginBottom: 6,
        lineHeight: '1.35', fontFamily: 'var(--font-sans)',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {market.title}
      </p>

      {/* YES price in display font */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 5 }}>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 900,
          color: 'var(--positive)', lineHeight: 1, letterSpacing: '-0.01em',
        }}>
          {yes}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-muted)' }}>¢ YES</span>
        {delta !== 0 && (
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700,
            color: delta > 0 ? 'var(--positive)' : 'var(--negative)',
          }}>
            {delta > 0 ? '▲' : '▼'}{Math.abs(delta)}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--negative)' }}>
          {100 - yes}¢
        </span>
      </div>

      {/* Probability bar */}
      <div style={{ height: 2, background: 'var(--border)', overflow: 'hidden', marginBottom: 4 }}>
        <div style={{
          height: '100%', width: '100%', background: 'var(--accent)',
          transformOrigin: 'left', transform: `scaleX(${yes / 100})`,
          transition: 'transform 0.4s ease-out',
        }} />
      </div>

      {/* Vol + close */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, fontFamily: 'var(--mono)', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
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
      <PanelHeader label="SCORES" sub="ESPN · live &amp; upcoming" />
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
  const isLive     = game.isLive || game.is_live;
  const isUpcoming = !game.is_live && !game.is_final && !game.isLive && !game.isFinal;
  const winMarket  = useMemo(() => findWinMarket(game, markets), [game, markets]);
  const home       = game.home || game.home_team || '—';
  const away       = game.away || game.away_team || '—';
  const homeScore  = game.homeScore ?? game.home_score;
  const awayScore  = game.awayScore ?? game.away_score;
  const startIso   = game.startTime || game.start_time;

  return (
    <div style={{ padding: '5px 10px 6px', borderBottom: '1px solid rgba(40,40,40,0.6)' }}>
      {/* Status row */}
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

      {/* Teams */}
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
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              {score}
            </span>
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function PanelHeader({ label, sub }) {
  return (
    <div style={{ padding: '9px 10px 6px', borderBottom: '1px solid var(--border)' }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 800,
        color: 'var(--text-secondary)', letterSpacing: '0.14em',
      }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text-muted)', marginTop: 1, letterSpacing: '0.04em' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function PanelEmpty({ msg }) {
  return (
    <div style={{
      padding: '14px 10px', fontFamily: 'var(--mono)',
      fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', letterSpacing: '0.06em',
    }}>
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
