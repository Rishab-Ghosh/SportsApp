import React, { useState, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { useWebSocket } from '../hooks/useWebSocket';

const SPORTS = [
  { id: 'nba',    label: 'NBA',    color: '#f97316' },
  { id: 'nfl',    label: 'NFL',    color: '#22c55e' },
  { id: 'mlb',    label: 'MLB',    color: '#3b82f6' },
  { id: 'soccer', label: 'SOCCER', color: '#6366f1' },
  { id: 'f1',     label: 'F1',     color: '#e74c3c' },
  { id: 'tennis', label: 'TENNIS', color: '#f5c518' },
];

function tokenize(str) {
  return (str || '').toLowerCase().split(/\W+/).filter(w => w.length >= 4 && !['team','city','wins','game'].includes(w));
}

function findWinMarket(game, markets) {
  const tokens = new Set([
    ...tokenize(game.home || game.home_team),
    ...tokenize(game.away || game.away_team),
  ]);
  if (!tokens.size) return null;
  for (const m of markets) {
    const mt = (m.title || '').toLowerCase();
    if ([...tokens].some(t => mt.includes(t))) return m;
  }
  return null;
}

function fmtTime(iso) {
  if (!iso) return null;
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return null; }
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
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
  } catch { return null; }
}

export default function ScoresTab() {
  const [activeSport, setActiveSport] = useState('nba');
  const wsData = useWebSocket();
  const { data: marketsHttp } = useApi('/api/kalshi/sports-markets');
  const markets = wsData?.markets || marketsHttp?.markets || [];
  const activeMeta = SPORTS.find(s => s.id === activeSport);

  return (
    <div className="tab-content">
      {/* Sport selector */}
      <div style={{ display: 'flex', gap: 1, marginBottom: 20, overflow: 'auto' }} className="scrollbar-hide">
        {SPORTS.map(s => {
          const active = activeSport === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setActiveSport(s.id)}
              style={{
                padding: '5px 14px', flexShrink: 0,
                background: active ? s.color : 'var(--bg-card)',
                border: `1px solid ${active ? s.color : 'var(--border)'}`,
                borderRadius: 2, cursor: 'pointer',
                color: active ? '#fff' : 'var(--text-muted)',
                fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700,
                letterSpacing: '0.1em', transition: 'all 0.12s',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <ScoreBoard sport={activeSport} sportColor={activeMeta?.color} markets={markets} />
    </div>
  );
}

function ScoreBoard({ sport, sportColor, markets }) {
  const { data, loading, error } = useApi(`/api/scores/${sport}`, [sport]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 88, borderRadius: 2 }} />
        ))}
      </div>
    );
  }

  if (error) {
    return <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)', padding: '32px 0', textAlign: 'center', letterSpacing: '0.08em' }}>SCORES UNAVAILABLE</p>;
  }

  const live     = data?.live     || [];
  const upcoming = data?.upcoming || [];
  const final    = data?.final    || [];

  if (live.length === 0 && upcoming.length === 0 && final.length === 0) {
    return (
      <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)', padding: '48px 0', textAlign: 'center', letterSpacing: '0.08em' }}>
        NO GAMES SCHEDULED
      </p>
    );
  }

  if (sport === 'f1') {
    const all = data?.games || [];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        {all.map(g => <F1Card key={g.id} session={g} sportColor={sportColor} />)}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {live.length > 0 && (
        <Section label="LIVE NOW" hot>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {live.map(g => <LiveCard key={g.id} game={g} markets={markets} sportColor={sportColor} />)}
          </div>
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section label="UPCOMING" sportColor={sportColor}>
          <UpcomingList games={upcoming} markets={markets} sportColor={sportColor} />
        </Section>
      )}

      {final.length > 0 && (
        <Section label="RECENT RESULTS">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {final.slice(0, 6).map(g => <FinalCard key={g.id} game={g} markets={markets} />)}
          </div>
        </Section>
      )}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function Section({ label, hot, sportColor, children }) {
  const accentColor = hot ? 'var(--negative)' : (sportColor || 'var(--text-muted)');
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10,
        paddingBottom: 8, borderBottom: `1px solid var(--border)`,
      }}>
        {hot && (
          <span className="live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--negative)', flexShrink: 0 }} />
        )}
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 800,
          color: accentColor, letterSpacing: '0.12em',
        }}>
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

