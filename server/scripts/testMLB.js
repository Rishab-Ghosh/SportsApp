const BASE = 'https://external-api.kalshi.com/trade-api/v2';
const tickers = ['KXMLBSERIES', 'KXMLBRBI', 'KXTEAMSINWS', 'KXMLBDIVWINNER', 'KXLEADERMLBHR', 'KXLEADERMLBWINS', 'KXMLB500', 'KXMLBTEAMSTAT'];

async function main() {
  for (const t of tickers) {
    const r = await fetch(`${BASE}/markets?series_ticker=${t}&limit=3`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    const d = await r.json();
    const ms = d.markets || [];
    console.log(`${t.padEnd(20)} count=${ms.length} status=${r.status}${ms[0] ? `  bid=${ms[0].yes_bid_dollars} last=${ms[0].last_price_dollars} "${(ms[0].title||'').slice(0,50)}"` : ''}`);
    await new Promise(r => setTimeout(r, 200));
  }
}

main().catch(console.error);
