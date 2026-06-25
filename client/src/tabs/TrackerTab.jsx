import React, { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useWebSocket } from '../hooks/useWebSocket';
import SportBadge from '../components/SportBadge';
import OddsBar from '../components/OddsBar';
import TimeAgo from '../components/TimeAgo';
import { SkeletonCard } from '../components/Skeleton';

const SPORTS = [
  { id: 'NBA',    apiId: 'nba',    label: 'NBA',    color: '#f97316' },
  { id: 'NFL',    apiId: 'nfl',    label: 'NFL',    color: '#22c55e' },
  { id: 'MLB',    apiId: 'mlb',    label: 'MLB',    color: '#ef4444' },
  { id: 'Soccer', apiId: 'soccer', label: 'Soccer', color: '#22c55e' },
  { id: 'F1',     apiId: 'f1',     label: 'F1',     color: '#dc2626' },
];

const SPORT_DESCRIPTIONS = {
  NBA:    'NBA Free Agency opens July 1st — peak roster activity',
  NFL:    'Training camps approaching, early roster moves active',
  MLB:    'Midseason run — trade deadline pressure building',
  Soccer: 'FIFA World Cup 2026 in progress — Group Stage',
  F1:     'Austrian Grand Prix weekend active',
};

function heatColor(score) {
  if (score >= 86) return '#f05454';
  if (score >= 66) return '#f97316';
  if (score >= 41) return '#eab308';
  return '#506070';
}

