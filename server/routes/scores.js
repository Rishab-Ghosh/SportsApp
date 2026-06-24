const express = require('express');
const axios = require('axios');
const { withCache } = require('../middleware/cache');

const router = express.Router();

const ESPN_ROUTES = {
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  mlb: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
  soccer: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard',
};

function cleanESPNGames(data) {
  const events = data?.events || [];
  return events.map(event => {
    const competition = event.competitions?.[0] || {};
    const competitors = competition.competitors || [];
    const home = competitors.find(c => c.homeAway === 'home') || competitors[0] || {};
    const away = competitors.find(c => c.homeAway === 'away') || competitors[1] || {};
    const status = event.status?.type || {};

    return {
      id: event.id,
      name: event.name,
      home_team: home.team?.displayName || home.team?.name || 'TBD',
      home_score: home.score || '0',
      home_logo: home.team?.logo || null,
      away_team: away.team?.displayName || away.team?.name || 'TBD',
      away_score: away.score || '0',
      away_logo: away.team?.logo || null,
      status: status.description || status.name || 'Scheduled',
      is_live: status.state === 'in',
      is_final: status.completed === true,
      start_time: event.date,
      venue: competition.venue?.fullName || null,
    };
  });
}

async function cleanF1Sessions() {
  const response = await axios.get('https://api.openf1.org/v1/sessions', {
    params: { year: 2025, session_type: 'Race' },
    timeout: 8000,
  });
  const sessions = response.data || [];
  return sessions.slice(-5).map(s => ({
    id: s.session_key,
    name: `${s.meeting_name} — ${s.session_name}`,
    home_team: 'Race',
    home_score: '',
    away_team: '',
    away_score: '',
    status: s.date_end && new Date(s.date_end) < new Date() ? 'Final' : 'Scheduled',
    is_live: s.date_start && s.date_end && new Date(s.date_start) < new Date() && new Date(s.date_end) > new Date(),
    is_final: s.date_end && new Date(s.date_end) < new Date(),
    start_time: s.date_start,
    venue: s.circuit_short_name || s.location || null,
    circuit: s.circuit_short_name || null,
    country: s.country_name || null,
  }));
}

router.get('/:sport', async (req, res) => {
  const sport = req.params.sport.toLowerCase();

  try {
    const data = await withCache(`scores_${sport}`, async () => {
      if (sport === 'f1') return cleanF1Sessions();

      const url = ESPN_ROUTES[sport];
      if (!url) throw new Error(`Unknown sport: ${sport}`);

      const response = await axios.get(url, { timeout: 8000 });
      return cleanESPNGames(response.data);
    });

    res.json({ games: data, sport });
  } catch (err) {
    console.error(`Scores error [${sport}]:`, err.message);
    res.status(502).json({ error: `Failed to fetch ${sport} scores`, games: [], sport });
  }
});

module.exports = router;
