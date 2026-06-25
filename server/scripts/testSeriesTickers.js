const BASE = 'https://external-api.kalshi.com/trade-api/v2';

async function test() {
  const tests = ['KXF1RACE', 'KXNBA1HTOTAL', 'KXWTAGAME', 'KXMLBSERIES', 'KXNFLWINS', 'KXWCGOAL', 'KXWCMOV'];

  for (const ticker of tests) {
    try {
      // Try with and without status filter
      const url = `${BASE}/markets?series_ticker=${ticker}&limit=3`;
      const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
      const d = await r.json();
      const markets = d.markets || [];
      console.log(`${ticker.padEnd(20)} status=${r.status} count=${markets.length}  "${(markets[0]?.title || d.error || JSON.stringify(d)).slice(0,70)}"`);
    } catch(e) {
      console.log(`${ticker.padEnd(20)} ERROR: ${e.message}`);
    }
  }

  // Also fetch raw markets to see all fields
  console.log('\n--- Raw market fields ---');
  const url2 = `${BASE}/markets?limit=5`;
  const r2 = await fetch(url2, { headers: { Accept: 'application/json' } });
  const d2 = await r2.json();
  const m = d2.markets || [];
  if (m[0]) console.log('Fields:', Object.keys(m[0]).join(', '));
  for (const mkt of m.slice(0, 5)) {
    console.log(`  ticker=${mkt.ticker}  event=${mkt.event_ticker}  series=${mkt.series_ticker}  title="${(mkt.title||'').slice(0,60)}"`);
  }

  // Check what the current open markets look like (with status=open)
  console.log('\n--- Open markets (status=open) ---');
  const r3 = await fetch(`${BASE}/markets?status=open&limit=10`, { headers: { Accept: 'application/json' } });
  const d3 = await r3.json();
  const m3 = d3.markets || [];
  for (const mkt of m3.slice(0, 10)) {
    console.log(`  series=${mkt.series_ticker || 'n/a'}  title="${(mkt.title||'').slice(0,70)}"`);
  }
}

test().catch(console.error);
