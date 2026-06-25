import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const BASE = import.meta.env.VITE_API_BASE_URL || '';

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(typeof ts === 'number' ? ts * 1000 : ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 4,
      padding: '6px 10px',
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
    }}>
      <div style={{ color: 'var(--text-muted)' }}>{fmtTime(label)}</div>
      <div style={{ color: 'var(--accent)', fontWeight: 600 }}>{val}¢</div>
    </div>
  );
}

export default function PriceChart({ marketId, height = 80, showAxes = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!marketId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`${BASE}/api/kalshi/market/${encodeURIComponent(marketId)}/history`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setData(d.history || []); setLoading(false); } })
      .catch(() => { if (!cancelled) { setData([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [marketId]);

  if (loading) {
    return <div className="skeleton rounded" style={{ height }} />;
  }

  if (!data || data.length < 2) {
    // Show a placeholder flat line
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
          NO HISTORY
        </span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`grad-${marketId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {showAxes && (
          <>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
            <XAxis
              dataKey="ts"
              tickFormatter={fmtTime}
              tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--text-muted)' }}
              tickFormatter={v => `${v}¢`}
              axisLine={false}
              tickLine={false}
              width={32}
            />
          </>
        )}
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="yes_price"
          stroke="var(--accent)"
          strokeWidth={1.5}
          fill={`url(#grad-${marketId})`}
          dot={false}
          activeDot={{ r: 3, fill: 'var(--accent)', stroke: 'var(--bg-card)', strokeWidth: 2 }}
          animationDuration={600}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
