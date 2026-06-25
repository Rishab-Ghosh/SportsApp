#!/usr/bin/env node
// More thorough: search series by category/tag and fetch from sport-specific series tickers.

const BASE = 'https://external-api.kalshi.com/trade-api/v2';

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'SportsPulse/1.0' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} for ${url}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchAllSeries() {
  // Paginate through all series
  const allSeries = [];
  let cursor = null;
  let page = 0;
  while (page < 60) { // 60 pages * 200 = 12000 max
    try {
      let url = `${BASE}/series?limit=200`;
      if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
      const data = await fetchJSON(url);
      const batch = data.series || [];
      allSeries.push(...batch);
      cursor = data.cursor;
      if (page % 10 === 0) process.stderr.write(`page ${page+1}, total ${allSeries.length}\n`);
      if (!cursor || batch.length === 0) break;
      page++;
    } catch (e) {
      process.stderr.write(`series page ${page+1} failed: ${e.message}\n`);
      break;
    }
  }
  return allSeries;
}

async function testSeriesTicker(ticker) {
  try {
    const url = `${BASE}/markets?series_ticker=${ticker}&status=open&limit=5`;
    const data = await fetchJSON(url);
    const markets = data.markets || [];
    return { count: markets.length, sample: markets[0]?.title || '' };
  } catch (e) {
    return { count: 0, sample: `error: ${e.message}` };
  }
}

async function main() {
  console.log('Fetching ALL Kalshi series... (may take 30s)');
  const allSeries = await fetchAllSeries();
  console.log(`Total series: ${allSeries.length}\n`);

  // Filter by sport-related tags/titles
  const sportPatterns = {
    NBA:    /\bnba\b|basketball|wnba|pro.?basket/i,
    NFL:    /\bnfl\b|football|super.?bowl|nfl.?game/i,
    MLB:    /\bmlb\b|baseball|world.?series/i,
    Soccer: /soccer|epl|premier.?league|champions.?league|bundesliga|la.?liga|serie.?a|ligue|world.?cup|fifa|mls|concacaf|copa|eredivisie/i,
    F1:     /formula.?1|\bf1\b|grand.?prix|formula.?one/i,
    Tennis: /tennis|wimbledon|us.?open|french.?open|australian.?open|atp|wta|roland.?garros/i,
  };

  const grouped = { NBA: [], NFL: [], MLB: [], Soccer: [], F1: [], Tennis: [], Other: [] };

  for (const s of allSeries) {
    const text = (s.ticker || '') + ' ' + (s.title || '') + ' ' + (s.category || '') + ' ' + (s.tags || []).join(' ');
    let matched = false;
    for (const [sport, re] of Object.entries(sportPatterns)) {
      if (re.test(text)) {
        grouped[sport].push({ ticker: s.ticker, title: s.title || '', category: s.category || '' });
        matched = true;
        break;
      }
    }
    // Only log unusual category ones to Other
    if (!matched && s.category && /sport/i.test(s.category)) {
      grouped.Other.push({ ticker: s.ticker, title: s.title || '', category: s.category });
    }
  }

  // Print sport series
  for (const [sport, items] of Object.entries(grouped)) {
    if (items.length === 0) continue;
    console.log(`\n=== ${sport} (${items.length} series) ===`);
    for (const it of items.slice(0, 30)) {
      console.log(`  ${it.ticker.padEnd(28)} ${it.title.slice(0, 60)}`);
    }
  }

  // Now test a subset of the sport-specific tickers to see which have open markets
  console.log('\n\n=== TESTING SPORT TICKERS FOR OPEN MARKETS ===\n');
  const sportTickers = [];
  for (const [sport, items] of Object.entries(grouped)) {
    if (sport === 'Other') continue;
    for (const it of items) sportTickers.push({ sport, ticker: it.ticker, title: it.title });
  }

  // Batch test (10 at a time to avoid rate limits)
  const tested = [];
  for (let i = 0; i < sportTickers.length && i < 100; i += 10) {
    const batch = sportTickers.slice(i, i + 10);
    const results = await Promise.all(batch.map(async (it) => {
      const r = await testSeriesTicker(it.ticker);
      return { ...it, openCount: r.count, sample: r.sample };
    }));
    tested.push(...results);
    process.stderr.write(`tested ${Math.min(i + 10, sportTickers.length)}/${Math.min(sportTickers.length, 100)}\n`);
  }

  // Show tickers with open markets
  const withMarkets = tested.filter(t => t.openCount > 0).sort((a, b) => b.openCount - a.openCount);
  console.log(`\nTickers with open markets (${withMarkets.length} found):\n`);
  for (const t of withMarkets) {
    console.log(`  [${t.sport.padEnd(6)}] ${t.ticker.padEnd(28)} open=${t.openCount}  "${t.sample.slice(0, 60)}"`);
  }

  // Print final SPORT_SERIES mapping
  console.log('\n\n=== SUGGESTED SPORT_SERIES MAPPING ===\n');
  const bySprt = {};
  for (const t of withMarkets) {
    if (!bySprt[t.sport]) bySprt[t.sport] = [];
    bySprt[t.sport].push(t.ticker);
  }
  console.log('const SPORT_SERIES = {');
  for (const [sport, tickers] of Object.entries(bySprt)) {
    console.log(`  ${sport}: ${JSON.stringify(tickers)},`);
  }
  console.log('};');
}

main().catch(err => { console.error(err); process.exit(1); });
