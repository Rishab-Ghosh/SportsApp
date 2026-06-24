const express = require('express');
const axios = require('axios');
const { withCache } = require('../middleware/cache');

const router = express.Router();

const SPORT_KEYWORDS = ['NBA', 'NFL', 'MLB', 'soccer', 'F1', 'tennis', 'trade', 'draft', 'champion', 'SPORTS', 'sport'];

function detectSportTag(title) {
  const t = (title || '').toUpperCase();
  if (t.match(/\bNBA\b|BASKETBALL|LAKERS|CELTICS|WARRIORS|KNICKS|WNBA|REESE|GRAY/)) return 'NBA';
  if (t.match(/\bNFL\b|FOOTBALL|QUARTERBACK|TOUCHDOWN|CHIEFS|COWBOYS|EAGLES/)) return 'NFL';
  if (t.match(/\bMLB\b|BASEBALL|RUNS SCORED|CUBS|DODGERS|YANKEES|METS|ATLANTA|MINNESOTA|PITTSBURGH|SAN DIEGO|DETROIT|TAMPA BAY|LOS ANGELES [AD]|CHICAGO WS/)) return 'MLB';
  if (t.match(/SOCCER|EPL|PREMIER LEAGUE|GOALS SCORED|BOTH TEAMS TO SCORE|FIFA|WORLD CUP|BRAZIL|MOROCCO|GERMANY|FRANCE|SPAIN|ITALY|NETHERLANDS|KOREA|MEXICO|CANADA|SWITZERLAND|TIE|BOSNIA|CZECHIA|SENEGAL/)) return 'Soccer';
  if (t.match(/\bF1\b|FORMULA|GRAND PRIX|VERSTAPPEN|HAMILTON|FERRARI/)) return 'F1';
  if (t.match(/TENNIS|WIMBLEDON|US OPEN|FRENCH OPEN|DJOKOVIC/)) return 'Tennis';
  if (t.match(/DRAFT/)) return 'Draft';
  if (t.match(/CHAMPION/)) return 'Championship';
  if (t.match(/TRANSFER|TRADE/)) return 'Trade';
  return 'Other';
}

router.get('/sports-markets', async (req, res) => {
  try {
    const data = await withCache('kalshi_markets', async () => {
      const response = await axios.get('https://api.elections.kalshi.com/trade-api/v2/markets', {
        params: { status: 'open', limit: 200 },
        headers: { 'Content-Type': 'application/json' },
        timeout: 8000,
      });

      const markets = response.data?.markets || [];

      const filtered = markets.filter(m => {
        const text = [m.title || '', m.ticker || '', m.event_ticker || ''].join(' ').toLowerCase();
        return SPORT_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
      });

      return filtered.map(m => {
        // API returns dollar values (0.00–1.00); convert to cents (0–100)
        const yesAsk = m.yes_ask_dollars != null ? Math.round(m.yes_ask_dollars * 100) : null;
        const noAsk = m.no_ask_dollars != null ? Math.round(m.no_ask_dollars * 100) : null;
        const lastPrice = m.last_price_dollars != null ? Math.round(m.last_price_dollars * 100) : null;
        const yesPrev = m.previous_yes_ask_dollars != null ? Math.round(m.previous_yes_ask_dollars * 100) : null;

        // Use yes_ask, fall back to last_price, fall back to 50
        const displayYes = yesAsk || lastPrice || 50;
        const displayNo = noAsk || (yesAsk != null ? Math.max(0, 100 - yesAsk) : 50);

        // volume_fp is a fixed-point integer (shares), not dollars
        const volume = parseFloat(m.volume_fp || 0);

        return {
          id: m.ticker,
          title: m.title,
          yes_price: displayYes,
          no_price: displayNo,
          yes_prev: yesPrev,
          volume: volume,
          close_time: m.close_time || m.expiration_time,
          sport_tag: detectSportTag(m.title || ''),
          event_ticker: m.event_ticker,
        };
      });
    });

    res.json({ markets: data });
  } catch (err) {
    console.error('Kalshi error:', err.message);
    res.status(502).json({ error: 'Failed to fetch Kalshi markets', markets: [] });
  }
});

module.exports = router;
