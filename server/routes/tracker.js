const express = require('express');
const axios = require('axios');
const { withCache } = require('../middleware/cache');

const router = express.Router();

// Sport keyword map for filtering Kalshi markets by sport
const SPORT_KEYWORD_MAP = {
  NBA: ['NBA', 'basketball', 'draft', 'free agent', 'WNBA', 'lakers', 'celtics', 'warriors', 'knicks', 'reese', 'gray'],
  NFL: ['NFL', 'football', 'quarterback', 'chiefs', 'cowboys', 'eagles', 'touchdown', 'trade'],
  MLB: ['MLB', 'baseball', 'cubs', 'dodgers', 'yankees', 'mets', 'atlanta', 'minnesota', 'pittsburgh', 'runs scored'],
  SOCCER: ['soccer', 'transfer', 'epl', 'premier league', 'fifa', 'champions', 'world cup', 'goals scored', 'brazil', 'morocco'],
  F1: ['F1', 'formula', 'grand prix', 'verstappen', 'hamilton', 'ferrari'],
  TENNIS: ['tennis', 'wimbledon', 'us open', 'french open', 'djokovic', 'swiatek', 'nadal'],
};

// Significant tokens: lowercase words longer than 5 chars
function significantTokens(str) {
  return (str || '').toLowerCase().split(/\W+/).filter(w => w.length > 5);
}

async function getKalshiMarkets() {
  try {
    const port = process.env.PORT || 3001;
    const response = await axios.get(`http://localhost:${port}/api/kalshi/sports-markets`, { timeout: 5000 });
    return response.data.markets || [];
  } catch {
    return [];
  }
}

async function getNewsArticles() {
  try {
    const port = process.env.PORT || 3001;
    const response = await axios.get(`http://localhost:${port}/api/news`, { timeout: 5000 });
    return response.data.articles || [];
  } catch {
    return [];
  }
}

// GET /api/tracker/:sport (nba, nfl, mlb, soccer, f1, tennis)
router.get('/:sport', async (req, res) => {
  const sportRaw = req.params.sport.toUpperCase();
  // Normalize to key used in SPORT_KEYWORD_MAP
  const sportKey = sportRaw === 'SOCCER' ? 'SOCCER' : sportRaw;

  try {
    const data = await withCache(`tracker_${sportKey}`, async () => {
      const [allMarkets, allArticles] = await Promise.all([
        getKalshiMarkets(),
        getNewsArticles(),
      ]);

      const keywords = SPORT_KEYWORD_MAP[sportKey] || [];

      // Filter markets: use sport_tag first, then keyword fallback
      const sportMarkets = allMarkets.filter(m => {
        if ((m.sport_tag || '').toUpperCase() === sportKey) return true;
        const titleLower = (m.title || '').toLowerCase();
        return keywords.some(kw => titleLower.includes(kw.toLowerCase()));
      });

      // Filter news — match sport_tag (Guardian uses 'Soccer' tag, URL param uses 'soccer')
      const tagToMatch = sportRaw === 'SOCCER' ? 'Soccer' :
        sportRaw === 'NBA' ? 'NBA' :
        sportRaw === 'NFL' ? 'NFL' :
        sportRaw === 'MLB' ? 'MLB' :
        sportRaw === 'F1'  ? 'F1'  :
        sportRaw === 'TENNIS' ? 'Tennis' : sportRaw;

      const sportNews = allArticles
        .filter(a => a.sport_tag === tagToMatch)
        .slice(0, 4);

      if (sportMarkets.length === 0) {
        return { cards: [], news: sportNews };
      }

      const maxVolume = Math.max(...sportMarkets.map(m => m.volume || 0), 1);

      const cards = sportMarkets.slice(0, 12).map(m => {
        const marketTokens = significantTokens(m.title || '');
        const relatedNews = sportNews.filter(a => {
          const aTokenSet = new Set(significantTokens(a.title));
          return marketTokens.some(t => aTokenSet.has(t));
        }).slice(0, 2);

        return {
          market_id: m.id,
          market_title: m.title,
          yes_price: m.yes_price ?? 50,
          no_price: m.no_price ?? 50,
          volume: m.volume || 0,
          volume_pct: (m.volume || 0) / maxVolume,
          close_time: m.close_time,
          related_news: relatedNews,
        };
      });

      return { cards, news: sportNews };
    }, 60);

    res.json(data);
  } catch (err) {
    console.error(`Tracker error [${sportKey}]:`, err.message);
    res.status(502).json({ error: `Failed to fetch tracker for ${sportKey}`, cards: [], news: [] });
  }
});

module.exports = router;
