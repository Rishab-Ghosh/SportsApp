import React, { useState, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { useWebSocket } from '../hooks/useWebSocket';
import SportBadge from '../components/SportBadge';
import OddsBar from '../components/OddsBar';
import TimeAgo from '../components/TimeAgo';
import { SkeletonCard } from '../components/Skeleton';

const SPORTS = [
  { id: 'NBA', apiId: 'nba', label: 'NBA', color: '#f97316' },
  { id: 'NFL', apiId: 'nfl', label: 'NFL', color: '#22c55e' },
  { id: 'MLB', apiId: 'mlb', label: 'MLB', color: '#ef4444' },
  { id: 'Soccer', apiId: 'soccer', label: 'Soccer', color: '#22c55e' },
  { id: 'F1', apiId: 'f1', label: 'F1', color: '#dc2626' },
];

const SPORT_DESCRIPTIONS = {
  NBA: 'NBA Free Agency opens July 1st — peak roster activity',
  NFL: 'Training camps approaching, early roster moves active',
  MLB: 'Midseason run — trade deadline pressure building',
  Soccer: 'Summer transfer window open — major moves expected',
  F1: 'Summer break approaching after Canadian GP',
};

// Heat gauge color based on 0-40 / 41-65 / 66-85 / 86-100
function heatColor(score) {
  if (score >= 86) return '#ef4444';
  if (score >= 66) return '#f97316';
  if (score >= 41) return '#eab308';
  return '#6b7280';
}

function heatLabel(score) {
  if (score >= 86) return { text: 'RED HOT', cls: 'text-negative' };
  if (score >= 66) return { text: 'ACTIVE', cls: 'text-orange-400' };
  if (score >= 41) return { text: 'WARMING', cls: 'text-yellow-400' };
  return { text: 'COOL', cls: 'text-muted' };
}

export default function TrackerTab() {
  const [activeSport, setActiveSport] = useState(SPORTS[0]);

  // Heat scores: prefer WS data, fall back to HTTP fetch
  const wsData = useWebSocket();
  const { data: heatData, loading: heatLoading } = useApi('/api/heat-scores');
  const heatScores = wsData?.heatScores || heatData;

  // Tracker cards for the active sport
  const { data: trackerData, loading: trackerLoading } = useApi(
    `/api/tracker/${activeSport.apiId}`,
    [activeSport.apiId]
  );

  const currentScore = heatScores?.[activeSport.id] ?? null;
  const cards = trackerData?.cards || [];
  const news = trackerData?.news || [];

  return (
    <div>
      {/* Sport tabs */}
      <div className="flex gap-2 mb-6">
        {SPORTS.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSport(s)}
            className={`px-4 py-1.5 rounded text-sm font-mono font-semibold border transition-all ${
              activeSport.id === s.id
                ? 'bg-accent border-accent text-white'
                : 'bg-card border-border text-muted hover:text-label hover:border-label'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Heat gauge */}
      <div className="mb-6">
        {heatLoading && currentScore === null ? (
          <div className="skeleton h-36 rounded" />
        ) : (
          <HeatGauge
            sport={activeSport}
            score={currentScore ?? 50}
            description={SPORT_DESCRIPTIONS[activeSport.id] || ''}
            liveFromWs={!!wsData?.heatScores}
          />
        )}
      </div>

      {/* Tracker cards */}
      <div className="mb-6">
        <SectionHeader
          label="PREDICTION MARKETS"
          sub={`Kalshi · ${activeSport.label} markets`}
          badge={cards.length > 0 ? `${cards.length} markets` : null}
        />
        {trackerLoading ? (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={5} />)}
          </div>
        ) : cards.length === 0 ? (
          <RumorCards news={news} sport={activeSport} />
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            {cards.map(c => <TrackerCard key={c.market_id} card={c} />)}
          </div>
        )}
      </div>

      {/* News — only show when there are cards (separate section from RumorCards) */}
      {cards.length > 0 && news.length > 0 && (
        <div>
          <SectionHeader label="LATEST NEWS" sub={`Top ${activeSport.label} headlines`} />
          <div className="grid grid-cols-2 gap-3">
            {news.map((a, i) => <NewsCard key={i} article={a} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Heat Gauge ───────────────────────────────────────────────────────────────

function HeatGauge({ sport, score, description, liveFromWs }) {
  const color = heatColor(score);
  const { text: labelText, cls: labelCls } = heatLabel(score);

  // SVG arc geometry
  const cx = 120, cy = 110, r = 80;
  const startA = -220, endA = 40;

  function describeArc(fromA, toA) {
    const toRad = a => (a * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(fromA));
    const y1 = cy + r * Math.sin(toRad(fromA));
    const x2 = cx + r * Math.cos(toRad(toA));
    const y2 = cy + r * Math.sin(toRad(toA));
    const largeArc = toA - fromA > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  }

  const fillEnd = startA + (score / 100) * (endA - startA);
  const needleAngle = startA + (score / 100) * (endA - startA);

  // Sub-arc color bands: draw 0-40 gray, 41-65 yellow, 66-85 orange, 86-100 red
  const bands = [
    { from: 0, to: 40, color: '#4b5563' },
    { from: 40, to: 65, color: '#ca8a04' },
    { from: 65, to: 85, color: '#ea580c' },
    { from: 85, to: 100, color: '#dc2626' },
  ];

  return (
    <div className="bg-card border border-border rounded p-6">
      <div className="flex items-start gap-8">
        <div className="flex flex-col items-center shrink-0">
          <svg width={240} height={148} viewBox="0 0 240 148">
            {/* Track (full arc) */}
            <path d={describeArc(startA, endA)} fill="none" stroke="#1e1e2e" strokeWidth={16} strokeLinecap="round" />

            {/* Colored band segments */}
            {bands.map((b, i) => {
              const bStart = startA + (b.from / 100) * (endA - startA);
              const bEnd = startA + (b.to / 100) * (endA - startA);
              const activeEnd = startA + (score / 100) * (endA - startA);
              const segEnd = Math.min(bEnd, activeEnd);
              if (segEnd <= bStart) return null;
              return (
                <path
                  key={i}
                  d={describeArc(bStart, segEnd)}
                  fill="none"
                  stroke={b.color}
                  strokeWidth={16}
                  strokeLinecap="round"
                />
              );
            })}

            {/* Needle */}
            <line
              x1={cx}
              y1={cy}
              x2={cx + 62 * Math.cos((needleAngle * Math.PI) / 180)}
              y2={cy + 62 * Math.sin((needleAngle * Math.PI) / 180)}
              stroke={color}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
            <circle cx={cx} cy={cy} r={5} fill={color} />

            {/* Score label in center */}
            <text x={cx} y={cy + 32} fill={color} fontSize={22} fontFamily="monospace" textAnchor="middle" fontWeight="700">
              {score}
            </text>

            {/* COLD / HOT labels */}
            <text x={35} y={132} fill="#4b5563" fontSize={9} fontFamily="monospace" textAnchor="middle">COLD</text>
            <text x={205} y={132} fill="#dc2626" fontSize={9} fontFamily="monospace" textAnchor="middle">HOT</text>
          </svg>
          <span className={`text-[11px] font-mono font-bold tracking-widest mt-1 ${labelCls}`}>{labelText}</span>
        </div>

        <div className="flex-1 pt-2 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <SportBadge sport={sport.id} />
            <span className="text-xs font-mono font-semibold text-gray-100">Heat Score</span>
            {liveFromWs && (
              <span className="text-[9px] font-mono text-accent border border-accent/40 rounded px-1 py-0.5">WS LIVE</span>
            )}
          </div>
          <p className="text-sm text-label mb-4 leading-relaxed">{description}</p>
          <HeatBreakdown score={score} />
        </div>
      </div>
    </div>
  );
}

function HeatBreakdown({ score }) {
  const bars = [
    { label: 'Media Coverage', val: Math.min(100, Math.max(0, score + 5)) },
    { label: 'Market Activity', val: Math.min(100, Math.max(0, score - 5)) },
    { label: 'Transfer/Trade Buzz', val: Math.min(100, Math.max(0, score + 10)) },
    { label: 'Fan Engagement', val: Math.min(100, Math.max(0, score - 10)) },
  ];
  return (
    <div className="space-y-2">
      {bars.map(b => (
        <div key={b.label}>
          <div className="flex justify-between mb-0.5">
            <span className="text-[10px] font-mono text-muted">{b.label}</span>
            <span className="text-[10px] font-mono text-label">{b.val}</span>
          </div>
          <div className="h-1 bg-border rounded overflow-hidden">
            <div
              className="h-full rounded transition-all duration-700"
              style={{ width: `${b.val}%`, backgroundColor: heatColor(b.val) }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tracker Card ─────────────────────────────────────────────────────────────

function TrackerCard({ card }) {
  const yes = card.yes_price ?? 50;
  const no = card.no_price ?? (100 - yes);
  const volPct = card.volume_pct ?? 0;
  const vol = card.volume ?? 0;

  return (
    <div className="bg-card border border-border rounded p-4 hover:border-accent/40 transition-colors flex flex-col gap-3">
      {/* Title */}
      <p className="text-xs font-medium text-gray-200 leading-snug line-clamp-2">{card.market_title}</p>

      {/* YES / NO big numbers */}
      <div className="flex items-baseline gap-3">
        <span className="font-mono font-bold text-2xl text-positive tabular-nums">{yes}¢</span>
        <span className="text-[11px] font-mono text-muted">YES</span>
        <span className="font-mono font-semibold text-base text-negative tabular-nums ml-auto">{no}¢</span>
        <span className="text-[11px] font-mono text-muted">NO</span>
      </div>

      {/* YES/NO bar */}
      <OddsBar yesPrice={yes} noPrice={no} compact />

      {/* Volume bar */}
      <div>
        <div className="flex justify-between text-[10px] font-mono text-muted mb-1">
          <span>VOLUME</span>
          <span className="text-label">
            {vol >= 1000000 ? `${(vol / 1000000).toFixed(1)}M` : vol >= 1000 ? `${(vol / 1000).toFixed(0)}K` : vol}
          </span>
        </div>
        <div className="h-1 bg-border rounded overflow-hidden">
          <div className="h-full bg-accent rounded" style={{ width: `${Math.max(2, volPct * 100)}%` }} />
        </div>
      </div>

      {/* Time to close */}
      <CloseTime ts={card.close_time} />

      {/* Related news */}
      {card.related_news?.length > 0 && (
        <div className="border-t border-border pt-2 space-y-1.5">
          {card.related_news.map((a, i) => (
            <a
              key={i}
              href={a.url !== '#' ? a.url : undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-1.5 group"
            >
              <span className="text-accent mt-0.5 shrink-0">›</span>
              <div className="min-w-0">
                <p className="text-[10px] text-muted group-hover:text-label transition-colors line-clamp-2 leading-snug">
                  {a.title}
                </p>
                <div className="flex gap-1.5 mt-0.5">
                  <span className="text-[9px] font-mono text-muted">{a.source}</span>
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

// When no Kalshi markets exist, show top news in a dashed "rumor" card style
function RumorCards({ news, sport }) {
  if (news.length === 0) {
    return (
      <div className="text-center py-8 text-muted text-xs font-mono">
        No prediction markets or news for {sport.label} right now
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      {news.map((a, i) => (
        <a
          key={i}
          href={a.url !== '#' ? a.url : undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="block border border-dashed border-border rounded p-3 hover:border-muted/60 transition-colors group opacity-75 hover:opacity-100"
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[9px] font-mono text-muted border border-muted/40 rounded px-1 py-0.5">RUMOR</span>
            <TimeAgo date={a.publishedAt} />
          </div>
          <p className="text-xs text-gray-300 leading-snug group-hover:text-white transition-colors line-clamp-3">
            {a.title}
          </p>
          <p className="text-[10px] font-mono text-muted mt-1">{a.source}</p>
        </a>
      ))}
    </div>
  );
}

function CloseTime({ ts }) {
  if (!ts) return null;
  const diff = new Date(ts) - Date.now();
  if (diff < 0) return <span className="text-[10px] font-mono text-muted">Closed</span>;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const label = days > 0 ? `Closes in ${days}d ${hours}h` : `Closes in ${hours}h`;
  return (
    <span className={`text-[10px] font-mono ${diff < 86400000 * 2 ? 'text-negative' : 'text-muted'}`}>
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
      className="bg-card border border-border rounded p-3 hover:border-accent/40 transition-colors block group"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-mono text-muted">{article.source}</span>
        <TimeAgo date={article.publishedAt} />
      </div>
      <p className="text-xs text-gray-200 leading-snug group-hover:text-white transition-colors line-clamp-3">
        {article.title}
      </p>
    </a>
  );
}

function SectionHeader({ label, sub, badge }) {
  return (
    <div className="mb-3 pb-1.5 border-b border-border flex items-end justify-between">
      <div>
        <div className="text-xs font-mono font-semibold text-accent tracking-widest">{label}</div>
        {sub && <div className="text-[10px] text-muted font-mono">{sub}</div>}
      </div>
      {badge && (
        <span className="text-[10px] font-mono text-muted bg-border rounded px-1.5 py-0.5 mb-0.5">{badge}</span>
      )}
    </div>
  );
}
