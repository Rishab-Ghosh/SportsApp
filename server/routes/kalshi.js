const express = require('express');
const { getAllSportsMarkets } = require('../lib/kalshiSeries');
const { kalshiGet } = require('../lib/kalshi');

const router = express.Router();

// GET /api/kalshi/sports-markets?sport=NBA|NFL|MLB|Soccer|F1|Tennis|All
router.get('/sports-markets', async (req, res) => {
  try {
    const sport = req.query.sport || 'All';
    const allData = await getAllSportsMarkets();

    let markets;
    if (sport === 'All' || !sport) {
      // Flatten all sports, sort by volume
      markets = Object.values(allData)
        .flat()
        .sort((a, b) => b.volume - a.volume);
    } else {
      markets = allData[sport] || [];
    }

    res.json({ markets, sport });
  } catch (err) {
    console.error('Kalshi sports-markets error:', err.message);
    res.status(502).json({ error: 'Failed to fetch Kalshi markets', markets: [], sport: req.query.sport || 'All' });
  }
});

// GET /api/kalshi/market/:id/history — price candlestick history for charts
router.get('/market/:id/history', async (req, res) => {
  const { id } = req.params;
  try {
    const BASE = 'https://external-api.kalshi.com/trade-api/v2';
    const end_ts = Math.floor(Date.now() / 1000);
    const start_ts = end_ts - 7 * 24 * 3600; // 7 days back
    const url = `${BASE}/markets/${encodeURIComponent(id)}/candlesticks?start_ts=${start_ts}&end_ts=${end_ts}&period_interval=60`;

    const r = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return res.json({ history: [] });

    const data = await r.json();
    const candles = (data.candlesticks || data.candles || []).map(c => ({
      ts: c.end_period_ts || c.ts,
      yes_price: c.yes_close != null ? Math.round(c.yes_close * 100) : null,
      volume: parseFloat(c.volume || 0),
    })).filter(c => c.yes_price != null);

    res.json({ id, history: candles });
  } catch (err) {
    console.error(`History error [${id}]:`, err.message);
    res.json({ id, history: [] });
  }
});

// GET /api/kalshi/portfolio
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
