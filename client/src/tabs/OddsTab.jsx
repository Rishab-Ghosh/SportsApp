import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useApi } from '../hooks/useApi';
import SportBadge from '../components/SportBadge';
import PriceChart from '../components/PriceChart';
import { SkeletonCard } from '../components/Skeleton';

const FILTERS = ['All', 'NBA', 'NFL', 'MLB', 'Soccer', 'F1', 'Tennis'];
const SORTS   = ['Volume', 'Score', 'Closing Soon'];

// Defensive guard: "yes A,yes B,yes C" → clean title
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
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

function timeLeft(ts) {
  if (!ts) return { label: '—', urgent: false };
  const diff = new Date(ts) - Date.now();
  if (diff < 0) return { label: 'Closed', urgent: false };
  const days = Math.floor(diff / 86400000);
  if (days > 30) return { label: `${Math.floor(days / 30)}mo`, urgent: false };
  if (days > 0)  return { label: `${days}d`, urgent: false };
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return { label: `${hours}h`, urgent: hours < 3 };
  return { label: `${Math.floor(diff / 60000)}m`, urgent: true };
}

export default function OddsTab() {
  const { data, loading, error } = useApi('/api/kalshi/sports-markets');
  const [filter, setFilter]     = useState('All');
  const [sort, setSort]         = useState('Volume');
  const [showAll, setShowAll]   = useState(false);
  const [expanded, setExpanded] = useState(null);
  const prefersReduced = useReducedMotion();

  // Re-fetch with showAll toggle
  const { data: rawData } = useApi(
    showAll ? '/api/kalshi/sports-markets?showAll=1' : null
  );
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
    // Score sort uses server ordering (already scored by default)
    return list;
  }, [sourceData, filter, sort]);

  const totalVol = markets.reduce((s, m) => s + (m.volume || 0), 0);

  const containerVariants = {
    hidden: {},
    show: { transition: { staggerChildren: prefersReduced ? 0 : 0.03 } },
  };
  const cardVariants = {
    hidden: { opacity: 0, y: prefersReduced ? 0 : 10 },
    show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <div>
      {/* Filter + sort row */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold border transition-colors ${
                filter === f
                  ? 'bg-accent border-accent text-white'
                  : 'bg-transparent border-border text-muted hover:text-label hover:border-label'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 items-center">
          <span className="text-[10px] text-muted font-mono tracking-widest">SORT</span>
          {SORTS.map(s => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono border transition-colors ${
                sort === s
                  ? 'bg-accent/15 border-accent/50 text-accent'
                  : 'bg-transparent border-border text-muted hover:text-label'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Stats + showAll toggle */}
      <div className="flex items-center gap-6 mb-5 px-4 py-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-md text-xs font-mono">
        <div><span className="text-muted">MARKETS </span><span className="text-accent font-semibold">{markets.length}</span></div>
        <div><span className="text-muted">VOLUME </span><span className="text-positive font-semibold">{fmtVolume(totalVol)}</span></div>
        <div><span className="text-muted">FILTER </span><span className="text-label font-semibold">{filter}</span></div>
        <button
          onClick={() => setShowAll(v => !v)}
          className={`ml-auto text-[10px] font-mono border rounded px-2 py-0.5 transition-colors ${
            showAll
              ? 'border-orange/50 text-orange bg-orange/10'
              : 'border-border text-muted hover:text-label'
          }`}
        >
          {showAll ? 'FILTERED OFF' : 'SHOW ALL'}
        </button>
      </div>

      {error && (
        <div className="p-3 mb-4 bg-negative/10 border border-negative/30 rounded text-negative text-xs font-mono">
          API Error: {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} lines={5} />)}
        </div>
      ) : markets.length === 0 ? (
        <div className="text-center py-16 text-muted font-mono text-sm">
          No markets for <span className="text-label">{filter}</span>
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-2 gap-4"
          variants={containerVariants}
          initial="hidden"
          animate="show"
          key={`${filter}-${sort}-${showAll}`}
        >
          {markets.map((m) => (
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
  const yes = market.yes_price ?? 50;
  const no  = 100 - yes;
  const title = cleanTitle(market.title, market.event_ticker);

  // Price flash on live update
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
      className={`group bg-[var(--bg-card)] border rounded-lg cursor-pointer overflow-hidden
        transition-all duration-150 ease-out
        ${isExpanded ? 'border-accent/50' : 'border-[var(--border)] hover:border-[var(--border-hover)]'}
      `}
      style={{ transform: 'translateY(0)' }}
      onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
      onClick={onToggle}
    >
      {/* Thin accent top-line for hot markets */}
      {(market.volume || 0) > 50000 && (
        <div className="h-[2px] bg-accent w-full" />
      )}

      <div className="p-4">
        {/* Title + badge */}
        <div className="flex items-start gap-2 mb-4">
          <p className="text-[13px] text-[var(--text-primary)] leading-snug font-medium line-clamp-2 flex-1 min-w-0">
            {title}
          </p>
          <SportBadge sport={market.sport_tag} size="xs" />
        </div>

        {/* YES price as hero */}
        <div className="flex items-end gap-3 mb-3">
          <div className={`${flash} rounded`}>
            <span className="font-mono font-bold tabular-nums leading-none"
              style={{ fontSize: 32, color: 'var(--positive)' }}>
              {yes}
            </span>
            <span className="text-muted font-mono text-xs ml-0.5">¢</span>
          </div>
          <div className="mb-0.5">
            <div className="text-[9px] font-mono text-muted tracking-widest">YES</div>
          </div>
          <div className="ml-auto text-right mb-0.5">
            <span className="font-mono font-semibold tabular-nums text-[var(--negative)] text-lg">{no}</span>
            <span className="text-muted font-mono text-[10px] ml-0.5">¢ NO</span>
          </div>
        </div>

        {/* Single probability bar: YES fills in accent, remainder muted */}
        <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-accent rounded-full origin-left"
            style={{
              transform: `scaleX(${yes / 100})`,
              transition: 'transform 0.4s ease-out',
            }}
          />
        </div>

        {/* Metadata footer */}
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <span className="text-muted">VOL <span className="text-label">{fmtVolume(market.volume)}</span></span>
          <span className={urgent ? 'text-negative font-semibold' : 'text-muted'}>
            ⏱ {tl}
          </span>
        </div>
      </div>

      {/* Expanded detail: price history */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            key="chart"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="border-t border-[var(--border)] px-4 pb-4 pt-3">
              <div className="text-[9px] font-mono text-muted tracking-widest mb-2">PRICE HISTORY (7D)</div>
              <PriceChart marketId={market.id} height={110} showAxes />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
