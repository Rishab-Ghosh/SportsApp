const BASE = 'https://external-api.kalshi.com/trade-api/v2';

const tickers = [
  'KXWTAGAME', 'KXCHALLENGERMATCH', 'KXITFWMATCH', 'KXWTATOURNWIN',
  'KXATPFINALS', 'KXATPIT', 'KXATPIWO', 'KXATPNEXTGEN', 'KXATPGSPREAD',
  'KXMCMEN', 'KXATPMAD', 'KXDDFMENSINGLES', 'KXDDFWOMENSINGLES',
  'KXEXHIBITIONMEN', 'KXATPFINALSQUAL', 'KXGRANDSLAMJFONSECA',
  // Wimbledon-specific?
  'KXWIMBLEDON', 'KXWIMMENSINGLES', 'KXWIMWOMENSINGLES',
];

async function main() {
  for (const t of tickers) {
    const r = await fetch(`${BASE}/markets?series_ticker=${t}&limit=2`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    const d = await r.json();
    const ms = d.markets || [];
    if (ms.length > 0) {
      console.log(`${t.padEnd(24)} count=${ms.length}  bid=${ms[0].yes_bid_dollars}  last=${ms[0].last_price_dollars}  "${(ms[0].title||'').slice(0,60)}"`);
    } else {
      console.log(`${t.padEnd(24)} 0 markets`);
    }
    await new Promise(r => setTimeout(r, 50));
  }
}

main().catch(console.error);
