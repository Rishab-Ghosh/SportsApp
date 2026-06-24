import React, { useEffect } from 'react';
import { useApi } from '../hooks/useApi';

export default function NewsFeed({ activeSport, onDataLoaded }) {
  const sport = activeSport === 'All' ? '' : activeSport;
  const url = sport ? `/api/news/feed?sport=${sport}&limit=25` : '/api/news/all?limit=30';
  const { data, loading } = useApi(url, [url]);

  useEffect(() => {
    if (!loading && data) onDataLoaded?.();
  }, [loading, data]); // eslint-disable-line

  const cards = data?.cards || [];
  const total = data?.total || 0;

  return (
    <div style={{ padding: 16 }}>
      <SectionHeader sport={activeSport} total={total} />
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonStory key={i} />)}
        </div>
      ) : cards.length === 0 ? (
        <EmptyFeed sport={activeSport} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cards.map(card => <StoryCard key={card.id} card={card} />)}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ sport, total }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <span style={{
        fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text-muted)',
        letterSpacing: '0.12em', fontWeight: 600,
      }}>
        TOP STORIES{sport !== 'All' ? ` · ${sport.toUpperCase()}` : ''}{total > 0 ? ` · ${total} SOURCES` : ''}
      </span>
    </div>
  );
}

function StoryCard({ card }) {
  const hasMarket = !!card.market_match;
  const displaySources = card.sources?.slice(0, 3) || [];
  const extraCount = (card.sources?.length || 0) - 3;
  const relevancePct = Math.max(2, card.relevance_score || 0);

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '12px 14px 0 14px',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
        overflow: 'hidden',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
      onClick={() => card.sources?.[0]?.url && window.open(card.sources[0].url, '_blank')}
    >
      {/* Headline */}
      <p style={{
        fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
        lineHeight: '1.45', marginBottom: 5,
      }}>
        {card.headline}
      </p>

      {/* Summary */}
      {card.summary && card.summary !== card.headline && (
        <p style={{
          fontSize: 11, color: 'var(--text-muted)', lineHeight: '1.5',
          marginBottom: 8,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {card.summary}
        </p>
      )}

      {/* Bottom row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 10, flexWrap: 'wrap' }}>
        {/* Sport badge */}
        <SportChip sport={card.sport_tag} />

        {/* Kalshi badge */}
        {hasMarket && (
          <span
            onClick={e => { e.stopPropagation(); window.open(card.market_match.url, '_blank'); }}
            style={{
              fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 600,
              color: 'var(--green)', border: '1px solid rgba(34,197,94,0.35)',
              background: 'rgba(34,197,94,0.08)', borderRadius: 3,
              padding: '1px 6px', cursor: 'pointer', display: 'inline-flex', gap: 3,
            }}
          >
            📈 YES {card.market_match.yes_price}¢
          </span>
        )}

        {/* Reddit upvotes */}
        {card.reddit_upvotes > 0 && (
          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--orange)' }}>
            ▲ {fmtNum(card.reddit_upvotes)}
          </span>
        )}

        {/* Source pills */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {displaySources.map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text-muted)',
                border: '1px solid var(--border)', borderRadius: 3,
                padding: '1px 5px', textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {sourceName(s.name)}
            </a>
          ))}
          {extraCount > 0 && (
            <span style={{
              fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text-muted)',
              border: '1px solid var(--border)', borderRadius: 3, padding: '1px 5px',
            }}>
              +{extraCount} more
            </span>
          )}
        </div>
      </div>

      {/* Relevance bar */}
      <div style={{ height: 2, background: 'var(--border)', marginLeft: -14, marginRight: -14 }}>
        <div style={{
          height: '100%',
          width: `${relevancePct}%`,
          background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
          transition: 'width 0.6s',
        }} />
      </div>
    </div>
  );
}

function SportChip({ sport }) {
  const colors = {
    NBA: '#f97316', NFL: '#22c55e', MLB: '#ef4444',
    Soccer: '#22c55e', F1: '#dc2626', Tennis: '#eab308', General: '#64748b',
  };
  const c = colors[sport] || colors.General;
  return (
    <span style={{
      fontSize: 9, fontFamily: 'var(--mono)', fontWeight: 700,
      color: c, border: `1px solid ${c}44`, background: `${c}15`,
      borderRadius: 3, padding: '1px 5px', letterSpacing: '0.08em',
    }}>
      {sport || 'SPORT'}
    </span>
  );
}

function sourceName(name) {
  if (!name) return '?';
  if (name.startsWith('Reddit r/')) return name.replace('Reddit r/', 'r/');
  if (name === 'The Guardian') return 'Guardian';
  if (name === 'BBC Sport') return 'BBC';
  if (name === 'Sky Sports') return 'Sky';
  if (name === 'Google News') return 'GNews';
  return name.slice(0, 8);
}

function fmtNum(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function SkeletonStory() {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: 14 }}>
      <div className="skeleton" style={{ height: 14, width: '80%', borderRadius: 3, marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 10, width: '95%', borderRadius: 3, marginBottom: 4 }} />
      <div className="skeleton" style={{ height: 10, width: '60%', borderRadius: 3 }} />
    </div>
  );
}

function EmptyFeed({ sport }) {
  return (
    <div style={{
      textAlign: 'center', padding: '48px 16px',
      color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: 12,
    }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>📡</div>
      No stories scraped yet for {sport === 'All' ? 'all sports' : sport}
      <div style={{ fontSize: 10, marginTop: 4 }}>Sources are scraped every 10 minutes</div>
    </div>
  );
}
