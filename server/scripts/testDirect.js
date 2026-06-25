const BASE = 'https://external-api.kalshi.com/trade-api/v2';

async function get(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
  const d = await r.json();
  return { status: r.status, data: d };
}

async function main() {
  // Test 1: KXF1RACE directly
  console.log('=== KXF1RACE ===');
  const f1 = await get(`${BASE}/markets?series_ticker=KXF1RACE&limit=5`);
  console.log('status:', f1.status, 'markets:', (f1.data.markets || []).length);
  for (const m of (f1.data.markets || [])) {
    console.log(`  ${m.ticker} | yes_bid=${m.yes_bid} last=${m.last_price} | ${(m.title||'').slice(0,70)}`);
  }
  if (f1.data.error) console.log('error:', f1.data.error);

  // Test 2: World Cup markets
  console.log('\n=== KXWCGOAL ===');
  const wc = await get(`${BASE}/markets?series_ticker=KXWCGOAL&limit=5`);
  console.log('status:', wc.status, 'markets:', (wc.data.markets || []).length);
  for (const m of (wc.data.markets || [])) {
    console.log(`  ${m.ticker} | yes_bid=${m.yes_bid} last=${m.last_price} | ${(m.title||'').slice(0,70)}`);
  }

  // Test 3: Browse without any filter to see market shapes
  console.log('\n=== Raw markets (no filter) ===');
  const raw = await get(`${BASE}/markets?limit=10`);
  console.log('status:', raw.status, 'count:', (raw.data.markets || []).length);
  const m0 = (raw.data.markets || [])[0];
  if (m0) {
    console.log('All fields:', Object.keys(m0).join(', '));
    for (const m of (raw.data.markets || [])) {
      console.log(`  series=${m.series_ticker||'n/a'} status=${m.status} yes_bid=${m.yes_bid} last=${m.last_price} | ${(m.title||'').slice(0,60)}`);
    }
  }

  // Test 4: Status=active markets
  console.log('\n=== Status=active markets ===');
  const active = await get(`${BASE}/markets?status=active&limit=10`);
  console.log('status:', active.status, 'count:', (active.data.markets || []).length);
  for (const m of (active.data.markets || [])) {
    console.log(`  series=${m.series_ticker||'n/a'} | ${(m.title||'').slice(0,60)}`);
  }

  // Test 5: Try event-based approach - list events for KXF1RACE
  console.log('\n=== Events for KXF1RACE ===');
  const evts = await get(`${BASE}/events?series_ticker=KXF1RACE&limit=5`);
  console.log('status:', evts.status, 'count:', (evts.data.events || []).length);
  for (const e of (evts.data.events || [])) {
    console.log(`  ${e.event_ticker} | ${(e.title||e.sub_title||'').slice(0,60)}`);
  }
}

main().catch(console.error);
