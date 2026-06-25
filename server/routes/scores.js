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
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  mlb: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
};

// Soccer leagues — merged for coverage. fifa.world = Men's World Cup.
const SOCCER_LEAGUES = [
  'fifa.world',      // FIFA World Cup (2026 — LIVE NOW)
  'fifa.wwc',        // FIFA Women's World Cup
  'usa.1',           // MLS
  'uefa.champions',  // UEFA Champions League
  'eng.1',           // Premier League
  'esp.1',           // La Liga
  'ger.1',           // Bundesliga
  'ita.1',           // Serie A
  'fra.1',           // Ligue 1
];

function parseESPNGames(data, sport) {
  const events = data?.events || [];
  return events.map(event => {
    const comp  = event.competitions?.[0] || {};
    const comps = comp.competitors || [];
    const home  = comps.find(c => c.homeAway === 'home') || comps[0] || {};
    const away  = comps.find(c => c.homeAway === 'away') || comps[1] || {};
    const st    = comp.status?.type || {};
    const state = st.state || 'pre';

    const broadcast = comp.broadcasts?.[0]?.names?.[0] || null;
    const clock = event.status?.displayClock || null;
    const period = event.status?.period || null;
    const clockStr = clock && period ? (sport === 'soccer' ? `${period}' ${clock}` : `Q${period} ${clock}`) : (clock || null);

    return {
      id:        event.id,
      sport,
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
  return parseESPNGames(res.data, sport);
}

async function fetchSoccer() {
  // Fetch all leagues in parallel, merge and dedupe
  const results = await Promise.allSettled(
    SOCCER_LEAGUES.map(league =>
      axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard`,
        { headers: ESPN_HEADERS, timeout: 8000 }
      ).then(r => parseESPNGames(r.data, 'soccer'))
    )
  );

  const seen = new Set();
  const games = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const g of r.value) {
      if (!seen.has(g.id)) {
        seen.add(g.id);
        games.push(g);
      }
    }
  }
  return games;
}

// ESPN tennis has a groupings→competitions structure (different from team sports)
function parseTennisFromESPN(data, tour) {
  const matches = [];
  for (const ev of data.events || []) {
    const tournamentName = ev.name || '';
    for (const grouping of ev.groupings || []) {
      const groupName = grouping.grouping?.displayName || '';
      // Skip doubles — only singles markets exist on Kalshi
      if (/doubles/i.test(groupName)) continue;
      for (const comp of grouping.competitions || []) {
        const competitors = comp.competitors || [];
        if (competitors.length < 2) continue;
        const [c1, c2] = competitors;
        const athleteName = (c) => c.athlete?.displayName || c.athlete?.shortName || null;
        const p1 = athleteName(c1), p2 = athleteName(c2);
        if (!p1 || !p2) continue;
        const setScore = (c) => (c.linescores || []).map(ls => Math.round(ls.value ?? 0)).join(' ');
        const state    = comp.status?.type?.state || 'pre';
        const isLive   = state === 'in';
        const isFinal  = state === 'post';
        matches.push({
          id:        comp.id || `${tournamentName}-${p1}-${p2}`,
          sport:     'Tennis',
          tour,
          tournament: tournamentName,
          group:     groupName,
          player1:   p1, player2:   p2,
          score1:    setScore(c1), score2: setScore(c2),
          status:    comp.status?.type?.description || (isLive ? 'In Progress' : isFinal ? 'Final' : 'Scheduled'),
          state,
          startTime: comp.date || comp.startDate || ev.date || null,
          winner:    c1.winner ? 1 : c2.winner ? 2 : null,
          venue:     comp.venue?.fullName || null,
          // backwards-compat fields for existing ScoreCard
          home: p1, away: p2,
          homeScore: setScore(c1), awayScore: setScore(c2),
          isLive, isFinal, isUpcoming: !isLive && !isFinal,
          home_team: p1, away_team: p2,
          home_score: setScore(c1), away_score: setScore(c2),
          home_logo: c1.athlete?.headshot?.href || null,
          away_logo: c2.athlete?.headshot?.href || null,
          is_live: isLive, is_final: isFinal,
          start_time: comp.date || comp.startDate || ev.date || null,
        });
      }
    }
  }
  return matches;
}

async function fetchTennis() {
  try {
    // ATP endpoint has all singles (ATP + WTA tournaments appear here)
    const r = await axios.get(
      'https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard',
      { headers: ESPN_HEADERS, timeout: 8000 }
    );
    const matches = parseTennisFromESPN(r.data, 'ATP');
    if (matches.length > 0) {
      console.log(`[tennis] ESPN ATP: ${matches.length} matches (live: ${matches.filter(m => m.isLive).length})`);
      return matches;
    }
  } catch (e) {
    console.warn('[tennis] ATP fetch failed:', e.message);
  }

  // Fallback: generic tennis scoreboard
  try {
    const r = await axios.get(
      'https://site.api.espn.com/apis/site/v2/sports/tennis/scoreboard',
      { headers: ESPN_HEADERS, timeout: 8000 }
    );
    const matches = parseTennisFromESPN(r.data, 'ATP');
    if (matches.length > 0) return matches;
  } catch { /* ignore */ }

  console.warn('[tennis] All ESPN tennis endpoints returned 0 matches');
  return [];
}

async function fetchF1() {
  const res = await axios.get('https://api.openf1.org/v1/sessions', {
    params: { year: 2026, session_type: 'Race' },
    timeout: 8000,
  });
  const sessions = res.data || [];
  const now = Date.now();

  return sessions.slice(-10).map(s => {
    const start   = s.date_start ? new Date(s.date_start).getTime() : null;
    const end     = s.date_end   ? new Date(s.date_end).getTime()   : null;
    const isLive  = !!(start && end && now >= start && now <= end);
    const isFinal = !!(end && now > end);
    const sessionName = `${s.meeting_name || s.location || s.circuit_short_name || 'Race'} — ${s.session_name || 'Race'}`;

    return {
      id:        String(s.session_key),
      sport:     'f1',
      home:      sessionName,
      away:      null,
      homeScore: null,
      awayScore: null,
      status:    isLive ? 'live' : isFinal ? 'final' : 'upcoming',
      isLiveSession: isLive, // flag for UI LIVE badge
      clock:     null,
      startTime: s.date_start || null,
      venue:     s.circuit_short_name || s.location || null,
      country:   s.country_name || null,
      broadcast: null,
      isLive,
      isFinal,
      isUpcoming: !isLive && !isFinal,
      home_team:  sessionName,
      away_team:  '',
      home_score: '',
      away_score: '',
      home_logo:  null,
      away_logo:  null,
      is_live:    isLive,
      is_final:   isFinal,
      start_time: s.date_start || null,
      name:       sessionName,
      circuit:    s.circuit_short_name || null,
    };
  });
}

router.get('/:sport', async (req, res) => {
  const sport = req.params.sport.toLowerCase();

  try {
    const games = await withCache(`scores_${sport}`, async () => {
      if (sport === 'f1')     return fetchF1();
      if (sport === 'tennis') return fetchTennis();
      if (sport === 'soccer') return fetchSoccer();
      return fetchESPN(sport);
    }, 60);

    const live     = games.filter(g => g.isLive || g.is_live);
    const upcoming = games
      .filter(g => g.isUpcoming || (!g.is_live && !g.is_final))
      .sort((a, b) => new Date(a.startTime || a.start_time) - new Date(b.startTime || b.start_time));
    const final = games.filter(g => g.isFinal || g.is_final);

    res.json({ sport, games, live, upcoming, final });
  } catch (err) {
    console.error(`Scores error [${sport}]:`, err.message);
    res.status(502).json({ error: `Failed to fetch ${sport} scores`, sport, games: [], live: [], upcoming: [], final: [] });
  }
});

module.exports = router;
