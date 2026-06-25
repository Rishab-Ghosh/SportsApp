import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const RETRY_INTERVAL_MS = 5000;
const MAX_RETRY_MS = 60000;

// Source-specific colors for the dot in source pills
const SOURCE_COLORS = {
  'espn.com':           '#ef4444',
  'espn':               '#ef4444',
  'bbc':                '#fb923c',
  'bbcsport':           '#fb923c',
  'skysports':          '#3b82f6',
  'sky sports':         '#3b82f6',
  'guardian':           '#22c55e',
  'the guardian':       '#22c55e',
  'reddit':             '#f97316',
  'r/nba':              '#f97316',
  'r/nfl':              '#f97316',
  'r/soccer':           '#f97316',
  'r/formula1':         '#f97316',
  'r/baseball':         '#f97316',
  'r/tennis':           '#f97316',
  'google news':        '#4285F4',
};

function sourceColor(name) {
  const key = (name || '').toLowerCase().replace(/\s+/g, '');
  for (const [k, v] of Object.entries(SOURCE_COLORS)) {
    if (key.includes(k.replace(/\s+/g, ''))) return v;
  }
  return '#506070';
}

const SPORT_COLORS = {
  NBA: '#f97316', NFL: '#22c55e', MLB: '#ef4444',
  Soccer: '#3b82f6', F1: '#dc2626', Tennis: '#eab308', General: '#506070',
};

