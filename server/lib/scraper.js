const axios = require('axios');
const { parseStringPromise } = require('xml2js');
const crypto = require('crypto');

// Module-level cache — survives between requests, cleared only on server restart
let _cache = { clusters: [], articles: [], lastRun: null };

function hash(str) {
  return crypto.createHash('md5').update(str || '').digest('hex').slice(0, 12);
}

function detectSportTag(text) {
  const t = (text || '').toUpperCase();
  if (t.match(/\bNBA\b|BASKETBALL|LAKERS|CELTICS|WARRIORS|KNICKS|LEBRON|CURRY|WNBA/)) return 'NBA';
  if (t.match(/\bNFL\b|FOOTBALL|MAHOMES|CHIEFS|COWBOYS|EAGLES|QUARTERBACK|GRIDIRON/)) return 'NFL';
  if (t.match(/\bMLB\b|BASEBALL|YANKEES|DODGERS|METS|CUBS|WORLD SERIES|OHTANI/)) return 'MLB';
  if (t.match(/SOCCER|EPL|PREMIER LEAGUE|TRANSFER|MESSI|RONALDO|CHAMPIONS LEAGUE|FIFA|LA LIGA|\bFC\b|GOAL|FOOTBALL CLUB/)) return 'Soccer';
  if (t.match(/\bF1\b|FORMULA 1|FORMULA ONE|GRAND PRIX|VERSTAPPEN|HAMILTON|FERRARI|RED BULL RACING/)) return 'F1';
  if (t.match(/TENNIS|WIMBLEDON|US OPEN|FRENCH OPEN|DJOKOVIC|NADAL|FEDERER|SWIATEK/)) return 'Tennis';
  return 'General';
}

function toArticle(fields) {
  return {
    id: hash(fields.title + (fields.url || '')),
    title: (fields.title || '').trim(),
    url: fields.url || '#',
    source: fields.source || 'Unknown',
    publishedAt: fields.publishedAt || new Date().toISOString(),
    sport_tag: fields.sport_tag || detectSportTag(fields.title),
    upvotes: fields.upvotes || 0,
    type: fields.type || 'rss',
    description: fields.description || '',
  };
}

// ── Sources ───────────────────────────────────────────────────────────────────

const GOOGLE_QUERIES = [
  { q: 'NBA trade', sport: 'NBA' },
  { q: 'NFL', sport: 'NFL' },
  { q: 'MLB baseball', sport: 'MLB' },
  { q: 'soccer transfer', sport: 'Soccer' },
  { q: 'F1 Formula 1', sport: 'F1' },
  { q: 'tennis', sport: 'Tennis' },
];

const SUBREDDITS = [
  { sub: 'nba', sport: 'NBA' },
  { sub: 'soccer', sport: 'Soccer' },
  { sub: 'formula1', sport: 'F1' },
  { sub: 'baseball', sport: 'MLB' },
  { sub: 'nfl', sport: 'NFL' },
  { sub: 'tennis', sport: 'Tennis' },
];

const ESPN_FEEDS = [
  { url: 'https://www.espn.com/espn/rss/news', sport: 'General' },
  { url: 'https://www.espn.com/espn/rss/nba/news', sport: 'NBA' },
  { url: 'https://www.espn.com/espn/rss/nfl/news', sport: 'NFL' },
  { url: 'https://www.espn.com/espn/rss/mlb/news', sport: 'MLB' },
  { url: 'https://www.espn.com/espn/rss/soccer/news', sport: 'Soccer' },
];

const BBC_FEEDS = [
  { url: 'https://feeds.bbci.co.uk/sport/rss.xml', sport: 'General' },
  { url: 'https://feeds.bbci.co.uk/sport/football/rss.xml', sport: 'Soccer' },
  { url: 'https://feeds.bbci.co.uk/sport/formula1/rss.xml', sport: 'F1' },
  { url: 'https://feeds.bbci.co.uk/sport/tennis/rss.xml', sport: 'Tennis' },
];

const SKY_FEEDS = [
  { url: 'https://www.skysports.com/rss/12040', sport: 'Soccer' },
  { url: 'https://www.skysports.com/rss/12202', sport: 'F1' },
];

// ── Scrapers ──────────────────────────────────────────────────────────────────

