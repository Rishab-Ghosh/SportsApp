import React from 'react';

export default function OddsBar({ yesPrice, noPrice, compact = false }) {
  const yes = yesPrice ?? 50;
  const no = noPrice ?? (100 - yes);

  return (
    <div className={`space-y-1 ${compact ? '' : 'mt-2'}`}>
      <div className="flex h-2 rounded overflow-hidden gap-px">
        <div className="bg-positive transition-all" style={{ width: `${yes}%` }} />
        <div className="bg-negative transition-all" style={{ width: `${Math.max(0, 100 - yes)}%` }} />
      </div>
      <div className="flex justify-between text-[10px] font-mono">
        <span className="text-positive">YES {yes}¢</span>
        <span className="text-negative">NO {no}¢</span>
      </div>
    </div>
  );
}
