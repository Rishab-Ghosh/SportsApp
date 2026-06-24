const express = require('express');
const axios = require('axios');
const { withCache } = require('../middleware/cache');

const router = express.Router();

function detectSportTag(title, extra) {
  const text = ((title || '') + ' ' + (extra || '')).toUpperCase();
  if (text.match(/\bNBA\b|BASKETBALL|LAKERS|CELTICS|KNICKS|WARRIORS|LEBRON|CURRY|WNBA/)) return 'NBA';
  if (text.match(/\bNFL\b|FOOTBALL|MAHOMES|BRADY|CHIEFS|COWBOYS|EAGLES|QUARTERBACK/)) return 'NFL';
  if (text.match(/\bMLB\b|BASEBALL|YANKEES|DODGERS|METS|CUBS|WORLD SERIES|OHTANI/)) return 'MLB';
  if (text.match(/SOCCER|EPL|PREMIER LEAGUE|TRANSFER|MESSI|RONALDO|CHAMPIONS LEAGUE|FIFA|LA LIGA|FOOTBALL CLUB|\bFC\b/)) return 'Soccer';
  if (text.match(/\bF1\b|FORMULA 1|FORMULA ONE|VERSTAPPEN|HAMILTON|GRAND PRIX|FERRARI|RED BULL RACING/)) return 'F1';
  if (text.match(/TENNIS|WIMBLEDON|US OPEN|FRENCH OPEN|DJOKOVIC|NADAL|FEDERER|SERENA|SWIATEK/)) return 'Tennis';
  return 'General';
}

// Significant tokens: lowercase words longer than 5 chars
function significantTokens(str) {
  return (str || '').toLowerCase().split(/\W+/).filter(w => w.length > 5);
}

function findMarketMatch(articleTitle, markets) {
  const articleSet = new Set(significantTokens(articleTitle));
  if (articleSet.size === 0) return null;
  for (const m of markets) {
    const marketTokens = significantTokens(m.title || '');
    if (marketTokens.some(t => articleSet.has(t))) return m;
  }
  return null;
}

// Fetches Guardian articles — shared by / and /enriched
async function fetchGuardianArticles() {
  return withCache('sports_news', async () => {
    const apiKey = process.env.GUARDIAN_API_KEY;
    if (!apiKey || apiKey === 'your_guardian_api_key_here') {
      return getMockNews();
    }

    const response = await axios.get('https://content.guardianapis.com/search', {
      params: {
        q: 'sport OR NBA OR NFL OR soccer OR F1 OR tennis OR trade OR transfer',
        section: 'sport',
        'show-fields': 'headline,shortUrl,thumbnail',
        'order-by': 'newest',
        'page-size': 20,
        'api-key': apiKey,
      },
      timeout: 8000,
    });

    const results = response.data?.response?.results || [];
    return results.map(r => ({
      title: r.webTitle,
      source: 'The Guardian',
      url: r.webUrl,
      publishedAt: r.webPublicationDate,
      sport_tag: detectSportTag(r.webTitle, r.fields?.headline || ''),
      description: r.fields?.headline || '',
      thumbnail: r.fields?.thumbnail || null,
    }));
  });
}

// Fetches Kalshi markets from the existing cached route (loopback)
async function getKalshiMarketsForEnrichment() {
  try {
    const port = process.env.PORT || 3001;
    const response = await axios.get(`http://localhost:${port}/api/kalshi/sports-markets`, { timeout: 5000 });
    return response.data.markets || [];
  } catch {
    return [];
  }
}

// GET /api/news
router.get('/', async (req, res) => {
  try {
    const data = await fetchGuardianArticles();
    res.json({ articles: data });
  } catch (err) {
    console.error('News error:', err.message);
    res.json({ articles: getMockNews() });
  }
});