async function scrapeRSS(url, sport) {
  const res = await axios.get(url, { timeout: 8000, headers: { 'User-Agent': 'SportsPulse/1.0' } });
  const parsed = await parseStringPromise(res.data, { explicitArray: false });
  const items = parsed?.rss?.channel?.item || [];
  const arr = Array.isArray(items) ? items : [items];
  return arr.slice(0, 8).map(item => toArticle({
    title: item.title,
    url: item.link,
    source: item.source?._ || item.source || new URL(url).hostname.replace('www.', '').replace('feeds.', ''),
    publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    sport_tag: sport === 'General' ? detectSportTag(item.title) : sport,
    type: 'rss',
    description: item.description || '',
  })).filter(a => a.title);
}

// Follow Google News redirect to get the real publisher URL.
// Returns null if it can't be resolved (caller drops the article or falls back).
async function unwrapGoogleUrl(googleUrl) {
  try {
    // Use native fetch (Node 18+) — axios exposes responseUrl unreliably on some versions
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 4000);
    try {
      const r = await fetch(googleUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SportsPulse/1.0)' },
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      if (r.url && !r.url.includes('news.google.com')) return r.url;
    } finally {
      clearTimeout(timeout);
    }
  } catch {}
  return null;
}

async function scrapeGoogleNews() {
  const results = await Promise.allSettled(
    GOOGLE_QUERIES.map(({ q, sport }) =>
      axios.get(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`, {
        timeout: 8000, headers: { 'User-Agent': 'SportsPulse/1.0' },
      }).then(async res => {
        const parsed = await parseStringPromise(res.data, { explicitArray: false });
        const items = parsed?.rss?.channel?.item || [];
        const arr = Array.isArray(items) ? items : [items];
        const raw = arr.slice(0, 8)
          .map(item => ({
            title: (item.title || '').trim(),
            googleUrl: item.link,
            source: item.source?._ || 'Google News',
            publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
            sport_tag: sport,
            description: (item.description || '').replace(/<[^>]+>/g, '').trim(),
          }))
          .filter(a => a.title && a.googleUrl);

        // Unwrap redirect URLs in parallel (best-effort; failures get dropped)
        const unwrapped = await Promise.all(
          raw.map(async a => {
            const realUrl = await unwrapGoogleUrl(a.googleUrl);
            if (!realUrl) return null; // drop unresolvable Google links
            return toArticle({ ...a, url: realUrl, type: 'rss' });
          })
        );
        return unwrapped.filter(Boolean);
      })
    )
  );
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}

async function scrapeReddit() {
  const results = await Promise.allSettled(
    SUBREDDITS.map(({ sub, sport }) =>
      axios.get(`https://www.reddit.com/r/${sub}/hot.json?limit=10&t=day`, {
        timeout: 8000,
        headers: { 'User-Agent': 'SportsPulse/1.0' },
      }).then(res => {
        const posts = res.data?.data?.children || [];
        return posts
          .filter(p => !p.data?.stickied)
          .slice(0, 8)
          .map(p => toArticle({
            title: p.data.title,
            url: `https://www.reddit.com${p.data.permalink}`,
            source: `Reddit r/${sub}`,
            publishedAt: new Date(p.data.created_utc * 1000).toISOString(),
            sport_tag: sport,
            upvotes: p.data.score || 0,
            type: 'reddit',
            description: p.data.selftext?.slice(0, 200) || '',
          }));
      })
    )
  );
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}

async function scrapeESPN() {
  const results = await Promise.allSettled(ESPN_FEEDS.map(f => scrapeRSS(f.url, f.sport)));
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}

async function scrapeBBC() {
  const results = await Promise.allSettled(BBC_FEEDS.map(f => scrapeRSS(f.url, f.sport)));
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}

async function scrapeSky() {
  const results = await Promise.allSettled(SKY_FEEDS.map(f => scrapeRSS(f.url, f.sport)));
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}

// ── Clustering (inline, no dependency on cluster.js) ─────────────────────────

const STOPWORDS = new Set([
  'the','a','an','in','on','at','to','for','of','and','or','is','was','are',
  'were','has','have','been','with','from','by','that','this','its','his','her',
  'their','our','they','them','he','she','it','be','do','did','not','but','as',
  'after','before','about','into','over','than','more','what','when','who','says',
]);

function tokens(str) {
  return [...new Set(
    (str || '').toLowerCase().replace(/['']/g, '').split(/\W+/)
      .filter(w => w.length > 4 && !STOPWORDS.has(w))
  )];
}

