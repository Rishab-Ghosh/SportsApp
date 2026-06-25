const express = require('express');
const { getAllSportsMarkets } = require('../lib/kalshiDiscovery');
const { kalshiGet } = require('../lib/kalshi');

const router = express.Router();
const BASE = 'https://external-api.kalshi.com/trade-api/v2';

// GET /api/kalshi/sports-markets?sport=NBA|NFL|MLB|Soccer|F1|Tennis|All&showAll=1
router.get('/sports-markets', async (req, res) => {
  try {
    const sport   = req.query.sport || 'All';
    const showAll = req.query.showAll === '1';
    const allData = await getAllSportsMarkets();

    const source = showAll && allData._raw ? allData._raw : allData;

    // Collect hero IDs per sport for tagging
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

    // Clone first market per sport and tag hero: true
    markets = markets.map(m => heroIds.has(m.id) ? { ...m, hero: true } : m);

    res.json({ markets, sport, filtered: !showAll });
  } catch (err) {
    console.error('Kalshi sports-markets error:', err.message);
    res.status(502).json({ error: 'Failed to fetch Kalshi markets', markets: [], sport: req.query.sport || 'All' });
  }
});

// GET /api/kalshi/hero?sport=NBA|NFL|MLB|Soccer|F1|Tennis
// Returns the single highest-scored market for the given sport
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
const HISTORY_TTL   = 5 * 60 * 1000; // 5 minutes

// GET /api/kalshi/market/:ticker/history?range=1d|7d|30d
// Returns { points: [{t: ms, price: 0-100}], source: 'candlesticks'|'trades'|'none' }
router.get('/market/:id/history', async (req, res) => {
  const { id }    = req.params;
  const range     = ['1d', '7d', '30d'].includes(req.query.range) ? req.query.range : '7d';
  const cacheKey  = `${id}:${range}`;

  const cached = _historyCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < HISTORY_TTL) {
    return res.json(cached.data);
  }

  // Series ticker is prefix before first dash: KXWCGAME-26JUN25TURUSA-USA → KXWCGAME
  const seriesTicker = id.split('-')[0];
  const spans = { '1d': 86400, '7d': 7 * 86400, '30d': 30 * 86400 };
  const span  = spans[range];
  const now   = Math.floor(Date.now() / 1000);
  const start = now - span;
  const interval = range === '30d' ? 1440 : 60; // daily candles for 30d, hourly otherwise

  const save = (data) => {
    _historyCache.set(cacheKey, { ts: Date.now(), data });
    return res.json(data);
  };

  try {
    // ── Attempt candlesticks ──────────────────────────────────────────────────
    const candleUrl = `${BASE}/series/${seriesTicker}/markets/${id}/candlesticks` +
      `?start_ts=${start}&end_ts=${now}&period_interval=${interval}&include_latest_before_start=true`;

    const r = await fetch(candleUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (r.ok) {
      const data   = await r.json();
      const points = (data.candlesticks || [])
        .map(c => ({
          t:     (c.end_period_ts || 0) * 1000,
          price: c.price?.close_dollars != null
            ? Math.round(parseFloat(c.price.close_dollars) * 100)
            : null,
        }))
        .filter(p => p.price != null && p.t > 0);

      if (points.length >= 2) {
        return save({ points, source: 'candlesticks' });
      }
    } else {
      console.warn(`[history] candlesticks ${r.status} for ${id}`);
    }

    // ── Fallback: reconstruct from trades ─────────────────────────────────────
    const tradesUrl = `${BASE}/markets/trades?ticker=${encodeURIComponent(id)}&limit=1000`;
    const tr = await fetch(tradesUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (tr.ok) {
      const td     = await tr.json();
      const cutoff = (now - span) * 1000;
      const points = (td.trades || [])
        .map(t => ({
          t:     new Date(t.created_time).getTime(),
          price: t.yes_price_dollars != null
            ? Math.round(parseFloat(t.yes_price_dollars) * 100)
            : null,
        }))
        .filter(p => p.price != null && p.t >= cutoff)
        .sort((a, b) => a.t - b.t);

      if (points.length >= 2) {
        return save({ points, source: 'trades' });
      }
    }

    return save({ points: [], source: 'none' });
  } catch (err) {
    console.error(`[history] ${id}:`, err.message);
    const empty = { points: [], source: 'error' };
    _historyCache.set(cacheKey, { ts: Date.now(), data: empty });
    return res.json(empty);
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
