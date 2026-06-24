import React from 'react';

export default function TimeAgo({ date }) {
  if (!date) return null;
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  let label;
  if (mins < 1) label = 'just now';
  else if (mins < 60) label = `${mins}m ago`;
  else if (hours < 24) label = `${hours}h ago`;
  else label = `${days}d ago`;

  return <span className="text-muted font-mono text-[10px]">{label}</span>;
}
