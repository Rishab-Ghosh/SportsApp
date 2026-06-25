const BASE = 'https://external-api.kalshi.com/trade-api/v2';

// Real Kalshi series tickers discovered via /series API on 2026-06-24.
// Kept focused: max 8 per sport to avoid rate-limit on cold fetches.
const SPORT_SERIES = {
  NBA: [
    'KXNBA1HTOTAL',       // 1st Half Total Points (in-game)
    'KXNBA2HSPREAD',      // 2nd Half Spread (in-game)
    'KXNBA2QWINNER',      // 2nd Quarter Winner
    'KXNBA3D',            // Triple Double player props
    'KXNBARA',            // Rebounds + Assists
    'KXNBATOPPICK',       // Draft Lottery Winner
    'KXWNBA',             // WNBA Championship
    'KXWNBAFINAL',        // WNBA Finals Qualifiers
  ],
  NFL: [
    'KXNFLWINS',          // Season Win Totals
    'KXNFL1HSPREAD',      // 1st Half Spread
    'KXTEAMSINB',         // Teams in Super Bowl
    'KXNFLAFCCHAMP',      // AFC Champion
    'KXNFLNFCEAST',       // NFC East Winner
    'KXUFLCHAMP',         // UFL Champion
  ],
  MLB: [
    'KXMLBSERIES',        // Series Winner (game-level)
    'KXMLBRBI',           // Player RBIs
    'KXTEAMSINWS',        // Teams in World Series
    'KXMLBDIVWINNER',     // Division Winners
    'KXLEADERMLBHR',      // HR Leader
    'KXLEADERMLBWINS',    // Wins Leader
    'KXMLB500',           // Teams at .500
    'KXMLBTEAMSTAT',      // Team Stats
  ],
  Soccer: [
    // FIFA World Cup 2026 (active June-July 2026!)
    'KXWCGOAL',           // Goal Scorer markets
    'KXWCMOV',            // Method of Victory
    'KXFIFATOTAL',        // Total Goals
    // Domestic + cups in-season
    'KXMLSGAME',          // MLS Game Winner
    'KXINTLFRIENDLYTOTAL',// International Friendly Total
    'KXEREDIVISIESPREAD', // Eredivisie Spread
    'KXCHNSL',            // Chinese Super League
  ],
  F1: [
    'KXF1RACE',           // Race Winner (Austria GP active!)
    'KXF1QUALIFY',        // Qualifying
    'KXF1RACEPODIUM',     // Podium Finisher
    'KXF1H2H',            // Head-to-Head
    'KXF1TOP5',           // Top 5 Finisher
    'KXF1FASTESTLAP',     // Fastest Lap
  ],
  Tennis: [
    'KXWTATOURNWIN',      // Will player win tournament (Wimbledon, US Open, etc.)
    'KXITFWMATCH',        // ITF Women's Match (active!)
    'KXCHALLENGERMATCH',  // ATP Challenger
    'KXGRANDSLAMJFONSECA',// Will Joao Fonseca win a grand slam
    'KXATPFINALS',        // ATP Finals
    'KXATPFINALSQUAL',    // Will Player Qualify for ATP Finals
  ],
};

