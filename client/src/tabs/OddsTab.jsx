import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useApi } from '../hooks/useApi';
import PriceChart from '../components/PriceChart';
import { SkeletonCard } from '../components/Skeleton';

const FILTERS = ['All', 'NBA', 'NFL', 'MLB', 'Soccer', 'F1', 'Tennis'];
const SORTS   = ['Volume', 'Score', 'Closing Soon'];

const SPORT_COLORS = {
  NBA:    '#f97316',
  NFL:    '#22c55e',
  MLB:    '#3b82f6',
  Soccer: '#6366f1',
  F1:     '#e74c3c',
  Tennis: '#f5c518',
};

function cleanTitle(title, event_ticker) {
  if (!title) return event_ticker || 'Unnamed market';
  if (/^(yes|no)\s+\S+,(yes|no)/i.test(title.trim())) {
    const legs = title.split(',').length;
    const base = event_ticker?.replace(/^[A-Z0-9]+-/, '').replace(/-/g, ' ').trim();
    return base ? `${base} — ${legs} legs` : `${legs}-leg market`;
  }
  return title;
}

function fmtVolume(v) {
  if (!v) return '—';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000)      return `$${(v / 1000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

function timeLeft(ts) {
  if (!ts) return { label: '—', urgent: false };
  const diff = new Date(ts) - Date.now();
  if (diff < 0) return { label: 'CLOSED', urgent: false };
  const days = Math.floor(diff / 86400000);
  if (days > 30) return { label: `${Math.floor(days / 30)}MO`, urgent: false };
  if (days > 0)  return { label: `${days}D`, urgent: false };
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return { label: `${hours}H`, urgent: hours < 3 };
  return { label: `${Math.floor(diff / 60000)}M`, urgent: true };
}

export default function OddsTab() {
  const { data, loading, error } = useApi('/api/kalshi/sports-markets');
  const [filter, setFilter]   = useState('All');
  const [sort, setSort]       = useState('Volume');
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const prefersReduced = useReducedMotion();

  const { data: rawData } = useApi(showAll ? '/api/kalshi/sports-markets?showAll=1' : null);
  const sourceData = showAll ? rawData : data;

  const markets = useMemo(() => {
    let list = sourceData?.markets || [];
    if (filter !== 'All') list = list.filter(m => m.sport_tag === filter);
    if (sort === 'Volume') {
      list = [...list].sort((a, b) => (b.volume || 0) - (a.volume || 0));
    } else if (sort === 'Closing Soon') {
      list = [...list].sort((a, b) => {
        const ta = a.close_time ? new Date(a.close_time).getTime() : Infinity;
        const tb = b.close_time ? new Date(b.close_time).getTime() : Infinity;
        return ta - tb;
      });
    }
    return list;
  }, [sourceData, filter, sort]);

  const totalVol = markets.reduce((s, m) => s + (m.volume || 0), 0);

  const containerVariants = {
    hidden: {},
    show:   { transition: { staggerChildren: prefersReduced ? 0 : 0.03 } },
  };
  const cardVariants = {
    hidden: { opacity: 0, y: prefersReduced ? 0 : 8 },
    show:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <div>
      {/* Filter row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {FILTERS.map(f => {
            const active = filter === f;
            const sportColor = SPORT_COLORS[f];
            return (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '4px 11px', borderRadius: 2, cursor: 'pointer',
                background: active ? (sportColor ? `${sportColor}22` : 'rgba(56,189,248,0.12)') : 'transparent',
                border: `1px solid ${active ? (sportColor || 'var(--accent)') : 'var(--border)'}`,
                color: active ? (sportColor || 'var(--accent)') : 'var(--text-muted)',
                fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
                letterSpacing: '0.08em', transition: 'all 0.1s',
              }}>
                {f.toUpperCase()}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>SORT</span>
          {SORTS.map(s => (
            <button key={s} onClick={() => setSort(s)} style={{
              padding: '3px 9px', borderRadius: 2, cursor: 'pointer',
              background: sort === s ? 'rgba(56,189,248,0.1)' : 'transparent',
              border: `1px solid ${sort === s ? 'rgba(56,189,248,0.4)' : 'var(--border)'}`,
              color: sort === s ? 'var(--accent)' : 'var(--text-muted)',
              fontFamily: 'var(--mono)', fontSize: 10, transition: 'all 0.1s',
            }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 20, marginBottom: 14,
        padding: '7px 12px', background: 'var(--bg-card)',
        border: '1px solid var(--border)', borderRadius: 2,
        fontFamily: 'var(--mono)', fontSize: 10,
      }}>
        <div>
          <span style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>MARKETS </span>
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{markets.length}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>VOLUME </span>
          <span style={{ color: 'var(--positive)', fontWeight: 700 }}>{fmtVolume(totalVol)}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>FILTER </span>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{filter.toUpperCase()}</span>
        </div>
        <button
          onClick={() => setShowAll(v => !v)}
          style={{
            marginLeft: 'auto', padding: '2px 8px', borderRadius: 2, cursor: 'pointer',
            border: `1px solid ${showAll ? 'rgba(249,115,22,0.5)' : 'var(--border)'}`,
            background: showAll ? 'rgba(249,115,22,0.1)' : 'transparent',
            color: showAll ? 'var(--orange)' : 'var(--text-muted)',
            fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em',
          }}
        >
          {showAll ? 'FILTER ON' : 'SHOW ALL'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '8px 12px', marginBottom: 12, background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.25)', borderRadius: 2, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--negative)' }}>
          API Error: {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} lines={5} />)}
        </div>
      ) : markets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
          NO MARKETS FOR <span style={{ color: 'var(--text-secondary)' }}>{filter.toUpperCase()}</span>
        </div>
      ) : (
        <motion.div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}
          variants={containerVariants}
          initial="hidden"
          animate="show"
          key={`${filter}-${sort}-${showAll}`}
        >
          {markets.map(m => (
            <motion.div key={m.id} variants={cardVariants}>
              <MarketCard
                market={m}
                isExpanded={expanded === m.id}
                onToggle={() => setExpanded(expanded === m.id ? null : m.id)}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

function MarketCard({ market, isExpanded, onToggle }) {
  const { label: tl, urgent } = timeLeft(market.close_time);
  const yes   = market.yes_price ?? 50;
  const no    = 100 - yes;
  const title = cleanTitle(market.title, market.event_ticker);
  const sportColor = SPORT_COLORS[market.sport_tag];

  const prevRef = useRef(yes);
  const [flash, setFlash] = useState('');
  useEffect(() => {
    if (prevRef.current !== yes) {
      setFlash(yes > prevRef.current ? 'price-flash-up' : 'price-flash-down');
      prevRef.current = yes;
      const id = setTimeout(() => setFlash(''), 700);
      return () => clearTimeout(id);
    }
  }, [yes]);

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${isExpanded ? 'rgba(56,189,248,0.35)' : 'var(--border)'}`,
        borderTop: `2px solid ${sportColor || 'var(--border-hover)'}`,
        borderRadius: 2, cursor: 'pointer', overflow: 'hidden',
        transition: 'border-color 0.12s, transform 0.12s',
        transform: 'translateY(0)',
      }}
      onMouseEnter={e => { if (!isExpanded) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderRightColor = 'var(--border-hover)'; e.currentTarget.style.borderBottomColor = 'var(--border-hover)'; e.currentTarget.style.borderLeftColor = 'var(--border-hover)'; }}}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; const c = isExpanded ? 'rgba(56,189,248,0.35)' : 'var(--border)'; e.currentTarget.style.borderRightColor = c; e.currentTarget.style.borderBottomColor = c; e.currentTarget.style.borderLeftColor = c; }}
      onClick={onToggle}
    >

      <div style={{ padding: '12px 12px 10px 10px' }}>
        {/* Sport tag + title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 10 }}>
          <div style={{ flexShrink: 0, marginTop: 1 }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 800,
              letterSpacing: '0.1em', color: sportColor || 'var(--text-muted)',
              display: 'block',
            }}>
              {market.sport_tag}
            </span>
          </div>
          <p style={{
            fontSize: 12, color: 'var(--text-secondary)', lineHeight: '1.4',
            fontFamily: 'var(--font-sans)', flex: 1, minWidth: 0,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {title}
          </p>
        </div>

        {/* YES price hero — Barlow Condensed */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 8 }}>
          <div className={flash} style={{ borderRadius: 2 }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 36, color: 'var(--positive)', lineHeight: 1, letterSpacing: '-0.01em',
            }}>
              {yes}
            </span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)', marginLeft: 2 }}>¢</span>
          </div>
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, color: 'var(--positive)', letterSpacing: '0.1em' }}>YES</div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right', marginBottom: 4 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--negative)', letterSpacing: '-0.01em' }}>{no}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-muted)', marginLeft: 2 }}>¢ NO</span>
          </div>
        </div>

        {/* Probability bar */}
        <div style={{ height: 2, background: 'var(--border)', overflow: 'hidden', marginBottom: 8 }}>
          <div style={{
            height: '100%', width: '100%',
            background: sportColor || 'var(--accent)',
            transformOrigin: 'left',
            transform: `scaleX(${yes / 100})`,
            transition: 'transform 0.4s ease-out',
          }} />
        </div>

        {/* Metadata */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
          <span>VOL <span style={{ color: 'var(--text-secondary)' }}>{fmtVolume(market.volume)}</span></span>
          <span style={{ color: urgent ? 'var(--negative)' : 'var(--text-muted)', fontWeight: urgent ? 700 : 400 }}>
            ⏱ {tl}
          </span>
        </div>
      </div>

      {/* Expanded chart */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ borderTop: '1px solid var(--border)', padding: '10px 12px 12px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 8 }}>
                PRICE HISTORY · 7D
              </div>
              <PriceChart marketId={market.id} height={110} showAxes />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
