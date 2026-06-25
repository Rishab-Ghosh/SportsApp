'use strict';

const BASE = 'https://external-api.kalshi.com/trade-api/v2';
const SERIES_PER_SPORT = 12;  // top N per sport by volume
const BATCH_SIZE       = 2;   // concurrent event requests — keep low to avoid 429
const BATCH_DELAY_MS   = 400; // ms between batches
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Series bucketing ──────────────────────────────────────────────────────────

// Classify a Kalshi series into one of 6 sport buckets, or null to skip.
// Derived from live /series?category=Sports catalog (tag taxonomy verified 2026-06-24).
function bucketSeries(series) {
  const tags  = series.tags || [];
  const title = (series.title || '').toLowerCase();
  const ticker = series.ticker || '';

  if (tags.includes('Basketball')) {
    // Exclude WNBA, college, and international leagues
    if (/women|wnba|college|ncaa|march|euroleague|cba|fiba|olympic|g\s?league/.test(title)) return null;
    return 'NBA';
  }
  if (tags.includes('Football')) {
    // Exclude college, arena, and Canadian football
    if (/college|ncaa|cfb|high school|arena|canadian|cfl/.test(title)) return null;
    return 'NFL';
  }
  if (tags.includes('Baseball')) {
    // Exclude college, spring training, WBC, and Japanese NPB
    if (/college|ncaa|spring training|world baseball classic|wbc|japan|npb|minor/.test(title)) return null;
    return 'MLB';
  }
  if (tags.includes('Soccer')) return 'Soccer';
  if (tags.includes('Motorsport')) {
    // Only F1 — skip NASCAR, IndyCar, Indy 500
    if (ticker.startsWith('KXF1') || /\bf1\b|formula 1/.test(title)) return 'F1';
    return null;
  }
  if (tags.includes('Tennis')) return 'Tennis';
  return null;
}

// ── API calls ─────────────────────────────────────────────────────────────────

