const express = require('express');
const axios = require('axios');
const { withCache } = require('../middleware/cache');

const router = express.Router();

const ESPN_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Referer': 'https://www.espn.com/',
};

const ESPN_ROUTES = {
  nba:    'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  nfl:    'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  mlb:    'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
  soccer: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard',
};

function parseESPNGames(data) {
  const events = data?.events || [];
  return events.map(event => {
    const comp  = event.competitions?.[0] || {};
    const comps = comp.competitors || [];
    const home  = comps.find(c => c.homeAway === 'home') || comps[0] || {};
    const away  = comps.find(c => c.homeAway === 'away') || comps[1] || {};
    const st    = comp.status?.type || {};
    const state = st.state || 'pre'; // 'pre' | 'in' | 'post'

    const broadcast = comp.broadcasts?.[0]?.names?.[0] || null;
    const clock = event.status?.displayClock || null;
    const period = event.status?.period || null;
    const clockStr = clock && period ? `Q${period} ${clock}` : (clock || null);

    return {
      id:        event.id,
      sport:     null, // filled in caller
      home:      home.team?.displayName || home.team?.name || 'TBD',
      away:      away.team?.displayName || away.team?.name || 'TBD',
      homeLogo:  home.team?.logo || null,
      awayLogo:  away.team?.logo || null,
      homeScore: home.score ?? null,
      awayScore: away.score ?? null,
      status:    state === 'in' ? 'live' : state === 'post' ? 'final' : 'upcoming',
      clock:     clockStr,
      startTime: event.date || null,
      venue:     comp.venue?.fullName || null,
      broadcast,
      isLive:     state === 'in',
      isFinal:    state === 'post',
      isUpcoming: state === 'pre',
      // backward-compat aliases
      home_team:  home.team?.displayName || home.team?.name || 'TBD',
      away_team:  away.team?.displayName || away.team?.name || 'TBD',
      home_score: home.score ?? '0',
      away_score: away.score ?? '0',
      home_logo:  home.team?.logo || null,
      away_logo:  away.team?.logo || null,
      is_live:    state === 'in',
      is_final:   state === 'post',
      start_time: event.date || null,
    };
  });
}

async function fetchESPN(sport) {
  const url = ESPN_ROUTES[sport];
  if (!url) throw new Error(`Unknown sport: ${sport}`);
  const res = await axios.get(url, { headers: ESPN_HEADERS, timeout: 8000 });
  return parseESPNGames(res.data).map(g => ({ ...g, sport }));
}

async function fetchF1() {
  const res = await axios.get('https://api.openf1.org/v1/sessions', {
    params: { year: 2026, session_type: 'Race' },
    timeout: 8000,
  });
  const sessions = res.data || [];
  return sessions.slice(-8).map(s => {
    const now      = Date.now();
    const start    = s.date_start ? new Date(s.date_start).getTime() : null;
    const end      = s.date_end   ? new Date(s.date_end).getTime()   : null;
    const isLive   = !!(start && end && now >= start && now <= end);
    const isFinal  = !!(end && now > end);
    return {
      id:        String(s.session_key),
      sport:     'f1',
      home:      `${s.meeting_name || s.location || s.circuit_short_name || 'Race'} — ${s.session_name || 'Race'}`,
      away:      null,
      homeScore: null,
      awayScore: null,
      status:    isLive ? 'live' : isFinal ? 'final' : 'upcoming',
      clock:     null,
      startTime: s.date_start || null,
      venue:     s.circuit_short_name || s.location || null,
      country:   s.country_name || null,
      broadcast: null,
      isLive,
      isFinal,
      isUpcoming: !isLive && !isFinal,
      // backward-compat
      home_team:  `${s.meeting_name || s.location || s.circuit_short_name || 'Race'} — ${s.session_name || 'Race'}`,
      away_team:  '',
      home_score: '',
      away_score: '',
      home_logo:  null,
      away_logo:  null,
      is_live:    isLive,
      is_final:   isFinal,
      start_time: s.date_start || null,
      name:       `${s.meeting_name || s.location || s.circuit_short_name || 'Race'} — ${s.session_name || 'Race'}`,
      circuit:    s.circuit_short_name || null,
    };
  });
}

async function fetchTennis() {
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const res = await axios.get('https://www.thesportsdb.com/api/v1/json/3/eventsday.php', {
    params: { d: dateStr, s: 'Tennis' },
    timeout: 8000,
  });
  const events = res.data?.events || [];
  return events.slice(0, 12).map(e => {
    const scoreHome = e.intHomeScore != null ? String(e.intHomeScore) : null;
    const scoreAway = e.intAwayScore != null ? String(e.intAwayScore) : null;
    const isFinal   = !!scoreHome && !!scoreAway;
    return {
      id:        String(e.intEventId),
      sport:     'tennis',
      home:      e.strHomeTeam || e.strHome || 'TBD',
      away:      e.strAwayTeam || e.strAway || 'TBD',
      homeScore: scoreHome,
      awayScore: scoreAway,
      status:    isFinal ? 'final' : 'upcoming',
      clock:     null,
      startTime: e.strTime ? `${e.dateEvent}T${e.strTime}:00` : `${e.dateEvent}T12:00:00`,
      venue:     e.strVenue || null,
      broadcast: null,
      isLive:    false,
      isFinal,
      isUpcoming: !isFinal,
      // backward-compat
      home_team:  e.strHomeTeam || e.strHome || 'TBD',
      away_team:  e.strAwayTeam || e.strAway || 'TBD',
      home_score: scoreHome || '0',
      away_score: scoreAway || '0',
      home_logo:  null,
      away_logo:  null,
      is_live:    false,
      is_final:   isFinal,
      start_time: e.strTime ? `${e.dateEvent}T${e.strTime}:00` : null,
    };
  });
}

router.get('/:sport', async (req, res) => {
  const sport = req.params.sport.toLowerCase();

  try {
    const games = await withCache(`scores_${sport}`, async () => {
      if (sport === 'f1')     return fetchF1();
      if (sport === 'tennis') return fetchTennis();
      return fetchESPN(sport);
    });

    const live     = games.filter(g => g.isLive || g.is_live);
    const upcoming = games.filter(g => g.isUpcoming || (!g.is_live && !g.is_final)).sort((a, b) => new Date(a.startTime || a.start_time) - new Date(b.startTime || b.start_time));
    const final    = games.filter(g => g.isFinal || g.is_final);

    res.json({ sport, games, live, upcoming, final });
  } catch (err) {
    console.error(`Scores error [${sport}]:`, err.message);
    res.status(502).json({ error: `Failed to fetch ${sport} scores`, sport, games: [], live: [], upcoming: [], final: [] });
  }
});

module.exports = router;
