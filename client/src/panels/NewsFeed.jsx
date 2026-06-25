import React, { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const RETRY_INTERVAL_MS = 5000;
const MAX_RETRY_MS = 60000;

export default function NewsFeed({ activeSport, onDataLoaded }) {
  const [cards, setCards] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const abortRef = useRef(null);
  const retryRef = useRef(null);
  const retryStartRef = useRef(null);

  const buildUrl = useCallback((sport) => {
    if (!sport || sport === 'All') {
      return `${API_BASE}/api/news/all?limit=30`;
    }
    return `${API_BASE}/api/news/feed?sport=${encodeURIComponent(sport)}&limit=25`;
  }, []);

  const doFetch = useCallback(async (signal, sport) => {
    const url = buildUrl(sport);
    console.log('[NEWS FETCH]', url);
    try {
      const r = await fetch(url, { signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      console.log('[NEWS RESPONSE]', data);
      // Normalize: backend returns { cards: [...], total: N } but guard against raw array
      const fetched = Array.isArray(data) ? data : (data.cards || []);
      const tot = Array.isArray(data) ? data.length : (data.total || fetched.length);
      console.log('[NEWS CARDS COUNT]', fetched.length);
      return { cards: fetched, total: tot };
    } catch (err) {
      if (err.name === 'AbortError') return null;
      console.error('[NEWS FETCH ERROR]', err.message, 'url:', url);
      return { cards: [], total: 0 };
    }
  }, [buildUrl]);

  useEffect(() => {
    // Reset on every sport change
    setCards([]);
    setTotal(0);
    setLoading(true);
    retryStartRef.current = Date.now();

    if (abortRef.current) abortRef.current.abort();
    if (retryRef.current) clearInterval(retryRef.current);

    const controller = new AbortController();
    abortRef.current = controller;

    const run = async () => {
      const result = await doFetch(controller.signal, activeSport);
      if (result === null) return; // aborted — component unmounted or sport changed

      setCards(result.cards);
      setTotal(result.total);
      setLoading(false);

      if (result.cards.length > 0) {
        onDataLoaded?.();
        return;
      }

      // Got a valid response but 0 cards — scraper may not have run yet on cold start.
      // Retry every 5s for up to 60s.
      retryRef.current = setInterval(async () => {
        if (Date.now() - retryStartRef.current > MAX_RETRY_MS) {
          console.log('[NEWS RETRY] timeout — giving up');
          clearInterval(retryRef.current);
          return;
        }
        const retry = await doFetch(controller.signal, activeSport);
        if (retry === null) { clearInterval(retryRef.current); return; }
        console.log('[NEWS RETRY]', retry.cards.length, 'cards');
        if (retry.cards.length > 0) {
          setCards(retry.cards);
          setTotal(retry.total);
          onDataLoaded?.();
          clearInterval(retryRef.current);
        }
      }, RETRY_INTERVAL_MS);
    };

    run();

    return () => {
      controller.abort();
      if (retryRef.current) clearInterval(retryRef.current);
    };
  }, [activeSport]); // eslint-disable-line

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

// ── Sub-components ────────────────────────────────────────────────────────────

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
      <p style={{
        fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
        lineHeight: '1.45', marginBottom: 5,
      }}>
        {card.headline}
      </p>

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

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 10, flexWrap: 'wrap' }}>
        <SportChip sport={card.sport_tag} />

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

        {card.reddit_upvotes > 0 && (
          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--orange)' }}>
            ▲ {fmtNum(card.reddit_upvotes)}
          </span>
        )}

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

      <div style={{ height: 2, background: 'var(--border)', marginLeft: -14, marginRight: -14, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: '100%',
          background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
          transformOrigin: 'left',
          transform: `scaleX(${relevancePct / 100})`,
          transition: 'transform 0.6s cubic-bezier(0.22,1,0.36,1)',
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