async function discoverSportsSeries() {
  try {
    const res = await fetch(`${BASE}/series?category=Sports&include_volume=true`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.series || [];
  } catch (e) {
    console.error('[kalshiDiscovery] discoverSportsSeries failed:', e.message);
    return [];
  }
}

async function fetchEventsForSeries(seriesTicker) {
  try {
    const params = new URLSearchParams({
      series_ticker: seriesTicker,
      status: 'open',
      with_nested_markets: 'true',
      limit: '200',
    });
    const res = await fetch(`${BASE}/events?${params}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 429) {
      // Rate limited — wait and retry once
      await sleep(1500);
      const retry = await fetch(`${BASE}/events?${params}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      if (!retry.ok) return [];
      const d = await retry.json();
      return d.events || [];
    }
    if (!res.ok) return [];
    const data = await res.json();
    return data.events || [];
  } catch (e) {
    console.warn(`[kalshiDiscovery] ${seriesTicker}: ${e.message}`);
    return [];
  }
}

// ── Market normalization ──────────────────────────────────────────────────────

const JUNK_PATTERNS = /\b(1st quarter|2nd quarter|3rd quarter|4th quarter|half total|1st half|2nd half|period|inning|drive)\b|\bwin the [12]H\b|\b[12]H by (over|under)\b/i;

function normalizeMarket(m, event, sport) {
  // Events endpoint returns *_dollars fields as strings in 0.00–1.00 range
  const bidD  = parseFloat(m.yes_bid_dollars);
  const askD  = parseFloat(m.yes_ask_dollars);
  const lastD = parseFloat(m.last_price_dollars);
  const prevD = parseFloat(m.previous_price_dollars);

  // Best price: midpoint of bid/ask > last > bid alone > ask alone
  const hasBid = !isNaN(bidD) && bidD > 0.005;
  const hasAsk = !isNaN(askD) && askD > 0.005;
  const hasLast = !isNaN(lastD) && lastD > 0.005;

  let yesPrice = null;
  if (hasBid && hasAsk) {
    yesPrice = Math.round((bidD + askD) / 2 * 100);
  } else if (hasLast) {
    yesPrice = Math.round(lastD * 100);
  } else if (hasBid) {
    yesPrice = Math.round(bidD * 100);
  } else if (hasAsk) {
    yesPrice = Math.round(askD * 100);
  }

  const prevPrice = !isNaN(prevD) && prevD > 0.005 ? Math.round(prevD * 100) : null;
  const volume    = parseFloat(m.volume_fp  || 0);
  const vol24h    = parseFloat(m.volume_24h_fp || 0);

  return {
    id:            m.ticker,
    event_ticker:  event.event_ticker || m.event_ticker,
    title:         m.title || event.title || m.ticker,
    sport_tag:     sport,
    yes_price:     yesPrice,
    no_price:      yesPrice != null ? 100 - yesPrice : null,
    yes_prev:      prevPrice,
    volume:        volume,
    volume_24h:    vol24h,
    close_time:    m.close_time || m.expiration_time,
    series_ticker: event.series_ticker,
    liquidity:     parseFloat(m.liquidity_dollars || 0),
    status:        m.status,
    open_interest: parseFloat(m.open_interest_fp || 0),
  };
}

function isJunk(m) {
  if (m.yes_price == null)                       return true;
  if (m.yes_price <= 2 || m.yes_price >= 98)    return true;  // near-certain resolved markets
  if ((m.volume || 0) < 200)                     return true;  // paper-thin markets
  if (JUNK_PATTERNS.test(m.title))               return true;  // intraday micro-markets
  return false;
}

function scoreMarket(m) {
  let s = 0;
  s += Math.log10((m.volume || 0) + 1) * 10;
  if (m.close_time) {
    const days = (new Date(m.close_time) - Date.now()) / 8.64e7;
    if (days > 2 && days < 200) s += 20;
  }
  const dist = Math.abs(50 - (m.yes_price ?? 50));
  s += (50 - dist) * 0.5; // reward near-50/50 markets (contested outcome)
  return s;
}

// ── Orchestration ─────────────────────────────────────────────────────────────

async function buildMarketMap() {
  const allSeries = await discoverSportsSeries();
  if (!allSeries.length) throw new Error('Series catalog returned empty');

  // Bucket and pick top N per sport by cumulative trading volume
  const buckets = { NBA: [], NFL: [], MLB: [], Soccer: [], F1: [], Tennis: [] };
  for (const s of allSeries) {
    const sport = bucketSeries(s);
    if (!sport) continue;
    buckets[sport].push({ ticker: s.ticker, vol: parseFloat(s.volume_fp || 0) });
  }

  const topSeries = {};
  for (const [sport, list] of Object.entries(buckets)) {
    list.sort((a, b) => b.vol - a.vol);
    topSeries[sport] = list.slice(0, SERIES_PER_SPORT).map(x => x.ticker);
  }

  // Fetch events for all selected series — small batches with delays to avoid 429
  const result = {};
  const raw    = {};

  for (const [sport, tickers] of Object.entries(topSeries)) {
    const allEvents = [];
    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
      const batch = tickers.slice(i, i + BATCH_SIZE);
      const fetched = await Promise.all(batch.map(fetchEventsForSeries));
      allEvents.push(...fetched.flat());
      if (i + BATCH_SIZE < tickers.length) await sleep(BATCH_DELAY_MS);
    }

    const now = Date.now();
    const markets = [];
    for (const event of allEvents) {
      for (const m of event.markets || []) {
        const norm = normalizeMarket(m, event, sport);
        if (
          norm.yes_price != null &&
          norm.yes_price > 0 && norm.yes_price < 100 &&
          norm.title &&
          (!norm.close_time || new Date(norm.close_time).getTime() > now)
        ) {
          markets.push(norm);
        }
      }
    }

    // Dedupe by market ticker
    const seen    = new Set();
    const deduped = markets.filter(m => !seen.has(m.id) && seen.add(m.id));

    raw[sport]    = [...deduped].sort((a, b) => b.volume - a.volume);
    result[sport] = deduped.filter(m => !isJunk(m)).sort((a, b) => scoreMarket(b) - scoreMarket(a));
  }

  result._raw = raw;
  return result;
}

// ── In-memory cache with background refresh ───────────────────────────────────

let _cache          = null;
let _cacheTs        = 0;
let _refreshPromise = null;
const TTL           = 90_000; // 90 seconds

function _isIncomplete(data) {
  const sports  = Object.keys(data).filter(k => !k.startsWith('_'));
  const empties = sports.filter(k => !data[k]?.length).length;
  return empties > 3; // allow up to 3 empty sports (NBA off-season, NFL off-season)
}

async function getAllSportsMarkets() {
  const now = Date.now();
  if (_cache && now - _cacheTs < TTL) return _cache;

  if (!_refreshPromise) {
    _refreshPromise = buildMarketMap()
      .then(data => {
        if (!_isIncomplete(data) || !_cache) {
          _cache   = data;
          _cacheTs = Date.now();
        }
        _refreshPromise = null;
        return _cache || data;
      })
      .catch(err => {
        console.error('[kalshiDiscovery] refresh failed:', err.message);
        _refreshPromise = null;
        return _cache || {};
      });
  }

  // Return stale cache immediately if available; first call waits for fetch
  if (_cache) return _cache;
  return _refreshPromise;
}

module.exports = { getAllSportsMarkets, buildMarketMap, bucketSeries };
