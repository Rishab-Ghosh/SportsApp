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

export default function PriceChart({ marketId, height = 80, showAxes = false }) {
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
          // Backend returns { points: [{t, price}] }
          setPoints(d.points || d.history?.map(h => ({ t: (h.ts || 0) * 1000, price: h.yes_price })) || []);
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) { setPoints([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [marketId]);

  // Direction: up = green, down = red (chart gradient color)
  const isUp = useMemo(() => {
    if (!points || points.length < 2) return true;
    return points[points.length - 1].price >= points[0].price;
  }, [points]);

  const strokeColor = isUp ? 'var(--positive)' : 'var(--negative)';
  const gradId = `grad-${marketId}`;

  if (loading) {
    return <div className="skeleton rounded" style={{ height }} />;
  }

  if (!points || points.length < 2) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
          NO PRICE HISTORY YET
        </span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={points} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
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
  );
}
