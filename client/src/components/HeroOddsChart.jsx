import React, { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

const RANGES = ['1D', '7D', '30D'];
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

function fmtAxisTick(t, range) {
  const d = new Date(t);
  if (range === '30D') {
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  if (range === '1D') {
    const h = d.getHours(), m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { t, price } = payload[0].payload;
  const d = new Date(t);
  return (
    <div style={{
      background: '#161616',
      border: '1px solid rgba(56,189,248,0.3)',
      borderRadius: 2,
      padding: '6px 10px',
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
    }}>
      <div style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: 2 }}>{price}¢ YES</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 9 }}>
        {d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}

export default function HeroOddsChart({ ticker, sportColor = '#38bdf8' }) {
  const [range, setRange]   = useState('7D');
  const [points, setPoints] = useState([]);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (r) => {
    if (!ticker) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/kalshi/market/${encodeURIComponent(ticker)}/history?range=${r.toLowerCase()}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        setPoints(data.points || []);
        setSource(data.source || '');
      }
    } catch {
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  useEffect(() => { load(range); }, [range, load]);

  const noData = !loading && points.length < 2;
  const latest = points[points.length - 1]?.price ?? null;
  const earliest = points[0]?.price ?? null;
  const delta = latest !== null && earliest !== null ? latest - earliest : null;

  // Compute Y-axis domain with padding
  let yMin = 0, yMax = 100;
  if (points.length >= 2) {
    const prices = points.map(p => p.price);
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    yMin = Math.max(0,   Math.floor(lo - 5));
    yMax = Math.min(100, Math.ceil(hi + 5));
    if (yMax - yMin < 10) { yMin = Math.max(0, yMin - 5); yMax = Math.min(100, yMax + 5); }
  }

  // Derive X-axis ticks (show ~5)
  const ticks = [];
  if (points.length >= 2) {
    const step = Math.max(1, Math.floor(points.length / 5));
    for (let i = 0; i < points.length; i += step) ticks.push(points[i].t);
    if (ticks[ticks.length - 1] !== points[points.length - 1].t) {
      ticks.push(points[points.length - 1].t);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '10px 14px 8px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
          PRICE HISTORY
        </span>
        {delta !== null && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
            color: delta > 0 ? 'var(--positive)' : delta < 0 ? 'var(--negative)' : 'var(--text-muted)',
          }}>
            {delta > 0 ? '+' : ''}{delta}¢
          </span>
        )}
        {source === 'trades' && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', opacity: 0.6 }}>
            TRADES
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
          {RANGES.map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              padding: '2px 8px', borderRadius: 1, cursor: 'pointer',
              background: range === r ? 'rgba(56,189,248,0.1)' : 'transparent',
              border: `1px solid ${range === r ? 'rgba(56,189,248,0.4)' : 'var(--border)'}`,
              color: range === r ? 'var(--accent)' : 'var(--text-muted)',
              fontFamily: 'var(--font-mono)', fontSize: 9,
              transition: 'all 0.1s',
            }}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {loading ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em', opacity: 0.5 }}>
              LOADING…
            </span>
          </div>
        ) : noData ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em', opacity: 0.5 }}>
              NO HISTORY FOR {range}
            </span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 4, right: 2, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={sportColor} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={sportColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="t"
                type="number"
                domain={['dataMin', 'dataMax']}
                ticks={ticks}
                tickFormatter={t => fmtAxisTick(t, range)}
                tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                axisLine={{ stroke: 'var(--border)' }}
                tickLine={false}
              />
              <YAxis
                domain={[yMin, yMax]}
                tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `${v}¢`}
              />
              <ReferenceLine y={50} stroke="rgba(255,255,255,0.07)" strokeDasharray="3 3" />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="price"
                stroke={sportColor}
                strokeWidth={1.5}
                fill="url(#heroGrad)"
                dot={false}
                activeDot={{ r: 3, stroke: sportColor, fill: '#161616' }}
                isAnimationActive={true}
                animationDuration={600}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