// GET /api/news/enriched — articles cross-referenced with Kalshi markets
router.get('/enriched', async (req, res) => {
  try {
    const data = await withCache('enriched_news', async () => {
      const [articles, markets] = await Promise.all([
        fetchGuardianArticles(),
        getKalshiMarketsForEnrichment(),
      ]);

      return articles.map(article => {
        const match = findMarketMatch(article.title, markets);
        return {
          ...article,
          market_match: match
            ? {
                id: match.id,
                title: match.title,
                yes_price: match.yes_price,
                url: `https://kalshi.com/markets/${match.id}`,
              }
            : null,
        };
      });
    }, 90); // 90s TTL for enriched feed

    res.json({ articles: data });
  } catch (err) {
    console.error('Enriched news error:', err.message);
    res.status(502).json({ error: 'Failed to fetch enriched news', articles: [] });
  }
});

function getMockNews() {
  return [
    { title: 'NBA Free Agency: Top Targets for Every Team This Offseason', source: 'The Guardian', url: '#', publishedAt: new Date().toISOString(), sport_tag: 'NBA', description: 'With free agency opening July 1st, teams are positioning themselves for major moves.' },
    { title: 'F1 Canadian Grand Prix: Verstappen Takes Pole Position', source: 'The Guardian', url: '#', publishedAt: new Date(Date.now() - 3600000).toISOString(), sport_tag: 'F1', description: 'Max Verstappen secures pole ahead of a crucial race weekend.' },
    { title: 'Premier League Transfer Window: Club-by-Club Tracker', source: 'The Guardian', url: '#', publishedAt: new Date(Date.now() - 7200000).toISOString(), sport_tag: 'Soccer', description: 'Summer transfer activity heats up across the Premier League.' },
    { title: 'MLB Power Rankings: Dodgers Lead After Big June', source: 'The Guardian', url: '#', publishedAt: new Date(Date.now() - 10800000).toISOString(), sport_tag: 'MLB', description: 'Los Angeles maintains top position heading into the final stretch.' },
    { title: 'NFL Training Camp: Rookies Making Waves', source: 'The Guardian', url: '#', publishedAt: new Date(Date.now() - 14400000).toISOString(), sport_tag: 'NFL', description: 'Several first-round picks are turning heads early in camp.' },
    { title: 'Wimbledon 2025: Draw Released, Djokovic Eyes Another Title', source: 'The Guardian', url: '#', publishedAt: new Date(Date.now() - 18000000).toISOString(), sport_tag: 'Tennis', description: 'The draw for Wimbledon has been announced ahead of the grass-court major.' },
    { title: 'NBA Draft: Best Prospects Still Available After Round 1', source: 'The Guardian', url: '#', publishedAt: new Date(Date.now() - 21600000).toISOString(), sport_tag: 'NBA', description: "Teams look to the second round for value picks in this year's draft class." },
    { title: 'Soccer: Champions League Final Preview — Tactical Breakdown', source: 'The Guardian', url: '#', publishedAt: new Date(Date.now() - 25200000).toISOString(), sport_tag: 'Soccer', description: "A deep dive into the tactical matchup for this year's UCL final." },
    { title: 'F1: Ferrari Upgrade Package Fails to Deliver in Practice', source: 'The Guardian', url: '#', publishedAt: new Date(Date.now() - 28800000).toISOString(), sport_tag: 'F1', description: "Ferrari's latest aero updates fell short of expectations in Friday sessions." },
    { title: 'MLB: Shohei Ohtani Homers Twice in Dodgers Win', source: 'The Guardian', url: '#', publishedAt: new Date(Date.now() - 32400000).toISOString(), sport_tag: 'MLB', description: 'Ohtani continues historic season with multi-home run performance.' },
    { title: 'NFL: Quarterback Trade Rumors Heating Up Ahead of Season', source: 'The Guardian', url: '#', publishedAt: new Date(Date.now() - 36000000).toISOString(), sport_tag: 'NFL', description: 'Multiple teams exploring trade options at quarterback position.' },
    { title: 'Tennis: Swiatek Cruises to French Open Defense', source: 'The Guardian', url: '#', publishedAt: new Date(Date.now() - 39600000).toISOString(), sport_tag: 'Tennis', description: 'Iga Swiatek dominates clay season en route to defending her Roland Garros title.' },
  ];
}

module.exports = router;