export default function NewsFeed({ activeSport, onDataLoaded }) {
  const [cards, setCards]   = useState([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);

  const abortRef       = useRef(null);
  const retryRef       = useRef(null);
  const retryStartRef  = useRef(null);

  const buildUrl = useCallback((sport) => {
    if (!sport || sport === 'All') return `${API_BASE}/api/news/all?limit=30`;
    return `${API_BASE}/api/news/feed?sport=${encodeURIComponent(sport)}&limit=25`;
  }, []);

  const doFetch = useCallback(async (signal, sport) => {
    try {
      const r = await fetch(buildUrl(sport), { signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const fetched = Array.isArray(data) ? data : (data.cards || []);
      return { cards: fetched, total: Array.isArray(data) ? data.length : (data.total || fetched.length) };
    } catch (err) {
      if (err.name === 'AbortError') return null;
      return { cards: [], total: 0 };
    }
  }, [buildUrl]);

  useEffect(() => {
    setCards([]); setTotal(0); setLoading(true);
    retryStartRef.current = Date.now();
    if (abortRef.current) abortRef.current.abort();
    if (retryRef.current) clearInterval(retryRef.current);

    const controller = new AbortController();
    abortRef.current = controller;

    const run = async () => {
      const result = await doFetch(controller.signal, activeSport);
      if (result === null) return;
      setCards(result.cards); setTotal(result.total); setLoading(false);
      if (result.cards.length > 0) { onDataLoaded?.(); return; }

      retryRef.current = setInterval(async () => {
        if (Date.now() - retryStartRef.current > MAX_RETRY_MS) { clearInterval(retryRef.current); return; }
        const retry = await doFetch(controller.signal, activeSport);
        if (retry === null) { clearInterval(retryRef.current); return; }
        if (retry.cards.length > 0) {
          setCards(retry.cards); setTotal(retry.total);
          onDataLoaded?.(); clearInterval(retryRef.current);
        }
      }, RETRY_INTERVAL_MS);
    };

    run();
    return () => { controller.abort(); if (retryRef.current) clearInterval(retryRef.current); };
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
          {cards.map((card, i) => (
            <StoryCard key={card.id} card={card} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ sport, total }) {
  return (
    <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text-muted)', letterSpacing: '0.12em', fontWeight: 600 }}>
        TOP STORIES{sport !== 'All' ? ` · ${sport.toUpperCase()}` : ''}{total > 0 ? ` · ${total}` : ''}
      </span>
    </div>
  );
}

function StoryCard({ card, index }) {
  const hasMarket  = !!card.market_match;
  const sportColor = SPORT_COLORS[card.sport_tag] || SPORT_COLORS.General;
  const displaySources = (card.sources || []).slice(0, 3);
  const extra = (card.sources?.length || 0) - 3;
  const relevancePct = Math.max(2, card.relevance_score || 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.4), ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
      whileHover={{ borderColor: 'var(--border-hover)' }}
      onClick={() => card.sources?.[0]?.url && window.open(card.sources[0].url, '_blank')}
    >
      <div style={{ padding: '12px 14px' }}>
        {/* Sport chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
          <span style={{
            fontSize: 9, fontFamily: 'var(--mono)', fontWeight: 700, letterSpacing: '0.08em',
            color: sportColor, border: `1px solid ${sportColor}44`, background: `${sportColor}15`,
            borderRadius: 3, padding: '1px 5px',
          }}>
            {card.sport_tag || 'SPORT'}
          </span>
          {card.reddit_upvotes > 0 && (
            <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--orange)' }}>
              ▲ {fmtNum(card.reddit_upvotes)}
            </span>
          )}
        </div>

        {/* Headline — Space Grotesk, prominent */}
        <p style={{
          fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
          lineHeight: '1.4', marginBottom: 5,
          fontFamily: 'var(--font-sans)',
        }}>
          {card.headline}
        </p>

        {/* Summary — body text */}
        {card.summary && card.summary !== card.headline && (
          <p style={{
            fontSize: 12, color: 'var(--text-secondary)', lineHeight: '1.5',
            marginBottom: 10,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {card.summary}
          </p>
        )}

        {/* Source pills + market badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          {displaySources.map((s, i) => (
            <a
              key={i}
              href={s.url && !s.url.includes('news.google.com') ? s.url : undefined}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text-secondary)',
                border: '1px solid var(--border)', borderRadius: 3,
                padding: '2px 6px', textDecoration: 'none',
                whiteSpace: 'nowrap',
                transition: 'border-color 0.12s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: sourceColor(s.name), flexShrink: 0 }} />
              {shortenSource(s.name)}
            </a>
          ))}
          {extra > 0 && (
            <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text-muted)', padding: '2px 4px' }}>
              +{extra}
            </span>
          )}

          {hasMarket && (
            <a
              href={`https://kalshi.com/markets/${card.market_match.id}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                marginLeft: 'auto',
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 600,
                color: 'var(--positive)', border: '1px solid rgba(34,197,94,0.35)',
                background: 'rgba(34,197,94,0.08)', borderRadius: 3,
                padding: '2px 7px', textDecoration: 'none',
              }}
            >
              📈 YES {card.market_match.yes_price}¢
            </a>
          )}
        </div>
      </div>

      {/* Relevance bar — thin accent line at bottom */}
      <div style={{ height: 2, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: '100%',
          background: `linear-gradient(90deg, var(--accent) 0%, rgba(129,140,248,0.6) 100%)`,
          transformOrigin: 'left',
          transform: `scaleX(${relevancePct / 100})`,
          transition: 'transform 0.6s cubic-bezier(0.22,1,0.36,1)',
        }} />
      </div>
    </motion.div>
  );
}

function shortenSource(name) {
  if (!name) return '?';
  if (name.startsWith('Reddit r/')) return name.slice(7);
  if (name === 'The Guardian') return 'Guardian';
  if (name === 'BBC Sport') return 'BBC';
  if (name === 'Sky Sports') return 'Sky';
  if (name === 'Google News') return 'GNews';
  return name.slice(0, 10);
}

function fmtNum(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function SkeletonStory() {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
      <div className="skeleton" style={{ height: 9, width: '30%', borderRadius: 3, marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 15, width: '85%', borderRadius: 3, marginBottom: 5 }} />
      <div className="skeleton" style={{ height: 11, width: '95%', borderRadius: 3, marginBottom: 4 }} />
      <div className="skeleton" style={{ height: 11, width: '60%', borderRadius: 3 }} />
    </div>
  );
}

function EmptyFeed({ sport }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
      <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.5 }}>📡</div>
      No stories for {sport === 'All' ? 'all sports' : sport} yet
      <div style={{ fontSize: 10, marginTop: 4, color: 'var(--text-muted)' }}>Sources scraped every 10 minutes</div>
    </div>
  );
}
