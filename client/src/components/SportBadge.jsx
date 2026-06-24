import React from 'react';

const COLORS = {
  NBA: 'text-orange-400 border-orange-400/40 bg-orange-400/10',
  NFL: 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10',
  MLB: 'text-red-400 border-red-400/40 bg-red-400/10',
  Soccer: 'text-green-400 border-green-400/40 bg-green-400/10',
  F1: 'text-red-500 border-red-500/40 bg-red-500/10',
  Tennis: 'text-yellow-400 border-yellow-400/40 bg-yellow-400/10',
  General: 'text-gray-400 border-gray-400/40 bg-gray-400/10',
  Draft: 'text-purple-400 border-purple-400/40 bg-purple-400/10',
  Championship: 'text-accent border-accent/40 bg-accent/10',
  Trade: 'text-cyan-400 border-cyan-400/40 bg-cyan-400/10',
  Other: 'text-gray-500 border-gray-500/40 bg-gray-500/10',
};

export default function SportBadge({ sport, size = 'sm' }) {
  const cls = COLORS[sport] || COLORS.Other;
  return (
    <span className={`inline-flex items-center font-mono border rounded px-1.5 py-0.5 ${size === 'xs' ? 'text-[9px]' : 'text-[10px]'} font-semibold tracking-wider uppercase ${cls}`}>
      {sport}
    </span>
  );
}
