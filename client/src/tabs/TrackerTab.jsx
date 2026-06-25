import React, { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useWebSocket } from '../hooks/useWebSocket';
import OddsBar from '../components/OddsBar';
import TimeAgo from '../components/TimeAgo';
import { SkeletonCard } from '../components/Skeleton';

const SPORTS = [
  { id: 'NBA',    apiId: 'nba',    label: 'NBA',    color: '#f97316' },
  { id: 'NFL',    apiId: 'nfl',    label: 'NFL',    color: '#22c55e' },
  { id: 'MLB',    apiId: 'mlb',    label: 'MLB',    color: '#3b82f6' },
  { id: 'Soccer', apiId: 'soccer', label: 'SOCCER', color: '#6366f1' },
  { id: 'F1',     apiId: 'f1',     label: 'F1',     color: '#e74c3c' },
];

const SPORT_DESCRIPTIONS = {
  NBA:    'NBA Free Agency opens July 1st — peak roster activity',
  NFL:    'Training camps approaching, early roster moves active',
  MLB:    'Midseason run — trade deadline pressure building',
  Soccer: 'FIFA World Cup 2026 in progress — Group Stage',
  F1:     'Austrian Grand Prix weekend active',
};

function heatColor(score) {
  if (score >= 86) return '#e74c3c';
  if (score >= 66) return '#f97316';
  if (score >= 41) return '#f5c518';
  return '#524e4b';
}

function heatLabel(score) {
  if (score >= 86) return 'RED HOT';
  if (score >= 66) return 'ACTIVE';
  if (score >= 41) return 'WARMING';
  return 'COOL';
}

