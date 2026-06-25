
import React, { useState, useEffect, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';

const BASE = import.meta.env.VITE_API_BASE_URL || '';

function fmtLabel(t) {
  if (!t) return '';
  const d = new Date(t);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtTooltipDate(t) {
  if (!t) return '';
  return new Date(t).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 4, padding: '6px 10px',
      fontFamily: 'var(--font-mono)', fontSize: 11,
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{fmtTooltipDate(label)}</div>
      <div style={{ color: 'var(--accent)', fontWeight: 700 }}>
        {payload[0]?.value}¢
      </div>
    </div>
  );
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < String(str || '').length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rand(seed) {
  let x = seed || 123456;
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return ((x >>> 0) % 1000) / 1000;
  };
}

function clamp(n) {
  return Math.max(0, Math.min(100, n));
}

function fallbackPoints(marketId, fallbackPrice = 50) {
  const current = clamp(Number(fallbackPrice) || 50);
  const seedRand = rand(hashSeed(marketId));
  const now = Date.now();
  const count = 24;
  const start = now - 7 * 86400000;
  const initial = clamp(current + (seedRand() - 0.5) * 14);
  const points = [];
  let last = initial;
  for (let i = 0; i < count; i++) {
    const p = i / (count - 1);
    const target = initial + (current - initial) * p;
    const wiggle = (seedRand() - 0.5) * 4;
    last = i === count - 1 ? current : clamp((last * 0.35) + (target * 0.65) + wiggle);
    points.push({ t: start + p * (now - start), price: Math.round(last) });
  }
  return points;
}

export default function PriceChart({ marketId, height = 80, showAxes = false, fallbackPrice = 50 }) {
  const [points, setPoints] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!marketId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`${BASE}/api/kalshi/market/${encodeURIComponent(marketId)}/history`)
      .then(r => r.json())
      .then(d => {
        if (!cancelled) {
          setPoints(d.points || d.history?.map(h => ({ t: (h.ts || 0) * 1000, price: h.yes_price })) || []);
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) { setPoints([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [marketId]);

  const hasRealHistory = points && points.length >= 2;
  const chartPoints = useMemo(
    () => hasRealHistory ? points : fallbackPoints(marketId, fallbackPrice),
    [hasRealHistory, points, marketId, fallbackPrice]
  );

  const isUp = useMemo(() => {
    if (!chartPoints || chartPoints.length < 2) return true;
    return chartPoints[chartPoints.length - 1].price >= chartPoints[0].price;
  }, [chartPoints]);

  const strokeColor = isUp ? 'var(--positive)' : 'var(--negative)';
  const gradId = `grad-${String(marketId || 'market').replace(/[^a-zA-Z0-9_-]/g, '')}`;

  if (loading) return <div className="skeleton rounded" style={{ height }} />;

  return (
    <div style={{ height, position: 'relative' }}>
      {!hasRealHistory && (
        <span style={{ position: 'absolute', top: 2, right: 2, zIndex: 1, fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text-muted)', opacity: 0.7 }}>
          EST
        </span>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartPoints} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {showAxes && (
            <>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="t"
                tickFormatter={fmtLabel}
                tick={{ fontSize: 9, fontFamily: 'var(--font-mono)', fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 9, fontFamily: 'var(--font-mono)', fill: 'var(--text-muted)' }}
                tickFormatter={v => `${v}¢`}
                axisLine={false}
                tickLine={false}
                width={30}
              />
            </>
          )}

          {!showAxes && <YAxis hide domain={[dataMin => Math.max(0, Math.floor(dataMin - 5)), dataMax => Math.min(100, Math.ceil(dataMax + 5))]} />}
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="price"
            stroke={strokeColor}
            strokeWidth={1.5}
            fill={`url(#${gradId})`}
            dot={false}
            activeDot={{ r: 3, fill: strokeColor, stroke: 'var(--bg-card)', strokeWidth: 2 }}
            animationDuration={700}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
