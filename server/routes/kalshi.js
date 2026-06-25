const express = require('express');
const { getAllSportsMarkets } = require('../lib/kalshiDiscovery');
const { kalshiGet } = require('../lib/kalshi');

const router = express.Router();
const BASE = 'https://external-api.kalshi.com/trade-api/v2';

// GET /api/kalshi/sports-markets?sport=All|NBA|...&category=Championship|...&showAll=1
router.get('/sports-markets', async (req, res) => {
  try {
    const sport    = req.query.sport || 'All';
    const category = req.query.category || null;
    const showAll  = req.query.showAll === '1';
    const allData  = await getAllSportsMarkets();

    const source = showAll && allData._raw ? allData._raw : allData;

    // Collect hero IDs per sport (first item in each sorted sport array)
    const heroIds = new Set();
    for (const [k, v] of Object.entries(allData)) {
      if (!k.startsWith('_') && Array.isArray(v) && v.length) heroIds.add(v[0].id);
    }

    let markets;
    if (sport === 'All' || !sport) {
      markets = Object.entries(source)
        .filter(([k]) => !k.startsWith('_') && Array.isArray(source[k]))
        .flatMap(([, v]) => v)
        .sort((a, b) => (b.volume || 0) - (a.volume || 0));
    } else {
      markets = source[sport] || [];
    }

    if (category) {
      markets = markets.filter(m => m.category === category);
    }

    markets = markets.map(m => heroIds.has(m.id) ? { ...m, hero: true } : m);

    res.json({ markets, sport, category: category || null, filtered: !showAll });
  } catch (err) {
    console.error('Kalshi sports-markets error:', err.message);
    res.status(502).json({ error: 'Failed to fetch Kalshi markets', markets: [], sport: req.query.sport || 'All' });
  }
});

// GET /api/kalshi/categories?sport=NBA
// Returns non-empty categories for a sport, sorted by total volume desc
router.get('/categories', async (req, res) => {
  try {
    const sport   = req.query.sport;
    const allData = await getAllSportsMarkets();

    let markets;
    if (!sport || sport === 'All') {
      markets = Object.entries(allData)
        .filter(([k]) => !k.startsWith('_') && Array.isArray(allData[k]))
        .flatMap(([, v]) => v);
    } else {
      markets = allData[sport] || [];
    }

    // Aggregate by category
    const catMap = new Map(); // name → {count, volume}
    for (const m of markets) {
      const cat = m.category || 'Other';
      const cur = catMap.get(cat) || { name: cat, count: 0, volume: 0 };
      cur.count++;
      cur.volume += m.volume || 0;
      catMap.set(cat, cur);
    }

    const categories = [...catMap.values()]
      .filter(c => c.count > 0)
      .sort((a, b) => b.volume - a.volume);

    res.json({ sport: sport || 'All', categories });
  } catch (err) {
    console.error('Kalshi categories error:', err.message);
    res.status(502).json({ error: 'Failed to fetch categories', categories: [] });
  }
});

// GET /api/kalshi/hero?sport=NBA|NFL|MLB|Soccer|F1|Tennis
router.get('/hero', async (req, res) => {
  try {
    const sport   = req.query.sport;
    const allData = await getAllSportsMarkets();

    if (!sport || sport === 'All') {
      const all = Object.entries(allData)
        .filter(([k]) => !k.startsWith('_') && Array.isArray(allData[k]))
        .flatMap(([, v]) => v)
        .sort((a, b) => (b.volume || 0) - (a.volume || 0));
      return res.json({ market: all[0] || null });
    }

    const markets = allData[sport] || [];
    return res.json({ market: markets[0] || null });
  } catch (err) {
    console.error('Kalshi hero error:', err.message);
    res.status(502).json({ error: 'Failed to fetch hero market', market: null });
  }
});

// ── Price history cache (keyed by "ticker:range") ─────────────────────────────
const _historyCache = new Map();
const HISTORY_TTL   = 5 * 60 * 1000;

