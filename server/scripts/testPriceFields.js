const BASE = 'https://external-api.kalshi.com/trade-api/v2';

async function main() {
  // Get F1 race markets and show all price fields
  const r = await fetch(`${BASE}/markets?series_ticker=KXF1RACE&limit=3`, {
    headers: { Accept: 'application/json' }
  });
  const d = await r.json();
  const markets = d.markets || [];

  console.log('=== F1 RACE MARKETS - ALL PRICE FIELDS ===');
  for (const m of markets) {
    console.log(`\n${m.ticker}`);
    console.log(`  title: ${m.title}`);
    console.log(`  status: ${m.status}`);
    console.log(`  yes_bid_dollars: ${m.yes_bid_dollars}`);
    console.log(`  yes_ask_dollars: ${m.yes_ask_dollars}`);
    console.log(`  no_bid_dollars: ${m.no_bid_dollars}`);
    console.log(`  no_ask_dollars: ${m.no_ask_dollars}`);
    console.log(`  last_price_dollars: ${m.last_price_dollars}`);
    console.log(`  previous_price_dollars: ${m.previous_price_dollars}`);
    console.log(`  previous_yes_ask_dollars: ${m.previous_yes_ask_dollars}`);
    console.log(`  previous_yes_bid_dollars: ${m.previous_yes_bid_dollars}`);
    console.log(`  volume_fp: ${m.volume_fp}`);
    console.log(`  open_interest_fp: ${m.open_interest_fp}`);
    console.log(`  liquidity_dollars: ${m.liquidity_dollars}`);
    console.log(`  close_time: ${m.close_time}`);
    console.log(`  expiration_time: ${m.expiration_time}`);
  }

  // Now World Cup goal markets
  console.log('\n=== WORLD CUP GOAL MARKETS ===');
  const r2 = await fetch(`${BASE}/markets?series_ticker=KXWCGOAL&limit=3`, {
    headers: { Accept: 'application/json' }
  });
  const d2 = await r2.json();
  for (const m of (d2.markets || [])) {
    console.log(`\n${m.ticker}`);
    console.log(`  title: ${m.title}`);
    console.log(`  yes_bid_dollars: ${m.yes_bid_dollars}`);
    console.log(`  yes_ask_dollars: ${m.yes_ask_dollars}`);
    console.log(`  last_price_dollars: ${m.last_price_dollars}`);
    console.log(`  previous_price_dollars: ${m.previous_price_dollars}`);
    console.log(`  volume_fp: ${m.volume_fp}`);
  }

  // MLB series
  console.log('\n=== MLB SERIES MARKETS ===');
  const r3 = await fetch(`${BASE}/markets?series_ticker=KXMLBSERIES&limit=3`, {
    headers: { Accept: 'application/json' }
  });
  const d3 = await r3.json();
  for (const m of (d3.markets || [])) {
    console.log(`\n${m.ticker}`);
    console.log(`  title: ${m.title}`);
    console.log(`  yes_bid_dollars: ${m.yes_bid_dollars}`);
    console.log(`  yes_ask_dollars: ${m.yes_ask_dollars}`);
    console.log(`  last_price_dollars: ${m.last_price_dollars}`);
    console.log(`  volume_fp: ${m.volume_fp}`);
  }
}

main().catch(console.error);