function heatLabel(score) {
  if (score >= 86) return { text: 'RED HOT',  cls: 'text-[#f05454]' };
  if (score >= 66) return { text: 'ACTIVE',   cls: 'text-orange-400' };
  if (score >= 41) return { text: 'WARMING',  cls: 'text-yellow-400' };
  return              { text: 'COOL',     cls: 'text-muted' };
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
      <div className="flex gap-1.5 mb-6">
        {SPORTS.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSport(s)}
            className={`px-4 py-1.5 rounded text-sm font-mono font-semibold border transition-colors ${
              activeSport.id === s.id
                ? 'bg-accent border-accent text-white'
                : 'bg-transparent border-[var(--border)] text-muted hover:text-label hover:border-[var(--border-hover)]'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Heat visualization */}
      <div className="mb-6">
        {heatLoading && currentScore === null ? (
          <div className="skeleton h-32 rounded-lg" />
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
      <div className="mb-6">
        <SectionHeader
          label="PREDICTION MARKETS"
          sub={`Kalshi · ${activeSport.label}`}
          badge={cards.length > 0 ? `${cards.length}` : null}
        />
        {trackerLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={5} />)}
          </div>
        ) : cards.length === 0 ? (
          <RumorCards news={news} sport={activeSport} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {cards.map((c, i) => (
              <TrackerCard
                key={c.market_id}
                card={c}
                index={i}
              />
            ))}
          </div>
        )}
      </div>

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

// ── Heat Panel — minimal score display, no speedometer ────────────────────────

function HeatPanel({ sport, score, description, liveFromWs }) {
  const color = heatColor(score);
  const { text: labelText, cls: labelCls } = heatLabel(score);

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-5">
      <div className="flex items-start gap-8">

        {/* Score block */}
        <div className="shrink-0 flex flex-col items-center justify-center w-32 pt-1">
          <div
            className="text-6xl font-mono font-bold tabular-nums leading-none"
            style={{ color }}
          >
            {score}
          </div>
          <div className={`text-[10px] font-mono font-bold tracking-[0.15em] mt-2 ${labelCls}`}>
            {labelText}
          </div>
          {/* Arc indicator — clean half-ring, no needle */}
          <ArcRing score={score} color={color} />
        </div>

        {/* Right column */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <SportBadge sport={sport.id} />
            <span className="text-xs font-semibold text-[var(--text-primary)]">Heat Score</span>
            {liveFromWs && (
              <span className="text-[9px] font-mono text-accent border border-accent/40 rounded px-1.5 py-0.5 live-indicator">
                LIVE
              </span>
            )}
          </div>
          <p className="text-[13px] text-[var(--text-secondary)] mb-4 leading-relaxed">
            {description}
          </p>
          <HeatBreakdown score={score} />
        </div>
      </div>
    </div>
  );
}

function ArcRing({ score, color }) {
  // Simple thin progress arc — much cleaner than a speedometer
  const r = 28;
  const cx = 34;
  const cy = 34;
  const circumference = Math.PI * r; // half-circle
  const pct = score / 100;

  return (
    <svg width={68} height={40} viewBox="0 0 68 40" className="mt-3">
      {/* Track */}
      <path
        d={`M 6 34 A ${r} ${r} 0 0 1 62 34`}
        fill="none"
        stroke="var(--border)"
        strokeWidth={4}
        strokeLinecap="round"
      />
      {/* Fill — clamp so stroke-dashoffset correctly handles 0 and 100 */}
      <path
        d={`M 6 34 A ${r} ${r} 0 0 1 62 34`}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - pct)}
        style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.22,1,0.36,1)' }}
      />
    </svg>
  );
}

function HeatBreakdown({ score }) {
  const bars = [
    { label: 'Media Coverage',   val: Math.min(100, Math.max(0, score + 5)) },
    { label: 'Market Activity',  val: Math.min(100, Math.max(0, score - 5)) },
    { label: 'Trade / Transfer', val: Math.min(100, Math.max(0, score + 10)) },
    { label: 'Fan Engagement',   val: Math.min(100, Math.max(0, score - 10)) },
  ];
  return (
    <div className="space-y-2.5">
      {bars.map(b => (
        <div key={b.label}>
          <div className="flex justify-between mb-1">
            <span className="text-[10px] font-mono text-muted tracking-wide">{b.label}</span>
            <span className="text-[10px] font-mono font-semibold text-[var(--text-secondary)] tabular-nums">{b.val}</span>
          </div>
          <div className="h-[3px] bg-[var(--border)] rounded-full overflow-hidden">
            <div
              className="h-full w-full rounded-full origin-left"
              style={{
                backgroundColor: heatColor(b.val),
                transform: `scaleX(${b.val / 100})`,
                transition: 'transform 700ms cubic-bezier(0.22,1,0.36,1)',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tracker Card ──────────────────────────────────────────────────────────────

function TrackerCard({ card, index }) {
  const yes = card.yes_price ?? 50;
  const no  = card.no_price ?? (100 - yes);
  const vol = card.volume ?? 0;
  const volPct = card.volume_pct ?? 0;

  return (
    <div
      className="card-stagger bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4 hover:border-[var(--border-hover)] transition-colors flex flex-col gap-3"
      style={{ '--card-i': Math.min(index, 10) }}
    >
      <p className="text-[13px] font-medium text-[var(--text-primary)] leading-snug line-clamp-2">
        {card.market_title}
      </p>

      <div className="flex items-baseline gap-3">
        <span className="font-mono font-bold text-2xl text-positive tabular-nums">{yes}¢</span>
        <span className="text-[10px] font-mono text-muted">YES</span>
        <span className="font-mono font-semibold text-base text-[#f05454] tabular-nums ml-auto">{no}¢</span>
        <span className="text-[10px] font-mono text-muted">NO</span>
      </div>

      <OddsBar yesPrice={yes} noPrice={no} compact />

      <div>
        <div className="flex justify-between text-[10px] font-mono text-muted mb-1">
          <span>VOLUME</span>
          <span className="text-[var(--text-secondary)]">
            {vol >= 1_000_000 ? `$${(vol / 1_000_000).toFixed(1)}M`
              : vol >= 1000 ? `$${(vol / 1000).toFixed(0)}K`
              : `$${vol}`}
          </span>
        </div>
        <div className="h-[3px] bg-[var(--border)] rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full"
            style={{ width: `${Math.max(2, volPct * 100)}%` }}
          />
        </div>
      </div>

      <CloseTime ts={card.close_time} />

      {card.related_news?.length > 0 && (
        <div className="border-t border-[var(--border)] pt-2 space-y-2">
          {card.related_news.map((a, i) => (
            <a
              key={i}
              href={a.url !== '#' ? a.url : undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 group"
            >
              <span className="text-accent mt-0.5 shrink-0">›</span>
              <div className="min-w-0">
                <p className="text-[11px] text-muted group-hover:text-label transition-colors line-clamp-2 leading-snug">
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

function RumorCards({ news, sport }) {
  if (!news.length) {
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
          className="block border border-dashed border-[var(--border)] rounded-lg p-3 hover:border-muted/60 transition-colors group opacity-75 hover:opacity-100"
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[9px] font-mono text-muted border border-muted/40 rounded px-1 py-0.5">RUMOR</span>
            <TimeAgo date={a.publishedAt} />
          </div>
          <p className="text-xs text-[var(--text-primary)] leading-snug group-hover:text-white transition-colors line-clamp-3">
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
    <span className={`text-[10px] font-mono ${diff < 86400000 * 2 ? 'text-[#f05454]' : 'text-muted'}`}>
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
      className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-3 hover:border-[var(--border-hover)] transition-colors block group"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-mono text-muted">{article.source}</span>
        <TimeAgo date={article.publishedAt} />
      </div>
      <p className="text-xs text-[var(--text-primary)] leading-snug group-hover:text-white transition-colors line-clamp-3">
        {article.title}
      </p>
    </a>
  );
}

function SectionHeader({ label, sub, badge }) {
  return (
    <div className="mb-3 pb-2 border-b border-[var(--border)] flex items-end justify-between">
      <div>
        <div className="text-[10px] font-mono font-bold text-accent tracking-widest">{label}</div>
        {sub && <div className="text-[10px] text-muted font-mono mt-0.5">{sub}</div>}
      </div>
      {badge && (
        <span className="text-[10px] font-mono text-muted bg-[var(--border)] rounded px-1.5 py-0.5 mb-0.5 tabular-nums">
          {badge}
        </span>
      )}
    </div>
  );
}
