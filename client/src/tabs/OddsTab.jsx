import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import SportBadge from '../components/SportBadge';
import OddsBar from '../components/OddsBar';
import PriceChart from '../components/PriceChart';
import { SkeletonCard } from '../components/Skeleton';

const FILTERS = ['All', 'NBA', 'NFL', 'MLB', 'Soccer', 'F1', 'Tennis'];
const SORTS   = ['Volume', 'Closing Soon', 'Movement'];

// Clean market titles — defensive guard against any raw parlay strings that slip through.
// Format: "yes A,yes B,yes C" → "3 outcome parlay"
function cleanTitle(title, event_ticker) {
  if (!title) return event_ticker || 'Unnamed market';
  // Multi-leg parlay: "yes X,yes Y" or "no X,yes Y" comma-separated list
  if (/^(yes|no)\s+\S+,(yes|no)/i.test(title.trim())) {
    const legs = title.split(',').length;
    const eventBase = event_ticker
      ? event_ticker.replace(/^[A-Z0-9]+-/, '').replace(/-/g, ' ').trim()
      : null;
    return eventBase ? `${eventBase} — ${legs} legs` : `${legs}-leg market`;
  }
  return title;
}

function fmtVolume(v) {
  if (!v) return '—';
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
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
  const [filter, setFilter] = useState('All');
  const [sort, setSort]     = useState('Volume');
  const [expanded, setExpanded] = useState(null); // expanded card id for detail view

  const markets = useMemo(() => {
    let list = data?.markets || [];
    if (filter !== 'All') list = list.filter(m => m.sport_tag === filter);
    if (sort === 'Volume') {
      list = [...list].sort((a, b) => (b.volume || 0) - (a.volume || 0));
    } else if (sort === 'Closing Soon') {
      list = [...list].sort((a, b) => {
        const ta = a.close_time ? new Date(a.close_time).getTime() : Infinity;
        const tb = b.close_time ? new Date(b.close_time).getTime() : Infinity;
        return ta - tb;
      });
    } else if (sort === 'Movement') {
      list = [...list].sort((a, b) => {
        const ma = Math.abs((a.yes_price || 50) - 50);
        const mb = Math.abs((b.yes_price || 50) - 50);
        return mb - ma;
      });
    }
    return list;
  }, [data, filter, sort]);

  const totalVol = markets.reduce((s, m) => s + (m.volume || 0), 0);

  return (
    <div className="tab-content">
      {/* Controls */}
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
          <span className="text-[10px] text-muted font-mono tracking-widest">SORT:</span>
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

      {/* Stats row */}
      <div className="flex gap-6 mb-5 px-4 py-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-md text-xs font-mono">
        <div><span className="text-muted">MARKETS </span><span className="text-accent font-semibold">{markets.length}</span></div>
        <div><span className="text-muted">TOTAL VOL </span><span className="text-positive font-semibold">{fmtVolume(totalVol)}</span></div>
        <div><span className="text-muted">FILTER </span><span className="text-label font-semibold">{filter}</span></div>
      </div>

      {error && (
        <div className="p-3 mb-4 bg-negative/10 border border-negative/30 rounded text-negative text-xs font-mono">
          API Error: {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} lines={4} />)}
        </div>
      ) : markets.length === 0 ? (
        <div className="text-center py-16 text-muted font-mono text-sm">
          No markets for <span className="text-label">{filter}</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {markets.map((m, i) => (
            <MarketCard
              key={m.id}
              market={m}
              index={i}
              isExpanded={expanded === m.id}
              onToggle={() => setExpanded(expanded === m.id ? null : m.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MarketCard({ market, index, isExpanded, onToggle }) {
  const { label: tl, urgent } = timeLeft(market.close_time);
  const yes = market.yes_price ?? 50;
  const isHot = (market.volume || 0) > 50000 || Math.abs(yes - 50) > 25;
  const title = cleanTitle(market.title, market.event_ticker);
  const prevYes = useRef(yes);
  const [flashClass, setFlashClass] = useState('');

  // Flash price on change
  useEffect(() => {
    if (prevYes.current !== yes) {
      const direction = yes > prevYes.current ? 'price-flash-up' : 'price-flash-down';
      setFlashClass(direction);
      prevYes.current = yes;
      const id = setTimeout(() => setFlashClass(''), 700);
      return () => clearTimeout(id);
    }
  }, [yes]);

  return (
    <div
      className={`card-stagger bg-[var(--bg-card)] border rounded-lg transition-colors cursor-pointer ${
        isHot ? 'border-accent/25 hover:border-accent/50' : 'border-[var(--border)] hover:border-[var(--border-hover)]'
      }`}
      style={{ '--card-i': Math.min(index, 12) }}
      onClick={onToggle}
    >
      {/* Card body */}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-2 mb-3">
          <div className="flex-1 min-w-0">
            {isHot && (
              <div className="text-[9px] font-mono font-bold text-accent tracking-widest mb-1 uppercase">HOT</div>
            )}
            <p className="text-[13px] text-[var(--text-primary)] leading-snug font-medium line-clamp-2">
              {title}
            </p>
          </div>
          <SportBadge sport={market.sport_tag} size="xs" />
        </div>

        {/* Price bar */}
        <OddsBar yesPrice={yes} noPrice={market.no_price} />

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[var(--border)]">
          <Stat label="VOL" value={fmtVolume(market.volume)} />
          <Stat label="CLOSES" value={tl} urgent={urgent} />
          <Stat
            label="YES"
            value={`${yes}¢`}
            color="text-positive"
            className={flashClass}
          />
        </div>
      </div>

      {/* Expanded detail: real price history chart */}
      {isExpanded && (
        <div
          className="border-t border-[var(--border)] px-4 pb-4 pt-3"
          onClick={e => e.stopPropagation()}
        >
          <div className="text-[9px] font-mono text-muted tracking-widest mb-2">PRICE HISTORY (7D)</div>
          <PriceChart marketId={market.id} height={100} showAxes />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, urgent, color, className }) {
  return (
    <div className={`text-center rounded px-1 ${className || ''}`}>
      <div className="text-[9px] font-mono text-muted tracking-widest uppercase">{label}</div>
      <div className={`text-xs font-mono font-bold mt-0.5 tabular-nums ${urgent ? 'text-negative' : color || 'text-[var(--text-primary)]'}`}>
        {value}
      </div>
    </div>
  );
}