// ── Live card — scoreboard density ────────────────────────────────────────────

function LiveCard({ game, markets, sportColor }) {
  const winMarket = useMemo(() => findWinMarket(game, markets), [game, markets]);
  const home = game.home || game.home_team || '—';
  const away = game.away || game.away_team || '—';
  const homeScore = game.homeScore ?? game.home_score;
  const awayScore = game.awayScore ?? game.away_score;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid var(--border)`,
      borderTop: `2px solid ${sportColor || 'var(--negative)'}`,
      borderRadius: 2,
      overflow: 'hidden',
    }}>
      {/* LIVE header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '5px 10px',
        background: 'rgba(231,76,60,0.08)',
        borderBottom: '1px solid var(--border)',
      }}>
        <span className="live-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--negative)' }} />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 800, color: 'var(--negative)', letterSpacing: '0.14em' }}>
          LIVE
        </span>
        {game.clock && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-muted)', marginLeft: 2 }}>
            {game.clock}
          </span>
        )}
        {game.broadcast && (
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text-muted)' }}>
            {game.broadcast}
          </span>
        )}
      </div>

      {/* Scoreboard rows */}
      <div style={{ padding: '8px 10px' }}>
        {[{ team: away, score: awayScore }, { team: home, score: homeScore }].map(({ team, score }, i) => (
          <React.Fragment key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
                color: 'var(--text-primary)', letterSpacing: '0.02em',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: '72%', textTransform: 'uppercase',
              }}>
                {team}
              </span>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700,
                color: 'var(--text-primary)', letterSpacing: '-0.02em',
              }}>
                {score != null ? score : '—'}
              </span>
            </div>
            {i === 0 && (
              <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {winMarket && <WinProbRow market={winMarket} />}
    </div>
  );
}

// ── Upcoming list ─────────────────────────────────────────────────────────────

function UpcomingList({ games, markets, sportColor }) {
  const [showAll, setShowAll] = useState(false);
  const MAX = 8;
  const shown = showAll ? games : games.slice(0, MAX);

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {shown.map(g => <UpcomingCard key={g.id} game={g} markets={markets} sportColor={sportColor} />)}
      </div>
      {games.length > MAX && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          style={{
            marginTop: 10, background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--accent)',
            letterSpacing: '0.06em',
          }}
        >
          SHOW {games.length - MAX} MORE →
        </button>
      )}
    </div>
  );
}

function UpcomingCard({ game, markets, sportColor }) {
  const winMarket = useMemo(() => findWinMarket(game, markets), [game, markets]);
  const home = game.home || game.home_team || '—';
  const away = game.away || game.away_team || '—';
  const startIso = game.startTime || game.start_time;
  const dayLabel = fmtDate(startIso);
  const timeLabel = fmtTime(startIso);

  return (
    <div style={{
      display: 'flex', alignItems: 'stretch',
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 2, overflow: 'hidden',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      {/* Time column */}
      <div style={{
        width: 56, flexShrink: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '8px 4px', borderRight: '1px solid var(--border)',
        background: 'rgba(255,255,255,0.015)',
      }}>
        {timeLabel && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {timeLabel}
          </span>
        )}
        {dayLabel && (
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', marginTop: 2 }}>
            {dayLabel}
          </span>
        )}
      </div>

      {/* Teams */}
      <div style={{ flex: 1, padding: '7px 10px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
          {away}
        </div>
        <div style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
          {home}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
          {game.broadcast && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
              {game.broadcast}
            </span>
          )}
          {winMarket && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--positive)', marginLeft: 'auto' }}>
              YES {winMarket.yes_price}¢
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Final card ────────────────────────────────────────────────────────────────

function FinalCard({ game, markets }) {
  const winMarket = useMemo(() => findWinMarket(game, markets), [game, markets]);
  const home = game.home || game.home_team || '—';
  const away = game.away || game.away_team || '—';
  const homeScore = parseInt(game.homeScore ?? game.home_score) || 0;
  const awayScore = parseInt(game.awayScore ?? game.away_score) || 0;
  const homeWin = homeScore > awayScore;
  const awayWin = awayScore > homeScore;

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 2, overflow: 'hidden', opacity: 0.75,
    }}>
      <div style={{
        padding: '4px 10px', borderBottom: '1px solid var(--border)',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.14em' }}>
          FINAL
        </span>
      </div>

      <div style={{ padding: '8px 10px' }}>
        {[{ team: away, score: awayScore, win: awayWin }, { team: home, score: homeScore, win: homeWin }].map(({ team, score, win }, i) => (
          <React.Fragment key={i}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '2px 0', opacity: win ? 1 : 0.45,
            }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: win ? 800 : 600,
                color: win ? 'var(--text-primary)' : 'var(--text-secondary)',
                letterSpacing: '0.02em', textTransform: 'uppercase',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '72%',
              }}>
                {team}
              </span>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700,
                color: win ? 'var(--positive)' : 'var(--text-muted)',
              }}>
                {score}
              </span>
            </div>
            {i === 0 && <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />}
          </React.Fragment>
        ))}
      </div>

      {winMarket && <WinProbRow market={winMarket} />}
    </div>
  );
}

// ── Kalshi market probability row ─────────────────────────────────────────────

function WinProbRow({ market }) {
  const yes = market.yes_price ?? 50;
  return (
    <div style={{
      padding: '5px 10px 7px',
      borderTop: '1px solid var(--border)',
      background: 'rgba(56,189,248,0.04)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.12em' }}>
          KALSHI ODDS
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-muted)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {market.title?.slice(0, 22)}
        </span>
      </div>
      <div style={{ height: 3, background: 'var(--border)', borderRadius: 1, overflow: 'hidden', marginBottom: 4 }}>
        <div style={{ display: 'flex', height: '100%' }}>
          <div style={{ width: `${yes}%`, background: 'var(--positive)' }} />
          <div style={{ flex: 1, background: 'var(--negative)' }} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 9 }}>
        <span style={{ color: 'var(--positive)', fontWeight: 700 }}>YES {yes}¢</span>
        <span style={{ color: 'var(--negative)', fontWeight: 700 }}>NO {100 - yes}¢</span>
      </div>
    </div>
  );
}

// ── F1 card ───────────────────────────────────────────────────────────────────

function F1Card({ session, sportColor }) {
  const startDate = session.startTime || session.start_time
    ? new Date(session.startTime || session.start_time)
    : null;
  const status = session.status || (session.isLive ? 'live' : session.isFinal ? 'final' : 'upcoming');

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderTop: status === 'live' ? `2px solid ${sportColor || 'var(--negative)'}` : '1px solid var(--border)',
      borderRadius: 2, overflow: 'hidden', padding: '10px 12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 3 }}>
            FORMULA 1 · 2026
          </div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
            {session.home || session.name}
          </p>
        </div>
        <StatusPill status={status} />
      </div>

      {session.venue && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
          🏁 {session.venue}{session.country ? ` · ${session.country}` : ''}
        </div>
      )}

      {startDate && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 4, letterSpacing: '0.04em' }}>
          {startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
          {' · '}
          {startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }) {
  const styles = {
    live:     { color: 'var(--negative)', border: 'rgba(231,76,60,0.4)',  bg: 'rgba(231,76,60,0.1)',  label: 'LIVE' },
    final:    { color: 'var(--text-muted)', border: 'rgba(82,78,75,0.4)', bg: 'rgba(82,78,75,0.1)',  label: 'FINAL' },
    upcoming: { color: 'var(--accent)',    border: 'rgba(56,189,248,0.35)', bg: 'rgba(56,189,248,0.08)', label: 'SCHED' },
  };
  const s = styles[status] || styles.upcoming;
  return (
    <span style={{
      fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 800,
      letterSpacing: '0.12em', color: s.color,
      border: `1px solid ${s.border}`, background: s.bg,
      borderRadius: 2, padding: '2px 6px',
    }}>
      {s.label}
    </span>
  );
}