async function fetchSeries(seriesTicker) {
  try {
    const params = new URLSearchParams({ series_ticker: seriesTicker, limit: '200' });
    const res = await fetch(`${BASE}/markets?${params}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.markets || [];
  } catch (e) {
    console.error(`Series ${seriesTicker} failed:`, e.message);
    return [];
  }
}

function normalize(m, sport) {
  // API uses *_dollars fields (0.00–1.00); convert to probability percentage (0–100 cents).
  const yesBid   = m.yes_bid_dollars  != null ? Math.round(m.yes_bid_dollars  * 100) : null;
  const yesAsk   = m.yes_ask_dollars  != null ? Math.round(m.yes_ask_dollars  * 100) : null;
  const lastPrice= m.last_price_dollars != null ? Math.round(m.last_price_dollars * 100) : null;
  const prevPrice= m.previous_price_dollars != null ? Math.round(m.previous_price_dollars * 100) : null;

  // Best YES price: prefer bid (active buyer), then last trade, then ask.
  // Skip zeros — a 0 bid/last means no activity yet, not a 0% probability price.
  // Use || to skip 0, then ?? to skip null/undefined on the final fallback.
  const yesPrice = (yesBid > 0 ? yesBid : null)
                ?? (lastPrice > 0 ? lastPrice : null)
                ?? (yesAsk > 0 ? yesAsk : null)
                ?? null;
  const noPrice  = yesPrice != null ? 100 - yesPrice : null;

  // volume_fp is shares (fixed-point); keep as-is for sorting
  const volume = parseFloat(m.volume_fp || 0);

  return {
    id:            m.ticker,
    title:         m.title || m.yes_sub_title || m.ticker,
    yes_price:     yesPrice,
    no_price:      noPrice,
    yes_prev:      prevPrice,
    yes_bid:       yesBid,
    yes_ask:       yesAsk,
    volume:        volume,
    volume_24h:    parseFloat(m.volume_24h_fp || 0),
    open_interest: parseFloat(m.open_interest_fp || 0),
    close_time:    m.expiration_time || m.close_time,
    sport_tag:     sport,
    event_ticker:  m.event_ticker,
    liquidity:     m.liquidity_dollars || 0,
    status:        m.status,
  };
}

// ── Junk filtering & market scoring ──────────────────────────────────────────

// Match intraday micro-market title patterns — single-game props that resolve same day
const JUNK_PATTERNS = /\b(1st quarter|2nd quarter|3rd quarter|4th quarter|half total|1st half|2nd half|period|inning|drive)\b|\bwin the [12]H\b|\b[12]H by (over|under)\b/i;

function isJunkMarket(m) {
  if (m.yes_price != null && (m.yes_price <= 3 || m.yes_price >= 97)) return true;
  if ((m.volume || 0) < 1000) return true;
  if (JUNK_PATTERNS.test(m.title)) return true;
  return false;
}

function scoreMarket(m) {
  let s = 0;
  s += Math.log10((m.volume || 0) + 1) * 10;
  if (m.close_time) {
    const days = (new Date(m.close_time) - Date.now()) / 8.64e7;
    if (days > 2 && days < 120) s += 20;
  }
  const dist = Math.abs(50 - (m.yes_price ?? 50));
  s += (50 - dist) * 0.5; // reward markets closer to 50/50
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────

let _cache = null;
let _cacheTs = 0;
let _refreshPromise = null;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function _fetchAll() {
  const result = {};
  const raw = {};

  let sportIdx = 0;
  for (const [sport, tickers] of Object.entries(SPORT_SERIES)) {
    if (sportIdx++ > 0) await sleep(400);

    const all = [];
    for (let i = 0; i < tickers.length; i += 2) {
      const batch = tickers.slice(i, i + 2);
      const results = await Promise.all(batch.map(fetchSeries));
      all.push(...results.flat());
      if (i + 2 < tickers.length) await sleep(200);
    }

    const now = Date.now();
    const markets = all
      .map(m => normalize(m, sport))
      .filter(m =>
        m.yes_price != null &&
        m.yes_price > 0 && m.yes_price < 100 &&
        m.title && m.title !== m.id &&
        (!m.close_time || new Date(m.close_time).getTime() > now)
      );

    const seen = new Set();
    const deduped = markets.filter(m => !seen.has(m.id) && seen.add(m.id));

    // Raw list: all valid markets sorted by volume (used for "show all" toggle)
    raw[sport] = [...deduped].sort((a, b) => b.volume - a.volume);

    // Clean list: junk removed, sorted by composite score (contested + high-volume + not-about-to-expire)
    result[sport] = deduped
      .filter(m => !isJunkMarket(m))
      .sort((a, b) => scoreMarket(b) - scoreMarket(a));
  }

  result._raw = raw; // prefixed with _ so route flattening can skip it
  return result;
}

function _isIncomplete(data) {
  const sports = Object.keys(data).filter(k => !k.startsWith('_'));
  const empties = sports.filter(k => data[k].length === 0).length;
  return empties > 2;
}

async function getAllSportsMarkets() {
  const TTL = 60_000; // 60 seconds
  const now = Date.now();

  if (_cache && now - _cacheTs < TTL) return _cache;

  // Kick off background refresh if not already running
  if (!_refreshPromise) {
    _refreshPromise = _fetchAll()
      .then(data => {
        // Only cache if we got a reasonably complete result
        if (!_isIncomplete(data) || !_cache) {
          _cache = data;
          _cacheTs = Date.now();
        }
        _refreshPromise = null;
        return _cache || data;
      })
      .catch(err => {
        console.error('[kalshiSeries] refresh failed:', err.message);
        _refreshPromise = null;
        return _cache || {};
      });
  }

  // If we have stale cache, return it immediately while refresh runs in background
  if (_cache) return _cache;

  // First call ever — wait for the fetch
  return _refreshPromise;
}

module.exports = { getAllSportsMarkets, SPORT_SERIES };
