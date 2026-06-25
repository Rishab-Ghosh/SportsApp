const express = require('express');
const { getAllSportsMarkets } = require('../lib/kalshiDiscovery');
const { kalshiGet } = require('../lib/kalshi');

const router = express.Router();

// GET /api/kalshi/sports-markets?sport=NBA|NFL|MLB|Soccer|F1|Tennis|All&showAll=1
router.get('/sports-markets', async (req, res) => {
  try {
    const sport = req.query.sport || 'All';
    const showAll = req.query.showAll === '1';
    const allData = await getAllSportsMarkets();

    // showAll=1 serves unfiltered raw list (includes junk markets)
    const source = showAll && allData._raw ? allData._raw : allData;

    let markets;
    if (sport === 'All' || !sport) {
      markets = Object.entries(source)
        .filter(([k]) => !k.startsWith('_') && Array.isArray(source[k]))
        .flatMap(([, v]) => v)
        .sort((a, b) => (b.volume || 0) - (a.volume || 0));
    } else {
      markets = source[sport] || [];
    }

    res.json({ markets, sport, filtered: !showAll });
  } catch (err) {
    console.error('Kalshi sports-markets error:', err.message);
    res.status(502).json({ error: 'Failed to fetch Kalshi markets', markets: [], sport: req.query.sport || 'All' });
  }
});

// 5-minute in-memory cache for price history (one entry per market ticker)
const _historyCache = new Map();
const HISTORY_TTL = 5 * 60 * 1000;

// GET /api/kalshi/market/:ticker/history
// Returns { points: [{t: ms, price: 0-100}] } for recharts
router.get('/market/:id/history', async (req, res) => {
  const { id } = req.params;

  const cached = _historyCache.get(id);
  if (cached && Date.now() - cached.ts < HISTORY_TTL) {
    return res.json(cached.data);
  }

  try {
    // Series ticker is the prefix before the first dash: KXF1RACE-2026AUT-MAX → KXF1RACE
    const seriesTicker = id.split('-')[0];
    const end = Math.floor(Date.now() / 1000);
    const start = end - 7 * 24 * 60 * 60;
    const BASE = 'https://external-api.kalshi.com/trade-api/v2';
    const url = `${BASE}/series/${seriesTicker}/markets/${id}/candlesticks?start_ts=${start}&end_ts=${end}&period_interval=60`;

    const r = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (!r.ok) {
      const empty = { points: [] };
      _historyCache.set(id, { ts: Date.now(), data: empty });
      return res.json(empty);
    }

    const data = await r.json();
    const points = (data.candlesticks || [])
      .map(c => ({
        t: (c.end_period_ts || 0) * 1000,
        price: c.price?.close_dollars != null
          ? Math.round(parseFloat(c.price.close_dollars) * 100)
          : null,
      }))
      .filter(p => p.price != null && p.t > 0);

    const response = { points };
    _historyCache.set(id, { ts: Date.now(), data: response });
    res.json(response);
  } catch (err) {
    console.error(`History error [${id}]:`, err.message);
    res.json({ points: [] });
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
