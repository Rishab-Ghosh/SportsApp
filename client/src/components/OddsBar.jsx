import React from 'react';

// Single probability bar: YES fills in accent, remainder is muted border color.
// More readable than the old green/red split bar which looks like a loading indicator.
export default function OddsBar({ yesPrice, noPrice, compact = false }) {
  const yes = yesPrice ?? 50;
  const no  = noPrice ?? (100 - yes);

  return (
    <div className={compact ? '' : 'mt-2'}>
      <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full origin-left"
          style={{
            transform: `scaleX(${yes / 100})`,
            transition: 'transform 0.4s ease-out',
          }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[10px] font-mono tabular-nums">
        <span className="text-positive">YES {yes}¢</span>
        <span className="text-[var(--negative)]">NO {no}¢</span>
      </div>
    </div>
  );
}
