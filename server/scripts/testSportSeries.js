const BASE = 'https://external-api.kalshi.com/trade-api/v2';

async function fetchMarkets(seriesTicker) {
  try {
    const url = `${BASE}/markets?series_ticker=${seriesTicker}&limit=3`;
    const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    const d = await r.json();
    const markets = d.markets || [];
    return { count: markets.length, sample: (markets[0]?.title || '').slice(0, 70), yesPrice: markets[0]?.yes_bid ?? markets[0]?.last_price };
  } catch(e) {
    return { count: 0, sample: `err: ${e.message}` };
  }
}

const CANDIDATE_TICKERS = {
  NBA: [
    'KXNBA1HTOTAL', 'KXNBA2HSPREAD', 'KXNBA3D', 'KXNBA2QWINNER',
    'KXNBAMVPDPOY', 'KXNBATOPPICK', 'KXNBAFINALSMENTION',
    'KXTEAMSINWF', 'KXNBACUPMVP', 'KXWNBA', 'KXWNBAFINAL',
    'KXUNRIVALEDGAME', 'KXNBASERIESCOMEBACK', 'KXNBARA',
  ],
  NFL: [
    'KXNFLWINS', 'KXNFL1HSPREAD', 'KXNFL2HWINNER', 'KXTEAMSINB',
    'KXNFLAFCCHAMP', 'KXNFLNFCEAST', 'KXNFLAFCEAST',
    'KXNFLHIGHSCOREQ', 'KXUFLCHAMP', 'KXNFLPROOTY',
  ],
  MLB: [
    'KXMLBSERIES', 'KXMLBDIVWINNER', 'KXMLBRBI', 'KXMLBEXTRAS',
    'KXTEAMSINWS', 'KXMLBALEAST', 'KXMLBNLCENT', 'KXMLBNLWEST',
    'KXMLB500', 'KXLEADERMLBHR', 'KXLEADERMLBWINS', 'KXLEADERMLBERA',
    'KXMLBAWARDCOMBO', 'KXMLBTEAMSTAT', 'KXMLBNLMVP',
  ],
  Soccer: [
    'KXWCGOAL', 'KXWCMOV', 'KXWCKOPENALTIES', 'KXWCVIEWERSHIP',
    'KXFIFATOTAL', 'KXCLUBWCGF', 'KXUEL1H',
    'KXMLSGAME', 'KXMLSADVANCE', 'KXINTLFRIENDLYSPREAD', 'KXINTLFRIENDLYTOTAL',
    'KXEREDIVISIESPREAD', 'KXLIGUE1RELEGATION', 'KXEFLCHAMPIONSHIPGAME',
    'KXEFLCHAMPIONSHIPTOTAL', 'KXAFCACGAME', 'KXALEAGUEGAME',
    'KXCOPPAITALIA', 'KXCHNSL', 'KXPERLIGA1', 'KXUPLTEAMTOTAL',
  ],
  F1: [
    'KXF1RACE', 'KXF1QUALIFY', 'KXF1RACEPODIUM', 'KXF1POLE',
    'KXF1H2H', 'KXF1TOP5', 'KXF1TOP10', 'KXF1FASTESTLAP',
    'KXF1RACESPRINT', 'KXF1OCCUR', 'KXF1CONSTRUCTORS', 'KXF1TOPCONSTRUCTOR',
  ],
  Tennis: [
    'KXWTAGAME', 'KXATPGSPREAD', 'KXATPIWO', 'KXATPFINALS',
    'KXATPNEXTGEN', 'KXATPFINALSQUAL', 'KXCHALLENGERMATCH',
    'KXITFWMATCH', 'KXEXHIBITIONMEN', 'KXDDFMENSINGLES', 'KXDDFWOMENSINGLES',
    'KXWTATOURNWIN', 'KXMCMEN', 'KXATPMAD', 'KXATPIT',
  ],
};

async function main() {
  console.log('Testing sport series tickers for open markets...\n');

  for (const [sport, tickers] of Object.entries(CANDIDATE_TICKERS)) {
    console.log(`=== ${sport} ===`);
    const results = await Promise.all(tickers.map(async t => ({ t, ...(await fetchMarkets(t)) })));
    const withMarkets = results.filter(r => r.count > 0).sort((a,b) => b.count - a.count);
    if (withMarkets.length === 0) {
      console.log('  (no open markets found for any series)\n');
    } else {
      for (const r of withMarkets) {
        console.log(`  ${r.t.padEnd(24)} count=${r.count}  yes=${r.yesPrice ?? 'n/a'}  "${r.sample}"`);
      }
      console.log('');
    }
  }
}

main().catch(console.error);
