import React, { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend,
} from 'recharts';

const RANGES = ['1D', '7D', '30D'];
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// Color palette for multi-outcome lines (up to ~10 outcomes)
const LINE_COLORS = [
  '#38bdf8', '#22c55e', '#f97316', '#e74c3c',
  '#a78bfa', '#f5c518', '#06b6d4', '#ec4899', '#84cc16', '#f59e0b',
];

function fmtAxisTick(t, range) {
  const d = new Date(t);
  if (range === '30D') return `${d.getMonth() + 1}/${d.getDate()}`;
  if (range === '1D') {
    const h = d.getHours(), m = d.getMinutes();
    return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h >= 12 ? 'p' : 'a'}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ── Single-outcome area chart ─────────────────────────────────────────────────
function SingleAreaTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { t, price } = payload[0].payload;
  const d = new Date(t);
  return (
    <div style={{ background: '#161616', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 2, padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
      <div style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: 2 }}>{price}¢ YES</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 9 }}>
        {d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}

function SingleAreaChart({ points, sportColor, range }) {
  const prices = points.map(p => p.price);
  const lo = Math.min(...prices), hi = Math.max(...prices);
  let yMin = Math.max(0, Math.floor(lo - 5));
  let yMax = Math.min(100, Math.ceil(hi + 5));
  if (yMax - yMin < 10) { yMin = Math.max(0, yMin - 5); yMax = Math.min(100, yMax + 5); }

  const step = Math.max(1, Math.floor(points.length / 5));
  const ticks = [];
  for (let i = 0; i < points.length; i += step) ticks.push(points[i].t);
  if (ticks[ticks.length - 1] !== points[points.length - 1].t) ticks.push(points[points.length - 1].t);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={points} margin={{ top: 4, right: 2, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={sportColor} stopOpacity={0.25} />
            <stop offset="95%" stopColor={sportColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} ticks={ticks}
          tickFormatter={t => fmtAxisTick(t, range)}
          tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
        <YAxis domain={[yMin, yMax]}
          tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          axisLine={false} tickLine={false} tickFormatter={v => `${v}¢`} />
        <ReferenceLine y={50} stroke="rgba(255,255,255,0.07)" strokeDasharray="3 3" />
        <Tooltip content={<SingleAreaTooltip />} />
        <Area type="monotone" dataKey="price" stroke={sportColor} strokeWidth={1.5}
          fill="url(#heroGrad)" dot={false}
          activeDot={{ r: 3, stroke: sportColor, fill: '#161616' }}
          isAnimationActive animationDuration={600} animationEasing="ease-out" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Multi-outcome line chart ──────────────────────────────────────────────────
function MultiTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = new Date(label);
  const sorted = [...payload].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  return (
    <div style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, padding: '7px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, minWidth: 100 }}>
      {sorted.map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: i < sorted.length - 1 ? 3 : 0 }}>
          <span style={{ color: p.stroke || p.color }}>{p.name}</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{p.value}¢</span>
        </div>
      ))}
      <div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 8 }}>
        {d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}

