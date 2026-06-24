const express = require('express');
const axios = require('axios');
const { withCache } = require('../middleware/cache');

const router = express.Router();

const SPORTS = ['NBA', 'NFL', 'MLB', 'Soccer', 'F1', 'Tennis'];

function getSeasonalBaseline(sport) {
  const now = new Date();
  const month = now.getMonth() + 1; // 1–12
  const day = now.getDate();
  const md = month * 100 + day; // e.g., 625 = June 25

  switch (sport) {
    case 'NBA':
      if (md >= 625 && md <= 720) return 96;  // Free Agency
      if (md >= 201 && md <= 206) return 98;  // Trade Deadline
      if (month >= 10 || month <= 4) return 72; // Regular season Oct–Apr
      return 40;

    case 'NFL':
      if (md >= 310 && md <= 320) return 88;  // Free Agency
      if (md >= 424 && md <= 426) return 85;  // Draft
      if (month >= 9 || month <= 1) return 78; // Season Sep–Jan
      return 35;

    case 'MLB':
      if (md >= 725 && md <= 801) return 88;  // Trade Deadline
      if (month === 10) return 82;             // Playoffs
      if (month >= 4 && month <= 9) return 60; // Season Apr–Sep
      return 30;

    case 'Soccer':
      if (md >= 610 && md <= 831) return 90;  // Summer window
      if (month === 1) return 82;              // Winter window
      return 45;

    case 'F1':
      if (md >= 1001 && md <= 1215) return 72; // Silly season
      if (month >= 3 && month <= 11) return 58; // Race season Mar–Nov
      return 30;

    case 'Tennis':
      if (month === 1) return 75;                        // Australian Open
      if (md >= 501 && md <= 631) return 75;             // Roland Garros (May–Jun)
      if (md >= 627 && md <= 715) return 75;             // Wimbledon (Jun–Jul)
      if (md >= 826 && md <= 908) return 75;             // US Open (Aug–Sep)
      return 40;

    default:
      return 50;
  }
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

// GET /api/heat-scores
router.get('/', async (req, res) => {
  try {
    const scores = await withCache('heat_scores', async () => {
      const markets = await getKalshiMarkets();

      // Sum volume per sport tag
      const sportVolumes = {};
      for (const sport of SPORTS) sportVolumes[sport] = 0;

      for (const m of markets) {
        const tag = m.sport_tag;
        if (sportVolumes[tag] !== undefined) {
          sportVolumes[tag] += m.volume || 0;
        }
      }

      const volumes = Object.values(sportVolumes);
      const sorted = [...volumes].sort((a, b) => a - b);
      const low = sorted[Math.floor(sorted.length / 3)];
      const high = sorted[Math.floor((sorted.length * 2) / 3)];

      const result = {};
      for (const sport of SPORTS) {
        const baseline = getSeasonalBaseline(sport);
        const vol = sportVolumes[sport] || 0;

        let multiplier = 1.0;
        if (vol >= high) multiplier = 1.15;
        else if (vol <= low) multiplier = 0.90;

        result[sport] = Math.min(100, Math.round(baseline * multiplier));
      }

      return result;
    });

    res.json(scores);
  } catch (err) {
    console.error('Heat scores error:', err.message);
    // Fall back to seasonal baselines only
    const fallback = {};
    for (const sport of SPORTS) fallback[sport] = getSeasonalBaseline(sport);
    res.json(fallback);
  }
});

module.exports = router;