export default function TrackerTab() {
  const [activeSport, setActiveSport] = useState(SPORTS[0]);

  const wsData = useWebSocket();
  const { data: heatData, loading: heatLoading } = useApi('/api/heat-scores');
  const heatScores = wsData?.heatScores || heatData;

  const { data: trackerData, loading: trackerLoading } = useApi(
    `/api/tracker/${activeSport.apiId}`,
    [activeSport.apiId]
  );

  const currentScore = heatScores?.[activeSport.id] ?? null;
  const cards = trackerData?.cards || [];
  const news  = trackerData?.news  || [];

  return (
    <div className="tab-content">
      {/* Sport tabs */}
      <div style={{ display: 'flex', gap: 1, marginBottom: 18 }}>
        {SPORTS.map(s => {
          const active = activeSport.id === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setActiveSport(s)}
              style={{
                padding: '5px 14px', borderRadius: 2,
                background: active ? s.color : 'var(--bg-card)',
                border: `1px solid ${active ? s.color : 'var(--border)'}`,
                color: active ? '#fff' : 'var(--text-muted)',
                fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700,
                letterSpacing: '0.1em', cursor: 'pointer', transition: 'all 0.12s',
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Heat panel */}
      <div style={{ marginBottom: 18 }}>
        {heatLoading && currentScore === null ? (
          <div className="skeleton" style={{ height: 120, borderRadius: 2 }} />
        ) : (
          <HeatPanel
            sport={activeSport}
            score={currentScore ?? 50}
            description={SPORT_DESCRIPTIONS[activeSport.id] || ''}
            liveFromWs={!!wsData?.heatScores}
          />
        )}
      </div>

      {/* Prediction markets */}
      <div style={{ marginBottom: 18 }}>
        <SectionHeader
          label="PREDICTION MARKETS"
          sub={`Kalshi · ${activeSport.label}`}
          badge={cards.length > 0 ? `${cards.length}` : null}
        />
        {trackerLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={5} />)}
          </div>
        ) : cards.length === 0 ? (
          <RumorCards news={news} sport={activeSport} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {cards.map((c, i) => (
              <TrackerCard key={c.market_id} card={c} index={i} sport={activeSport} />
            ))}
          </div>
        )}
      </div>

      {cards.length > 0 && news.length > 0 && (
        <div>
          <SectionHeader label="LATEST NEWS" sub={`Top ${activeSport.label} headlines`} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {news.map((a, i) => <NewsCard key={i} article={a} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Heat Panel ────────────────────────────────────────────────────────────────

function HeatPanel({ sport, score, description, liveFromWs }) {
  const color = heatColor(score);
  const label = heatLabel(score);

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderTop: `2px solid ${sport.color}`,
      borderRadius: 2, padding: '16px 20px',
    }}>
      {/* Sport label + description row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800,
          color: sport.color, letterSpacing: '0.08em',
        }}>
          {sport.label}
        </span>
        {liveFromWs && (
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700,
            color: 'var(--accent)', border: '1px solid rgba(56,189,248,0.35)',
            borderRadius: 2, padding: '1px 5px', letterSpacing: '0.1em',
          }}>
            LIVE
          </span>
        )}
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)',
          lineHeight: '1.4', marginLeft: 8,
          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        }}>
          {description}
        </p>
      </div>

      {/* Hero number + bars side by side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        {/* Anton hero number */}
        <div style={{ flexShrink: 0, minWidth: 90, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 2 }}>
            HEAT INDEX
          </div>
          <div style={{
            fontFamily: 'var(--font-hero)', fontSize: 67,
            color, lineHeight: 1,
          }}>
            {score}
          </div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700,
            letterSpacing: '0.12em', color, marginTop: 4,
          }}>
            {label}
          </div>
        </div>

        {/* Sub-bars */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <HeatBreakdown score={score} />
        </div>
      </div>
    </div>
  );
}

function HeatBreakdown({ score }) {
  const bars = [
    { label: 'MEDIA',    val: Math.min(100, Math.max(0, score + 5)) },
    { label: 'MARKETS',  val: Math.min(100, Math.max(0, score - 5)) },
    { label: 'TRANSFERS', val: Math.min(100, Math.max(0, score + 10)) },
    { label: 'BUZZ',     val: Math.min(100, Math.max(0, score - 10)) },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {bars.map(b => (
        <div key={b.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
              {b.label}
            </span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 600, color: 'var(--text-secondary)' }}>
              {b.val}
            </span>
          </div>
          <div style={{ height: 2, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: '100%',
              background: heatColor(b.val),
              transformOrigin: 'left',
              transform: `scaleX(${b.val / 100})`,
              transition: 'transform 700ms cubic-bezier(0.22,1,0.36,1)',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tracker Card ──────────────────────────────────────────────────────────────

function TrackerCard({ card, index, sport }) {
  const yes = card.yes_price ?? 50;
  const no  = card.no_price ?? (100 - yes);
  const vol = card.volume ?? 0;
  const volPct = card.volume_pct ?? 0;

  return (
    <div
      className="card-stagger"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderTop: `2px solid ${sport.color}`,
        borderRadius: 2, padding: '10px',
        display: 'flex', flexDirection: 'column', gap: 8,
        '--card-i': Math.min(index, 10),
      }}
      onMouseEnter={e => { e.currentTarget.style.borderRightColor = 'var(--border-hover)'; e.currentTarget.style.borderBottomColor = 'var(--border-hover)'; e.currentTarget.style.borderLeftColor = 'var(--border-hover)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderRightColor = 'var(--border)'; e.currentTarget.style.borderBottomColor = 'var(--border)'; e.currentTarget.style.borderLeftColor = 'var(--border)'; }}
    >
      <p style={{
        fontSize: 12, fontFamily: 'var(--font-sans)', fontWeight: 500,
        color: 'var(--text-secondary)', lineHeight: '1.4',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {card.market_title}
      </p>

      {/* Prices */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800,
          color: 'var(--positive)', letterSpacing: '-0.01em',
        }}>
          {yes}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>¢ YES</span>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600,
          color: 'var(--negative)', marginLeft: 'auto',
        }}>
          {no}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>¢ NO</span>
      </div>

      <OddsBar yesPrice={yes} noPrice={no} compact />

      {/* Volume */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 3 }}>
          <span>VOLUME</span>
          <span style={{ color: 'var(--text-secondary)' }}>
            {vol >= 1_000_000 ? `$${(vol / 1_000_000).toFixed(1)}M` : vol >= 1000 ? `$${(vol / 1000).toFixed(0)}K` : `$${vol}`}
          </span>
        </div>
        <div style={{ height: 2, background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'var(--accent)', width: `${Math.max(2, volPct * 100)}%` }} />
        </div>
      </div>

      <CloseTime ts={card.close_time} />

      {card.related_news?.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {card.related_news.map((a, i) => (
            <a
              key={i}
              href={a.url !== '#' ? a.url : undefined}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'flex-start', gap: 6, textDecoration: 'none' }}
              onMouseEnter={e => e.currentTarget.querySelector('.news-title').style.color = 'var(--text-primary)'}
              onMouseLeave={e => e.currentTarget.querySelector('.news-title').style.color = 'var(--text-muted)'}
            >
              <span style={{ color: 'var(--accent)', marginTop: 1, flexShrink: 0 }}>›</span>
              <div style={{ minWidth: 0 }}>
                <p className="news-title" style={{
                  fontSize: 10, color: 'var(--text-muted)',
                  lineHeight: '1.35', transition: 'color 0.1s',
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {a.title}
                </p>
                <div style={{ display: 'flex', gap: 5, marginTop: 2 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text-muted)' }}>{a.source}</span>
                  <TimeAgo date={a.publishedAt} />
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function RumorCards({ news, sport }) {
  if (!news.length) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
        NO PREDICTION MARKETS FOR {sport.label.toUpperCase()} RIGHT NOW
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
      {news.map((a, i) => (
        <a
          key={i}
          href={a.url !== '#' ? a.url : undefined}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block', textDecoration: 'none',
            border: '1px dashed var(--border)', borderRadius: 2,
            padding: 10, opacity: 0.7, transition: 'opacity 0.1s, border-color 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: 8, fontWeight: 800,
              color: 'var(--text-muted)', letterSpacing: '0.12em',
              border: '1px solid var(--border)', borderRadius: 2, padding: '1px 4px',
            }}>
              RUMOR
            </span>
            <TimeAgo date={a.publishedAt} />
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: '1.4',
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {a.title}
          </p>
          <p style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text-muted)', marginTop: 4 }}>{a.source}</p>
        </a>
      ))}
    </div>
  );
}

function CloseTime({ ts }) {
  if (!ts) return null;
  const diff = new Date(ts) - Date.now();
  if (diff < 0) return <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>CLOSED</span>;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const label = days > 0 ? `CLOSES ${days}D ${hours}H` : `CLOSES ${hours}H`;
  return (
    <span style={{
      fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.06em',
      color: diff < 86400000 * 2 ? 'var(--negative)' : 'var(--text-muted)',
    }}>
      {label}
    </span>
  );
}

function NewsCard({ article }) {
  return (
    <a
      href={article.url !== '#' ? article.url : undefined}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block', textDecoration: 'none',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 2, padding: '10px 10px', transition: 'border-color 0.1s',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>{article.source}</span>
        <TimeAgo date={article.publishedAt} />
      </div>
      <p style={{
        fontSize: 11, color: 'var(--text-primary)', lineHeight: '1.4',
        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {article.title}
      </p>
    </a>
  );
}

function SectionHeader({ label, sub, badge }) {
  return (
    <div style={{
      marginBottom: 10, paddingBottom: 7,
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
    }}>
      <div>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 800,
          color: 'var(--text-secondary)', letterSpacing: '0.14em',
        }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 2, letterSpacing: '0.04em' }}>
            {sub}
          </div>
        )}
      </div>
      {badge && (
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-muted)',
          background: 'var(--border)', borderRadius: 2, padding: '1px 6px', marginBottom: 1,
        }}>
          {badge}
        </span>
      )}
    </div>
  );
}
