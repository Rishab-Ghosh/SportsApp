import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const RETRY_INTERVAL_MS = 5000;
const MAX_RETRY_MS = 60000;

const SPORT_COLORS = {
  NBA:     '#f97316',
  NFL:     '#22c55e',
  MLB:     '#3b82f6',
  Soccer:  '#6366f1',
  F1:      '#e74c3c',
  Tennis:  '#f5c518',
  General: '#524e4b',
};

const SOURCE_COLORS = {
  espn:        '#e74c3c',
  bbc:         '#f97316',
  skysports:   '#3b82f6',
  sky:         '#3b82f6',
  guardian:    '#22c55e',
  reddit:      '#f97316',
  'r/':        '#f97316',
};

function sourceColor(name) {
  const key = (name || '').toLowerCase().replace(/\s+/g, '');
  for (const [k, v] of Object.entries(SOURCE_COLORS)) {
    if (key.startsWith(k) || key.includes(k)) return v;
  }
  return '#524e4b';
}

function shortenSource(name) {
  if (!name) return '?';
  if (name.startsWith('Reddit r/')) return name.slice(7);
  if (name === 'The Guardian') return 'Guardian';
  if (name === 'BBC Sport') return 'BBC';
  if (name === 'Sky Sports') return 'Sky';
  if (name === 'Google News') return 'GNews';
  return name.slice(0, 12);
}

function fmtNum(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function NewsFeed({ activeSport, onDataLoaded }) {
  const [cards, setCards]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);

  const abortRef      = useRef(null);
  const retryRef      = useRef(null);
  const retryStartRef = useRef(null);

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
    <div style={{ padding: '12px 16px' }}>
      <SectionHeader sport={activeSport} total={total} />
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonStory key={i} />)}
        </div>
      ) : cards.length === 0 ? (
        <EmptyFeed sport={activeSport} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {cards.map((card, i) => (
            <StoryCard key={card.id} card={card} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ sport, total }) {
  return (
    <div style={{ marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 800,
        color: 'var(--text-muted)', letterSpacing: '0.12em',
      }}>
        TOP STORIES
      </span>
      {sport !== 'All' && (
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
          color: SPORT_COLORS[sport] || 'var(--text-muted)', letterSpacing: '0.1em',
        }}>
          · {sport.toUpperCase()}
        </span>
      )}
      {total > 0 && (
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {total}
        </span>
      )}
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
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.035, 0.35), ease: [0.22, 1, 0.36, 1] }}
      style={{ display: 'flex', overflow: 'hidden', cursor: 'pointer' }}
      onClick={() => card.sources?.[0]?.url && window.open(card.sources[0].url, '_blank')}
      onMouseEnter={e => { e.currentTarget.querySelector('.story-inner').style.background = 'var(--bg-card-hover)'; }}
      onMouseLeave={e => { e.currentTarget.querySelector('.story-inner').style.background = 'var(--bg-card)'; }}
    >
      {/* Left sport accent bar */}
      <div style={{ width: 3, flexShrink: 0, background: sportColor }} />

      <div className="story-inner" style={{
        flex: 1, background: 'var(--bg-card)',
        borderTop: '1px solid var(--border)',
        borderRight: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        transition: 'background 0.1s',
        minWidth: 0,
      }}>
        <div style={{ padding: '10px 12px 0' }}>
          {/* Sport chip + upvotes */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 800,
              letterSpacing: '0.12em', color: sportColor,
            }}>
              {card.sport_tag || 'SPORT'}
            </span>
            {card.reddit_upvotes > 0 && (
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--orange)' }}>
                ▲ {fmtNum(card.reddit_upvotes)}
              </span>
            )}
            {card.is_breaking && (
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
                color: 'var(--negative)', border: '1px solid rgba(231,76,60,0.4)',
                borderRadius: 2, padding: '0 4px',
              }}>
                BREAKING
              </span>
            )}
          </div>

          {/* Headline — Bricolage Grotesque */}
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700,
            color: 'var(--text-primary)', lineHeight: '1.25', marginBottom: 4,
            letterSpacing: '0.01em',
          }}>
            {card.headline}
          </p>

          {/* Summary — Space Grotesk body text */}
          {card.summary && card.summary !== card.headline && (
            <p style={{
              fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-secondary)',
              lineHeight: '1.5', marginBottom: 8,
              display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {card.summary}
            </p>
          )}

          {/* Source pills + market badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', paddingBottom: 8 }}>
            {displaySources.map((s, i) => (
              <a
                key={i}
                href={s.url && !s.url.includes('news.google.com') ? s.url : undefined}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text-muted)',
                  border: '1px solid var(--border)', borderRadius: 2,
                  padding: '2px 5px', textDecoration: 'none', whiteSpace: 'nowrap',
                  transition: 'border-color 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.stopPropagation(); }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: sourceColor(s.name), flexShrink: 0 }} />
                {shortenSource(s.name)}
              </a>
            ))}
            {extra > 0 && (
              <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text-muted)', padding: '2px 3px' }}>
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
                  fontSize: 9, fontFamily: 'var(--mono)', fontWeight: 700,
                  color: 'var(--positive)', border: '1px solid rgba(34,197,94,0.3)',
                  background: 'rgba(34,197,94,0.07)', borderRadius: 2,
                  padding: '2px 6px', textDecoration: 'none', letterSpacing: '0.04em',
                }}
              >
                ODDS {card.market_match.yes_price}¢
              </a>
            )}
          </div>
        </div>

        {/* Relevance bar — thin line at bottom */}
        <div style={{ height: 2, background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: '100%',
            background: sportColor,
            transformOrigin: 'left',
            transform: `scaleX(${relevancePct / 100})`,
            opacity: 0.5,
            transition: 'transform 0.5s ease-out',
          }} />
        </div>
      </div>
    </motion.div>
  );
}

function SkeletonStory() {
  return (
    <div style={{ display: 'flex' }}>
      <div style={{ width: 3, background: 'var(--border)', flexShrink: 0 }} />
      <div style={{
        flex: 1, background: 'var(--bg-card)',
        border: '1px solid var(--border)', borderLeft: 'none',
        padding: '10px 12px',
      }}>
        <div className="skeleton" style={{ height: 9, width: '20%', borderRadius: 1, marginBottom: 7 }} />
        <div className="skeleton" style={{ height: 16, width: '90%', borderRadius: 1, marginBottom: 4 }} />
        <div className="skeleton" style={{ height: 11, width: '75%', borderRadius: 1, marginBottom: 4 }} />
        <div className="skeleton" style={{ height: 9, width: '40%', borderRadius: 1 }} />
      </div>
    </div>
  );
}

function EmptyFeed({ sport }) {
  return (
    <div style={{
      textAlign: 'center', padding: '56px 16px',
      color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: 11,
      letterSpacing: '0.08em',
    }}>
      <div style={{ fontSize: 20, marginBottom: 8, opacity: 0.4 }}>📡</div>
      NO STORIES FOR {sport === 'All' ? 'ALL SPORTS' : sport.toUpperCase()} YET
      <div style={{ fontSize: 9, marginTop: 4, color: 'var(--text-muted)' }}>
        SOURCES SCRAPED EVERY 10 MINUTES
      </div>
    </div>
  );
}
