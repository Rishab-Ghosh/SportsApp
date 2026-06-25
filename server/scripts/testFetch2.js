// Debug fetch for Soccer and F1
const BASE = 'https://external-api.kalshi.com/trade-api/v2';

async function fetchSeries(ticker) {
  const r = await fetch(`${BASE}/markets?series_ticker=${ticker}&limit=10`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  const d = await r.json();
  return d.markets || [];
}

function normalize(m, sport) {
  const yesBid    = m.yes_bid_dollars   != null ? Math.round(m.yes_bid_dollars   * 100) : null;
  const yesAsk    = m.yes_ask_dollars   != null ? Math.round(m.yes_ask_dollars   * 100) : null;
  const lastPrice = m.last_price_dollars != null ? Math.round(m.last_price_dollars * 100) : null;
  const prevPrice = m.previous_price_dollars != null ? Math.round(m.previous_price_dollars * 100) : null;

  const yesPrice = (yesBid > 0 ? yesBid : null)
                ?? (lastPrice > 0 ? lastPrice : null)
                ?? (yesAsk > 0 ? yesAsk : null)
                ?? null;

  const now = Date.now();
  const closeTs = m.expiration_time || m.close_time;
  const notExpired = !closeTs || new Date(closeTs).getTime() > now;

  return {
    ticker: m.ticker,
    title: m.title,
    yes_price: yesPrice,
    yesBid, yesAsk, lastPrice, prevPrice,
    status: m.status,
    close_time: closeTs,
    notExpired,
    passesFilter: yesPrice != null && yesPrice < 100 && m.title && notExpired,
  };
}

async function checkSeries(sport, tickers) {
  console.log(`\n=== ${sport} ===`);
  for (const ticker of tickers.slice(0, 5)) {
    const markets = await fetchSeries(ticker);
    const normalized = markets.map(m => normalize(m, sport));
    const passing = normalized.filter(m => m.passesFilter);
    console.log(`  ${ticker.padEnd(20)} raw=${markets.length} passing=${passing.length}`);
    for (const m of normalized.slice(0, 2)) {
      console.log(`    bid=${m.yesBid} ask=${m.yesAsk} last=${m.lastPrice} => price=${m.yes_price} expired=${!m.notExpired} passes=${m.passesFilter}`);
      console.log(`    title="${(m.title||'').slice(0,60)}"`);
    }
  }
}

async function main() {
  await checkSeries('Soccer', ['KXWCGOAL', 'KXWCMOV', 'KXFIFATOTAL', 'KXMLSGAME', 'KXCLUBWCGF']);
  await checkSeries('F1',     ['KXF1RACE', 'KXF1QUALIFY', 'KXF1RACEPODIUM', 'KXF1H2H', 'KXF1POLE']);
  await checkSeries('Tennis', ['KXWTAGAME', 'KXATPGSPREAD', 'KXCHALLENGERMATCH', 'KXWTATOURNWIN', 'KXATPIT']);
}

main().catch(console.error);
