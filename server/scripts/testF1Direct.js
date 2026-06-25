const BASE = 'https://external-api.kalshi.com/trade-api/v2';

async function main() {
  // Direct F1 test
  console.log('Testing KXF1RACE...');
  const r = await fetch(`${BASE}/markets?series_ticker=KXF1RACE&limit=5`, {
    headers: { Accept: 'application/json' },
  });
  const d = await r.json();
  console.log('Status:', r.status, 'Markets:', (d.markets||[]).length, 'Error:', d.error);
  for (const m of (d.markets||[])) {
    console.log(`  ${m.ticker} | bid=${m.yes_bid_dollars} ask=${m.yes_ask_dollars} last=${m.last_price_dollars} | close=${m.close_time || m.expiration_time}`);
  }

  // Also test without series_ticker
  console.log('\nTesting no filter...');
  const r2 = await fetch(`${BASE}/markets?limit=3`, { headers: { Accept: 'application/json' } });
  const d2 = await r2.json();
  console.log('Status:', r2.status, 'Markets:', (d2.markets||[]).length, 'Error:', d2.error);

  // Test with event_ticker = KXF1RACE-AUTGP26
  console.log('\nTesting event_ticker KXF1RACE-AUTGP26...');
  const r3 = await fetch(`${BASE}/markets?event_ticker=KXF1RACE-AUTGP26&limit=5`, {
    headers: { Accept: 'application/json' },
  });
  const d3 = await r3.json();
  console.log('Status:', r3.status, 'Markets:', (d3.markets||[]).length);
  for (const m of (d3.markets||[])) {
    console.log(`  ${m.ticker} | bid=${m.yes_bid_dollars} ask=${m.yes_ask_dollars} last=${m.last_price_dollars}`);
  }

  // Try event listing for KXF1RACE
  console.log('\nListing events for KXF1RACE...');
  const r4 = await fetch(`${BASE}/events?series_ticker=KXF1RACE&limit=5`, {
    headers: { Accept: 'application/json' },
  });
  const d4 = await r4.json();
  console.log('Status:', r4.status, 'Events:', (d4.events||[]).length);
  for (const e of (d4.events||[]).slice(0, 5)) {
    console.log(`  ${e.event_ticker} | ${e.title||e.sub_title}`);
  }
}

main().catch(console.error);