function MultiOutcomeChart({ series, range }) {
  // Align all series to a common time axis (union of all timestamps)
  const timeSet = new Set();
  for (const s of series) for (const p of s.points) timeSet.add(p.t);
  const times = [...timeSet].sort((a, b) => a - b);

  // Build flat data: [{t, seriesA, seriesB, ...}]
  const pointsByTime = {};
  for (const t of times) pointsByTime[t] = { t };
  for (const s of series) {
    for (const p of s.points) {
      if (pointsByTime[p.t]) pointsByTime[p.t][s.ticker] = p.price;
    }
  }
  const chartData = times.map(t => pointsByTime[t]);

  const allPrices = series.flatMap(s => s.points.map(p => p.price));
  const yMin = Math.max(0, Math.floor(Math.min(...allPrices) - 3));
  const yMax = Math.min(100, Math.ceil(Math.max(...allPrices) + 3));

  const step = Math.max(1, Math.floor(times.length / 5));
  const ticks = [];
  for (let i = 0; i < times.length; i += step) ticks.push(times[i]);
  if (ticks[ticks.length - 1] !== times[times.length - 1]) ticks.push(times[times.length - 1]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Outcome legend */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '0 0 6px', marginBottom: 2 }}>
        {series.map((s, i) => {
          const latest = s.points[s.points.length - 1]?.price ?? '—';
          return (
            <div key={s.ticker} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 2, background: LINE_COLORS[i % LINE_COLORS.length], display: 'inline-block', borderRadius: 1 }} />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: LINE_COLORS[i % LINE_COLORS.length] }}>
                {s.name}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                {latest}¢
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ flex: 1 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 2, left: -16, bottom: 0 }}>
            <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} ticks={ticks}
              tickFormatter={t => fmtAxisTick(t, range)}
              tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
              axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
            <YAxis domain={[yMin, yMax]}
              tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
              axisLine={false} tickLine={false} tickFormatter={v => `${v}¢`} />
            <ReferenceLine y={50} stroke="rgba(255,255,255,0.07)" strokeDasharray="3 3" />
            <Tooltip content={<MultiTooltip />} />
            {series.map((s, i) => (
              <Line key={s.ticker} type="monotone" dataKey={s.ticker} name={s.name}
                stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={1.5}
                dot={false} activeDot={{ r: 3, fill: '#161616', stroke: LINE_COLORS[i % LINE_COLORS.length] }}
                isAnimationActive animationDuration={700} animationEasing="ease-out"
                connectNulls={true} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function HeroOddsChart({ ticker, eventTicker, sportColor = '#38bdf8' }) {
  const [range, setRange]       = useState('7D');
  const [eventSeries, setEventSeries] = useState(null); // null = loading, [] = no multi
  const [singlePoints, setSinglePoints] = useState([]);
  const [source, setSource]     = useState('');
  const [loading, setLoading]   = useState(false);

  const load = useCallback(async (r) => {
    if (!ticker) return;
    setLoading(true);
    try {
      // Try event-level candlesticks first (gives multi-outcome chart)
      if (eventTicker) {
        const evRes = await fetch(`${API_BASE}/api/kalshi/event/${encodeURIComponent(eventTicker)}/history?range=${r.toLowerCase()}`, {
          signal: AbortSignal.timeout(10000),
        });
        if (evRes.ok) {
          const evData = await evRes.json();
          if ((evData.series || []).length >= 3) {
            setEventSeries(evData.series);
            setLoading(false);
            return;
          }
          // 2-outcome: use first series points as single line
          if ((evData.series || []).length >= 2) {
            setSinglePoints(evData.series[0].points || []);
            setSource('candlesticks');
            setEventSeries([]);
            setLoading(false);
            return;
          }
        }
      }
      // Fallback to single-market history
      setEventSeries([]);
      const res = await fetch(`${API_BASE}/api/kalshi/market/${encodeURIComponent(ticker)}/history?range=${r.toLowerCase()}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        setSinglePoints(data.points || []);
        setSource(data.source || '');
      }
    } catch {
      setSinglePoints([]);
    } finally {
      setLoading(false);
    }
  }, [ticker, eventTicker]);

  useEffect(() => { load(range); }, [range, load]);

  const isMulti = eventSeries && eventSeries.length >= 3;
  const noData  = !loading && !isMulti && singlePoints.length < 2;
  const latest  = singlePoints[singlePoints.length - 1]?.price ?? null;
  const earliest = singlePoints[0]?.price ?? null;
  const delta   = latest !== null && earliest !== null ? latest - earliest : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '10px 14px 8px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
          {isMulti ? 'ALL OUTCOMES' : 'PRICE HISTORY'}
        </span>
        {!isMulti && delta !== null && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
            color: delta > 0 ? 'var(--positive)' : delta < 0 ? 'var(--negative)' : 'var(--text-muted)',
          }}>
            {delta > 0 ? '+' : ''}{delta}¢
          </span>
        )}
        {source === 'trades' && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', opacity: 0.6 }}>TRADES</span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
          {RANGES.map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              padding: '2px 8px', borderRadius: 1, cursor: 'pointer',
              background: range === r ? 'rgba(56,189,248,0.1)' : 'transparent',
              border: `1px solid ${range === r ? 'rgba(56,189,248,0.4)' : 'var(--border)'}`,
              color: range === r ? 'var(--accent)' : 'var(--text-muted)',
              fontFamily: 'var(--font-mono)', fontSize: 9, transition: 'all 0.1s',
            }}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {loading ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', opacity: 0.5 }}>LOADING…</span>
          </div>
        ) : noData ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', opacity: 0.5 }}>NO HISTORY FOR {range}</span>
          </div>
        ) : isMulti ? (
          <MultiOutcomeChart series={eventSeries} range={range} />
        ) : (
          <SingleAreaChart points={singlePoints} sportColor={sportColor} range={range} />
        )}
      </div>
    </div>
  );
}
