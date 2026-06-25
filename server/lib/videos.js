
const axios = require('axios');
const { parseStringPromise } = require('xml2js');
const crypto = require('crypto');

const CACHE_TTL = 15 * 60 * 1000;
let cache = { ts: 0, data: { debate: [], highlights: {}, news: [] } };
const channelIdCache = new Map();

const CHANNELS = [
  { name: 'ESPN', channelId: 'UCiWLfSweyRNmLpgEHekhoAg' },
  { name: 'First Take', handle: '@FirstTake' },
  { name: 'SportsCenter', handle: '@SportsCenter' },
  { name: 'ESPN FC', handle: '@ESPNFC' },
  { name: 'NBA on ESPN', handle: '@nbaonespn' },
  { name: 'Bleacher Report', channelId: 'UC9-OpMMVoNP5o10_Iyq7Ndw' },
  { name: 'House of Highlights', channelId: 'UCqQo7ewe87aYAe7ub5UqXMw' },
  { name: 'NBA', channelId: 'UCWJ2lWNubArHWmf3FIHbfcQ' },
  { name: 'NFL', channelId: 'UCDVYQ4Zhbm3S2dlz7P1GBDg' },
  { name: 'MLB', channelId: 'UCoLrcjPV5PbUrUyXq5mjc_A' },
  { name: 'Sky Sports F1', handle: '@SkySportsF1' },
  { name: 'Formula 1', channelId: 'UCB_qr75-ydFVKSF9Dmo6izg' },
  { name: 'Tennis TV', handle: '@tennistv' },
];

const SPORTS = ['NBA', 'NFL', 'MLB', 'Soccer', 'F1', 'Tennis'];
const YT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; SportsPulse/1.0)',
  'Accept': 'application/rss+xml,text/xml,application/xml,text/html,*/*',
};

function hash(s) {
  return crypto.createHash('md5').update(s || '').digest('hex').slice(0, 12);
}

function text(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._ || value.href || '';
}

function thumbnail(entry, videoId) {
  const media = entry['media:group'];
  const thumb = media?.['media:thumbnail'];
  if (Array.isArray(thumb)) return thumb[0]?.url || '';
  return thumb?.url || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '');
}

function inferVideoSport(video) {
  const t = `${video.title || ''} ${video.channel || ''}`.toLowerCase();
  if (/nba|basketball|lakers|celtics|warriors|knicks|wnba|lebron|curry|durant|jokic/.test(t)) return 'NBA';
  if (/nfl|football|chiefs|cowboys|eagles|quarterback|super bowl|mahomes|burrow/.test(t)) return 'NFL';
  if (/mlb|baseball|yankees|dodgers|mets|ohtani|world series|home run/.test(t)) return 'MLB';
  if (/soccer|football club|premier league|champions league|transfer|messi|ronaldo|arsenal|liverpool|chelsea|man city|espn fc/.test(t)) return 'Soccer';
  if (/f1|formula 1|formula one|grand prix|verstappen|hamilton|ferrari|red bull|sky sports f1/.test(t)) return 'F1';
  if (/tennis|wimbledon|djokovic|sinner|alcaraz|swiatek|nadal|us open|roland garros/.test(t)) return 'Tennis';
  return 'General';
}

function classifyVideo(video) {
  const t = `${video.title || ''} ${video.channel || ''}`.toLowerCase();
  if (/first take|undisputed|debate|reacts|reaction|hot take|stephen a|mad dog|pti|around the horn/.test(t)) return 'debate';
  if (/highlight|highlights|top plays|best plays|recap|goals|touchdowns|home runs|dunks|full match highlights/.test(t)) return 'highlights';
  if (/breaking|news|announcement|announces|trade|signs|injury|press conference|report:|sources:/.test(t)) return 'news';
  if (/house of highlights|sportscenter/.test(t)) return 'highlights';
  return 'news';
}

async function resolveChannelId(channel) {
  if (channel.channelId) return channel.channelId;
  if (!channel.handle) return null;
  if (channelIdCache.has(channel.handle)) return channelIdCache.get(channel.handle);

  try {
    const url = `https://www.youtube.com/${channel.handle}`;
    const res = await axios.get(url, { timeout: 8000, headers: YT_HEADERS });
    const html = res.data || '';
    const match = html.match(/"channelId":"(UC[^"]+)"/) || html.match(/<meta itemprop="channelId" content="(UC[^"]+)"/);
    const id = match?.[1] || null;
    channelIdCache.set(channel.handle, id);
    return id;
  } catch (err) {
    console.warn('[videos] handle resolve failed:', channel.handle, err.message);
    channelIdCache.set(channel.handle, null);
    return null;
  }
}

async function fetchChannel(channel) {
  try {
    const channelId = await resolveChannelId(channel);
    if (!channelId) return [];
    const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const res = await axios.get(url, { timeout: 8000, headers: YT_HEADERS });
    const parsed = await parseStringPromise(res.data, { explicitArray: false, mergeAttrs: true });
    let entries = parsed?.feed?.entry || [];
    if (!Array.isArray(entries)) entries = [entries];

    return entries.slice(0, 12).map(entry => {
      const videoId = text(entry['yt:videoId']);
      const video = {
        videoId,
        id: videoId || hash(text(entry.title) + channel.name),
        title: text(entry.title),
        channel: channel.name || text(entry.author?.name),
        url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : text(entry.link),
        thumbnail: thumbnail(entry, videoId),
        publishedAt: new Date(text(entry.published) || Date.now()).toISOString(),
      };
      video.bucket = classifyVideo(video);
      video.sport = inferVideoSport(video);
      return video;
    }).filter(v => v.videoId && v.title);
  } catch (err) {
    console.warn('[videos] RSS failed:', channel.name, err.message);
    return [];
  }
}

function bucketVideos(videos, sport) {
  const filtered = sport && sport !== 'All'
    ? videos.filter(v => v.sport === sport || v.sport === 'General')
    : videos;

  const highlights = {};
  for (const s of SPORTS) highlights[s] = [];

  for (const v of filtered) {
    if (v.bucket === 'debate') {
      // filled below to keep sorting consistent
    } else if (v.bucket === 'highlights') {
      const key = SPORTS.includes(v.sport) ? v.sport : 'NBA';
      highlights[key].push(v);
    }
  }

  const sortByDate = (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt);
  for (const key of Object.keys(highlights)) highlights[key] = highlights[key].sort(sortByDate).slice(0, 8);

  return {
    debate: filtered.filter(v => v.bucket === 'debate').sort(sortByDate).slice(0, 10),
    highlights,
    news: filtered.filter(v => v.bucket === 'news').sort(sortByDate).slice(0, 12),
  };
}

async function scrapeVideos(force = false) {
  if (!force && cache.ts && Date.now() - cache.ts < CACHE_TTL) return cache.data;
  const results = await Promise.allSettled(CHANNELS.map(fetchChannel));
  const all = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  const deduped = [...new Map(all.map(v => [v.videoId, v])).values()];
  const data = bucketVideos(deduped, 'All');
  cache = { ts: Date.now(), all: deduped, data };
  console.log(`[videos] ${deduped.length} videos scraped`);
  return data;
}

async function getVideos(sport = 'All') {
  await scrapeVideos(false);
  return bucketVideos(cache.all || [], sport);
}

module.exports = { scrapeVideos, getVideos };
