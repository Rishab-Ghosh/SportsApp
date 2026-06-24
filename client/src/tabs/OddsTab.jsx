import React, { useState, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import SportBadge from '../components/SportBadge';
import OddsBar from '../components/OddsBar';
import { SkeletonCard } from '../components/Skeleton';

const FILTERS = ['All', 'NBA', 'NFL', 'MLB', 'Soccer', 'F1', 'Tennis'];
const SORTS = ['Volume', 'Movement', 'Closing Soon'];

function fmtVolume(v) {
  if (!v) return '—';
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
  return `$${v}`;
}

function timeLeft(ts) {
  if (!ts) return { label: '—', urgent: false };
  const diff = new Date(ts) - Date.now();
  if (diff < 0) return { label: 'Closed', urgent: false };
  const days = Math.floor(diff / 86400000);
  if (days > 0) return { label: `${days}d`, urgent: false };
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return { label: `${hours}h`, urgent: hours < 3 };
  const mins = Math.floor(diff / 60000);
  return { label: `${mins}m`, urgent: true };
}

export default function OddsTab() {
  const { data, loading, error } = useApi('/api/kalshi/sports-markets');
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState('Volume');

  const markets = useMemo(() => {
    let list = data?.markets || [];
    if (filter !== 'All') list = list.filter(m => m.sport_tag === filter);
    if (sort === 'Volume') list = [...list].sort((a, b) => (b.volume || 0) - (a.volume || 0));
    else if (sort === 'Closing Soon') {
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

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-xs font-mono font-semibold border transition-all ${
                filter === f
                  ? 'bg-accent border-accent text-white'
                  : 'bg-card border-border text-muted hover:text-label hover:border-label'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <span className="text-[10px] text-muted font-mono self-center mr-1">SORT:</span>
          {SORTS.map(s => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono border transition-all ${
                sort === s
                  ? 'bg-accent/20 border-accent/60 text-accent'
                  : 'bg-card border-border text-muted hover:text-label'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-6 mb-4 p-3 bg-card border border-border rounded text-xs font-mono">
        <div>
          <span className="text-muted">MARKETS </span>
          <span className="text-accent font-semibold">{markets.length}</span>
        </div>
        <div>
          <span className="text-muted">TOTAL VOL </span>
          <span className="text-positive font-semibold">
            {fmtVolume(markets.reduce((s, m) => s + (m.volume || 0), 0))}
          </span>
        </div>
        <div>
          <span className="text-muted">FILTER </span>
          <span className="text-label font-semibold">{filter}</span>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-negative/10 border border-negative/30 rounded text-negative text-xs font-mono mb-4">
          API Error: {error} — showing cached or mock data
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} lines={4} />)}
        </div>
      ) : markets.length === 0 ? (
        <div className="text-center py-16 text-muted font-mono text-sm">
          No markets for <span className="text-label">{filter}</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          {markets.map(m => <MarketCard key={m.id} market={m} />)}
        </div>
      )}
    </div>
  );
}

function MarketCard({ market }) {
  const { label: tl, urgent } = timeLeft(market.close_time);
  const yes = market.yes_price ?? 50;
  const movement = Math.abs(yes - 50);
  const isHot = movement > 25 || (market.volume || 0) > 50000;

  return (
    <div className={`bg-card border rounded p-4 hover:border-accent/50 transition-all ${
      isHot ? 'border-accent/30' : 'border-border'
    }`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          {isHot && (
            <div className="text-[9px] font-mono font-semibold text-accent tracking-widest mb-1">🔥 HOT</div>
          )}
          <p className="text-sm text-gray-100 leading-snug font-medium">{market.title}</p>
        </div>
        <SportBadge sport={market.sport_tag} size="xs" />
      </div>

      <OddsBar yesPrice={yes} noPrice={market.no_price} />

      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border">
        <Stat label="VOL" value={fmtVolume(market.volume)} />
        <Stat label="CLOSES" value={tl} urgent={urgent} />
        <Stat label="YES" value={`${yes}¢`} color="text-positive" />
      </div>
    </div>
  );
}

function Stat({ label, value, urgent, color }) {
  return (
    <div className="text-center">
      <div className="text-[9px] font-mono text-muted tracking-widest">{label}</div>
      <div className={`text-xs font-mono font-semibold mt-0.5 ${urgent ? 'text-negative' : color || 'text-gray-200'}`}>
        {value}
      </div>
    </div>
  );
}
