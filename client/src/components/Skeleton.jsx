import React from 'react';

export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="bg-card border border-border rounded p-3 space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`skeleton h-3 rounded ${i === 0 ? 'w-3/4' : i === lines - 1 ? 'w-1/2' : 'w-full'}`} />
      ))}
    </div>
  );
}

export function SkeletonGrid({ count = 3, cols = 3 }) {
  return (
    <div className={`grid grid-cols-${cols} gap-3`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
