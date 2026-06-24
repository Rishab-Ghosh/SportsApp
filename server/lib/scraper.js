const axios = require('axios');
const { parseStringPromise } = require('xml2js');
const crypto = require('crypto');
const NodeCache = require('node-cache');

const scraperCache = new NodeCache({ stdTTL: 600 }); // 10 min

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

// ── Google News RSS ───────────────────────────────────────────────────────────

const GOOGLE_QUERIES = [
  { q: 'NBA trade', sport: 'NBA' },
  { q: 'NFL', sport: 'NFL' },
  { q: 'MLB baseball', sport: 'MLB' },
  { q: 'soccer transfer', sport: 'Soccer' },
  { q: 'F1 Formula 1', sport: 'F1' },
  { q: 'tennis', sport: 'Tennis' },
];

async function scrapeGoogleNews() {
  const results = await Promise.allSettled(
    GOOGLE_QUERIES.map(async ({ q, sport }) => {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
      const res = await axios.get(url, { timeout: 8000, headers: { 'User-Agent': 'SportsPulse/1.0' } });
      const parsed = await parseStringPromise(res.data, { explicitArray: false });
      const items = parsed?.rss?.channel?.item || [];
      const arr = Array.isArray(items) ? items : [items];
      return arr.slice(0, 8).map(item => toArticle({
        title: item.title,
        url: item.link,
        source: item.source?._ || item.source || 'Google News',
        publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        sport_tag: sport,
        type: 'rss',
        description: item.description || '',
      }));
    })
  );
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}

// ── Reddit JSON API ───────────────────────────────────────────────────────────

const SUBREDDITS = [
  { sub: 'nba', sport: 'NBA' },
  { sub: 'soccer', sport: 'Soccer' },
  { sub: 'formula1', sport: 'F1' },
  { sub: 'baseball', sport: 'MLB' },
  { sub: 'nfl', sport: 'NFL' },
  { sub: 'tennis', sport: 'Tennis' },
];

async function scrapeReddit() {
  const results = await Promise.allSettled(
    SUBREDDITS.map(async ({ sub, sport }) => {
      const url = `https://www.reddit.com/r/${sub}/hot.json?limit=10&t=day`;
      const res = await axios.get(url, {
        timeout: 8000,
        headers: { 'User-Agent': 'SportsPulse/1.0' },
      });
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
  );
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}

// ── ESPN RSS ──────────────────────────────────────────────────────────────────

const ESPN_FEEDS = [
  { url: 'https://www.espn.com/espn/rss/news', sport: 'General' },
  { url: 'https://www.espn.com/espn/rss/nba/news', sport: 'NBA' },
  { url: 'https://www.espn.com/espn/rss/nfl/news', sport: 'NFL' },
  { url: 'https://www.espn.com/espn/rss/mlb/news', sport: 'MLB' },
  { url: 'https://www.espn.com/espn/rss/soccer/news', sport: 'Soccer' },
];

async function scrapeESPN() {
  const results = await Promise.allSettled(
    ESPN_FEEDS.map(async ({ url, sport }) => {
      const res = await axios.get(url, {
        timeout: 8000,
        headers: { 'User-Agent': 'SportsPulse/1.0' },
      });
      const parsed = await parseStringPromise(res.data, { explicitArray: false });
      const items = parsed?.rss?.channel?.item || [];
      const arr = Array.isArray(items) ? items : [items];
      return arr.slice(0, 6).map(item => toArticle({
        title: item.title,
        url: item.link,
        source: 'ESPN',
        publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        sport_tag: sport === 'General' ? detectSportTag(item.title) : sport,
        type: 'rss',
        description: item.description || '',
      }));
    })
  );
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}

// ── BBC Sport RSS ─────────────────────────────────────────────────────────────

const BBC_FEEDS = [
  { url: 'https://feeds.bbci.co.uk/sport/rss.xml', sport: 'General' },
  { url: 'https://feeds.bbci.co.uk/sport/football/rss.xml', sport: 'Soccer' },
  { url: 'https://feeds.bbci.co.uk/sport/formula1/rss.xml', sport: 'F1' },
  { url: 'https://feeds.bbci.co.uk/sport/tennis/rss.xml', sport: 'Tennis' },
];

async function scrapeBBC() {
  const results = await Promise.allSettled(
    BBC_FEEDS.map(async ({ url, sport }) => {
      const res = await axios.get(url, {
        timeout: 8000,
        headers: { 'User-Agent': 'SportsPulse/1.0' },
      });
      const parsed = await parseStringPromise(res.data, { explicitArray: false });
      const items = parsed?.rss?.channel?.item || [];
      const arr = Array.isArray(items) ? items : [items];
      return arr.slice(0, 6).map(item => toArticle({
        title: item.title,
        url: item.link,
        source: 'BBC Sport',
        publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        sport_tag: sport === 'General' ? detectSportTag(item.title) : sport,
        type: 'rss',
        description: item.description || '',
      }));
    })
  );
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}

// ── Sky Sports RSS ────────────────────────────────────────────────────────────

const SKY_FEEDS = [
  { url: 'https://www.skysports.com/rss/12040', sport: 'Soccer' },
  { url: 'https://www.skysports.com/rss/12202', sport: 'F1' },
];

async function skySports() {
  const results = await Promise.allSettled(
    SKY_FEEDS.map(async ({ url, sport }) => {
      const res = await axios.get(url, {
        timeout: 8000,
        headers: { 'User-Agent': 'SportsPulse/1.0' },
      });
      const parsed = await parseStringPromise(res.data, { explicitArray: false });
      const items = parsed?.rss?.channel?.item || [];
      const arr = Array.isArray(items) ? items : [items];
      return arr.slice(0, 6).map(item => toArticle({
        title: item.title,
        url: item.link,
        source: 'Sky Sports',
        publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        sport_tag: sport,
        type: 'rss',
        description: item.description || '',
      }));
    })
  );
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}

// ── Main Scrape ───────────────────────────────────────────────────────────────

async function scrapeAll() {
  const cached = scraperCache.get('scraped_articles');
  if (cached) return cached;

  const [google, reddit, espn, bbc, sky] = await Promise.allSettled([
    scrapeGoogleNews(),
    scrapeReddit(),
    scrapeESPN(),
    scrapeBBC(),
    skySports(),
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

  // Deduplicate by id
  const seen = new Set();
  const unique = all.filter(a => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });

  scraperCache.set('scraped_articles', unique);
  return unique;
}

module.exports = { scrapeAll };