function clusterAndScore(articles) {
  const used = new Array(articles.length).fill(false);
  const clusters = [];

  for (let i = 0; i < articles.length; i++) {
    if (used[i]) continue;
    const group = [articles[i]];
    used[i] = true;
    const ti = new Set(tokens(articles[i].title));

    for (let j = i + 1; j < articles.length; j++) {
      if (used[j]) continue;
      // Same sport required to avoid cross-sport false clusters
      if (articles[i].sport_tag !== articles[j].sport_tag) continue;
      const tj = tokens(articles[j].title);
      let overlap = 0;
      for (const t of tj) { if (ti.has(t)) { overlap++; if (overlap >= 2) break; } }
      if (overlap >= 2) { group.push(articles[j]); used[j] = true; }
    }
    clusters.push(group);
  }

  return clusters.map(group => {
    const sorted = [...group].sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
    const lead = sorted[0];
    const sourceSet = new Set(group.map(a => a.source));
    const redditUp = group.filter(a => a.type === 'reddit').reduce((s, a) => s + (a.upvotes || 0), 0);
    const newest = group.reduce((m, a) => {
      const t = new Date(a.publishedAt).getTime();
      return t > m ? t : m;
    }, 0);
    const ageHr = (Date.now() - newest) / 3.6e6;

    let rel = 0;
    rel += ageHr < 1 ? 40 : ageHr < 6 ? 30 : ageHr < 24 ? 20 : 5;
    const sc = sourceSet.size;
    rel += sc >= 4 ? 25 : sc === 3 ? 18 : sc === 2 ? 10 : 5;
    rel += redditUp > 1000 ? 20 : redditUp > 500 ? 15 : redditUp > 100 ? 10 : redditUp > 0 ? 5 : 0;

    // When a cluster has real publisher sources, hide Google ones from the display list
    // (Google redirect URLs confuse users and break link sharing)
    const allSourceItems = group.map(a => ({ name: a.source, url: a.url }));
    const realSources = allSourceItems.filter(s => !s.url.includes('news.google.com') && !s.url.includes('google.com/rss'));
    const sourcesForDisplay = realSources.length > 0 ? realSources : allSourceItems;
    const deduped = [...new Map(sourcesForDisplay.map(s => [s.name, s])).values()];

    return {
      id: hash(lead.title),
      headline: lead.title,
      summary: lead.description || group.slice(0, 2).map(a => a.title).join(' · '),
      sport_tag: lead.sport_tag,
      sources: deduped,
      source_count: sc,
      reddit_upvotes: redditUp,
      relevance_score: Math.min(100, Math.round(rel)),
      publishedAt: newest ? new Date(newest).toISOString() : lead.publishedAt,
      market_match: null, // enriched later by news.js if Kalshi markets are available
    };
  }).sort((a, b) => b.relevance_score - a.relevance_score);
}

// ── Public API ────────────────────────────────────────────────────────────────

async function runScraper() {
  console.log('[scraper] Starting scrape...');
  const t0 = Date.now();

  const [google, reddit, espn, bbc, sky] = await Promise.allSettled([
    scrapeGoogleNews(),
    scrapeReddit(),
    scrapeESPN(),
    scrapeBBC(),
    scrapeSky(),
  ]);

  const log = (name, r) => {
    if (r.status === 'fulfilled') console.log(`[scraper] ${name}: ${r.value.length} articles`);
    else console.warn(`[scraper] ${name} failed:`, r.reason?.message);
  };
  log('Google News', google);
  log('Reddit', reddit);
  log('ESPN', espn);
  log('BBC Sport', bbc);
  log('Sky Sports', sky);

  const all = [
    ...(google.status === 'fulfilled' ? google.value : []),
    ...(reddit.status === 'fulfilled' ? reddit.value : []),
    ...(espn.status === 'fulfilled' ? espn.value : []),
    ...(bbc.status === 'fulfilled' ? bbc.value : []),
    ...(sky.status === 'fulfilled' ? sky.value : []),
  ];

  // Deduplicate
  const seen = new Set();
  const unique = all.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });

  const clusters = clusterAndScore(unique);
  console.log(`[scraper] Done — ${unique.length} articles → ${clusters.length} clusters (${Date.now() - t0}ms)`);

  _cache = { clusters, articles: unique, lastRun: Date.now() };
  return _cache;
}

function getNews(sport) {
  const { clusters } = _cache;
  if (!sport || sport === 'All') return clusters.slice(0, 40);
  return clusters.filter(c => c.sport_tag === sport).slice(0, 30);
}

// Legacy export — kept so existing code that calls scrapeAll() still works
async function scrapeAll() {
  if (_cache.articles.length > 0 && _cache.lastRun && (Date.now() - _cache.lastRun) < 600000) {
    return _cache.articles;
  }
  await runScraper();
  return _cache.articles;
}

module.exports = { runScraper, getNews, scrapeAll };