// GET /api/kalshi/market/:ticker/history?range=1d|7d|30d
router.get('/market/:id/history', async (req, res) => {
  const { id }   = req.params;
  const range    = ['1d', '7d', '30d'].includes(req.query.range) ? req.query.range : '7d';
  const cacheKey = `${id}:${range}`;

  const cached = _historyCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < HISTORY_TTL) return res.json(cached.data);

  const seriesTicker = id.split('-')[0];
  const spans  = { '1d': 86400, '7d': 7 * 86400, '30d': 30 * 86400 };
  const span   = spans[range];
  const now    = Math.floor(Date.now() / 1000);
  const start  = now - span;
  const interval = range === '30d' ? 1440 : 60;

  const save = (data) => { _historyCache.set(cacheKey, { ts: Date.now(), data }); return res.json(data); };

  try {
    const candleUrl = `${BASE}/series/${seriesTicker}/markets/${id}/candlesticks` +
      `?start_ts=${start}&end_ts=${now}&period_interval=${interval}&include_latest_before_start=true`;

    const r = await fetch(candleUrl, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });

    if (r.ok) {
      const data   = await r.json();
      const points = (data.candlesticks || [])
        .map(c => ({ t: (c.end_period_ts || 0) * 1000, price: c.price?.close_dollars != null ? Math.round(parseFloat(c.price.close_dollars) * 100) : null }))
        .filter(p => p.price != null && p.t > 0);
      if (points.length >= 2) return save({ points, source: 'candlesticks' });
    }

    const tradesUrl = `${BASE}/markets/trades?ticker=${encodeURIComponent(id)}&limit=1000`;
    const tr = await fetch(tradesUrl, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });

    if (tr.ok) {
      const td     = await tr.json();
      const cutoff = (now - span) * 1000;
      const points = (td.trades || [])
        .map(t => ({ t: new Date(t.created_time).getTime(), price: t.yes_price_dollars != null ? Math.round(parseFloat(t.yes_price_dollars) * 100) : null }))
        .filter(p => p.price != null && p.t >= cutoff)
        .sort((a, b) => a.t - b.t);
      if (points.length >= 2) return save({ points, source: 'trades' });
    }

    return save({ points: [], source: 'none' });
  } catch (err) {
    console.error(`[history] ${id}:`, err.message);
    const empty = { points: [], source: 'error' };
    _historyCache.set(cacheKey, { ts: Date.now(), data: empty });
    return res.json(empty);
  }
});

// ── Event history cache ───────────────────────────────────────────────────────
const _eventHistoryCache = new Map();

// GET /api/kalshi/event/:eventTicker/history?range=1d|7d|30d
// Returns { series: [{ticker, name, points}] } — one entry per outcome
router.get('/event/:eventTicker/history', async (req, res) => {
  const { eventTicker } = req.params;
  const range    = ['1d', '7d', '30d'].includes(req.query.range) ? req.query.range : '7d';
  const cacheKey = `${eventTicker}:${range}`;

  const cached = _eventHistoryCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < HISTORY_TTL) return res.json(cached.data);

  const save = (data) => { _eventHistoryCache.set(cacheKey, { ts: Date.now(), data }); return res.json(data); };

  try {
    const seriesTicker = eventTicker.split('-')[0];
    const spans    = { '1d': 86400, '7d': 604800, '30d': 2592000 };
    const span     = spans[range] || spans['7d'];
    const now      = Math.floor(Date.now() / 1000);
    const interval = range === '30d' ? 1440 : 60;

    // Fetch event markets for outcome names
    const evRes = await fetch(`${BASE}/events/${eventTicker}?with_nested_markets=true`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    const marketNames = {};
    if (evRes.ok) {
      const evData = await evRes.json();
      for (const m of (evData.event?.markets || [])) {
        marketNames[m.ticker] = m.yes_sub_title || m.subtitle || m.title || m.ticker;
      }
    }

    // Fetch multi-outcome candlesticks
    const candleUrl = `${BASE}/series/${seriesTicker}/events/${eventTicker}/candlesticks` +
      `?start_ts=${now - span}&end_ts=${now}&period_interval=${interval}`;

    const r = await fetch(candleUrl, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });

    if (!r.ok) {
      console.warn(`[event-history] ${r.status} for ${eventTicker}`);
      return save({ series: [] });
    }

    const data    = await r.json();
    const tickers = data.market_tickers || [];
    const allCandles = data.market_candlesticks || [];

    const series = tickers
      .map((ticker, i) => ({
        ticker,
        name: marketNames[ticker] || ticker.split('-').pop(),
        points: (allCandles[i] || [])
          .map(c => ({
            t:     (c.end_period_ts || 0) * 1000,
            price: c.price?.close_dollars != null ? Math.round(parseFloat(c.price.close_dollars) * 100) : null,
          }))
          .filter(p => p.price != null && p.t > 0),
      }))
      .filter(s => s.points.length >= 2)
      .sort((a, b) => {
        const la = a.points[a.points.length - 1]?.price ?? 0;
        const lb = b.points[b.points.length - 1]?.price ?? 0;
        return lb - la;
      });

    return save({ series });
  } catch (err) {
    console.error(`[event-history] ${eventTicker}:`, err.message);
    return save({ series: [] });
  }
});

router.get('/portfolio', async (req, res) => {
  const keyId = process.env.KALSHI_API_KEY_ID;
  if (!keyId) return res.json({ error: 'No Kalshi credentials configured', balance: null });
  try {
    const data = await kalshiGet('/portfolio/balance');
    res.json({ balance: data });
  } catch (err) {
    console.error('Kalshi portfolio error:', err.message);
    res.status(502).json({ error: 'Failed to fetch portfolio', balance: null });
  }
});

module.exports = router;
