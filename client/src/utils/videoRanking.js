
const PRIORITY_KEYWORDS = [
  'breaking', 'trade', 'traded', 'transfer', 'injury', 'injured', 'signs', 'signed',
  'contract', 'extension', 'draft', 'free agency', 'final', 'win', 'loss', 'highlights',
  'recap', 'announcement', 'suspension', 'retire', 'fired', 'hired', 'deal', 'rumor',
];

const CHANNEL_BONUS = [
  'espn', 'sportscenter', 'nba', 'nfl', 'mlb', 'formula 1', 'sky sports f1',
  'tennis tv', 'espn fc', 'bleacher report', 'house of highlights',
];

function hoursSince(iso) {
  if (!iso) return 999;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 999;
  return Math.max(0, (Date.now() - t) / 36e5);
}

function bucketWeight(bucket) {
  if (bucket === 'news') return 24;
  if (bucket === 'highlights') return 18;
  if (bucket === 'debate') return 10;
  return 8;
}

function recencyWeight(hours) {
  if (hours <= 3) return 32;
  if (hours <= 12) return 24;
  if (hours <= 36) return 16;
  if (hours <= 96) return 8;
  return 2;
}

function keywordWeight(title) {
  const lower = (title || '').toLowerCase();
  return PRIORITY_KEYWORDS.reduce((sum, kw) => sum + (lower.includes(kw) ? 5 : 0), 0);
}

function channelWeight(channel) {
  const lower = (channel || '').toLowerCase();
  return CHANNEL_BONUS.some(c => lower.includes(c)) ? 8 : 0;
}

function flattenVideos(payload) {
  if (!payload) return [];
  const out = [];
  for (const video of payload.debate || []) out.push({ ...video, bucket: video.bucket || 'debate' });
  for (const video of payload.news || []) out.push({ ...video, bucket: video.bucket || 'news' });
  for (const [sport, list] of Object.entries(payload.highlights || {})) {
    for (const video of list || []) out.push({ ...video, sport: video.sport || sport, bucket: video.bucket || 'highlights' });
  }
  return [...new Map(out.filter(v => v?.videoId).map(v => [v.videoId, v])).values()];
}

export function scoreVideo(video, activeSport = 'All') {
  const sport = video.sport || 'General';
  const hours = hoursSince(video.publishedAt);
  let score = bucketWeight(video.bucket) + recencyWeight(hours) + keywordWeight(video.title) + channelWeight(video.channel);

  if (activeSport && activeSport !== 'All') {
    if (sport === activeSport) score += 44;
    else if (sport === 'General') score += 8;
    else score -= 28;
  } else if (sport !== 'General') {
    score += 8;
  }

  if ((video.title || '').length > 115) score -= 4;
  return Math.max(0, Math.round(score));
}

export function rankVideos(payload, activeSport = 'All', limit = 8) {
  return flattenVideos(payload)
    .map(video => ({ ...video, relevanceScore: scoreVideo(video, activeSport) }))
    .filter(video => activeSport === 'All' || video.sport === activeSport || video.sport === 'General' || video.relevanceScore >= 55)
    .sort((a, b) => b.relevanceScore - a.relevanceScore || new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, limit);
}
