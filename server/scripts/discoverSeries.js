#!/usr/bin/env node
// One-off discovery script: finds real Kalshi series tickers and groups them by sport relevance.
// Run: node server/scripts/discoverSeries.js

const BASE = 'https://external-api.kalshi.com/trade-api/v2';

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'SportsPulse/1.0' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function discoverSeries() {
  console.log('=== Discovering Kalshi series list ===\n');

  // 1. Try to get the series list
  let seriesList = [];
  try {
    const data = await fetchJSON(`${BASE}/series`);
    seriesList = data.series || data || [];
    console.log(`Found ${seriesList.length} series from /series endpoint\n`);
    if (seriesList.length > 0) {
      console.log('Sample series fields:', Object.keys(seriesList[0]).join(', '));
      console.log('');
    }
  } catch (e) {
    console.log(`/series failed: ${e.message} — will fall back to market scan\n`);
  }

  // 2. Fetch a large batch of open markets to extract series_tickers
  console.log('=== Fetching open markets (limit 1000) ===\n');
  const allMarkets = [];

  // Paginate through markets
  let cursor = null;
  let page = 0;
  while (page < 5) {
    try {
      let url = `${BASE}/markets?status=open&limit=200`;
      if (cursor) url += `&cursor=${cursor}`;
      const data = await fetchJSON(url);
      const batch = data.markets || [];
      allMarkets.push(...batch);
      cursor = data.cursor;
      console.log(`Page ${page + 1}: got ${batch.length} markets (total: ${allMarkets.length})`);
      if (!cursor || batch.length === 0) break;
      page++;
    } catch (e) {
      console.log(`Page ${page + 1} fetch failed: ${e.message}`);
      break;
    }
  }

  console.log(`\nTotal markets fetched: ${allMarkets.length}\n`);

  // 3. Extract unique series_tickers with sample titles
  const seriesMap = {};
  for (const m of allMarkets) {
    const st = m.series_ticker || m.event_ticker?.split('-')[0] || null;
    const ticker = m.ticker || '';
    const title = m.title || '';
    const eventTicker = m.event_ticker || '';

    // Try to extract series from ticker prefix
    const seriesCandidates = new Set();
    if (st) seriesCandidates.add(st);
    // e.g. KXNBA-25-CHAMP -> KXNBA
    const prefixMatch = ticker.match(/^([A-Z0-9]+)-/);
    if (prefixMatch) seriesCandidates.add(prefixMatch[1]);
    const eventPrefixMatch = eventTicker.match(/^([A-Z0-9]+)-/);
    if (eventPrefixMatch) seriesCandidates.add(eventPrefixMatch[1]);

    for (const s of seriesCandidates) {
      if (!s || s.length < 3) continue;
      if (!seriesMap[s]) seriesMap[s] = { count: 0, samples: [] };
      seriesMap[s].count++;
      if (seriesMap[s].samples.length < 3) seriesMap[s].samples.push(title.slice(0, 80));
    }
  }

  // 4. Print grouped by sport relevance
  const sportKeywords = {
    NBA:    /NBA|basketball|WNBA|lakers|celtics|warriors/i,
    NFL:    /NFL|football|chiefs|cowboys|eagles|superbowl/i,
    MLB:    /MLB|baseball|yankees|dodgers|cubs|world series/i,
    Soccer: /soccer|EPL|premier|FIFA|world cup|UCL|champions|bundesliga|laliga|serie.?a|ligue|MLS|CONCACAF/i,
    F1:     /F1|formula|grand prix|verstappen|ferrari|racing/i,
    Tennis: /tennis|wimbledon|US.?open|french.?open|ATP|WTA|australian/i,
  };

  const grouped = { NBA: [], NFL: [], MLB: [], Soccer: [], F1: [], Tennis: [], Other: [] };

  const sortedSeries = Object.entries(seriesMap).sort((a, b) => b[1].count - a[1].count);

  for (const [ticker, info] of sortedSeries) {
    const combined = ticker + ' ' + info.samples.join(' ');
    let matched = false;
    for (const [sport, re] of Object.entries(sportKeywords)) {
      if (re.test(combined)) {
        grouped[sport].push({ ticker, count: info.count, samples: info.samples });
        matched = true;
        break;
      }
    }
    if (!matched) grouped.Other.push({ ticker, count: info.count, samples: info.samples });
  }

  console.log('=== SERIES BY SPORT ===\n');
  for (const [sport, items] of Object.entries(grouped)) {
    if (items.length === 0) continue;
    console.log(`--- ${sport} (${items.length} series) ---`);
    for (const it of items.slice(0, 20)) {
      console.log(`  ${it.ticker.padEnd(20)} count=${it.count}  samples: ${it.samples.slice(0, 2).join(' | ')}`);
    }
    console.log('');
  }

  // 5. Print raw list of all series tickers for easy copy-paste
  console.log('=== ALL SERIES TICKERS (sorted by market count) ===');
  for (const [ticker, info] of sortedSeries.slice(0, 60)) {
    console.log(`  '${ticker}',  // count=${info.count}  ${info.samples[0]?.slice(0, 60) || ''}`);
  }

  // 6. If /series endpoint returned data, show it
  if (seriesList.length > 0) {
    console.log('\n=== RAW SERIES FROM /series ENDPOINT ===');
    for (const s of seriesList.slice(0, 50)) {
      const ticker = s.ticker || s.series_ticker || JSON.stringify(s).slice(0, 60);
      const title = s.title || s.name || '';
      console.log(`  ${ticker.padEnd(20)} ${title.slice(0, 60)}`);
    }
  }

  return { sortedSeries, grouped };
}

discoverSeries().catch(err => {
  console.error('Discovery failed:', err);
  process.exit(1);
});
