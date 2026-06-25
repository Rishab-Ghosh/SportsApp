// Quick test of the kalshiSeries module
const { getAllSportsMarkets } = require('../lib/kalshiSeries');

async function main() {
  console.log('Fetching all sports markets...');
  const data = await getAllSportsMarkets();
  for (const [sport, markets] of Object.entries(data)) {
    console.log(`${sport}: ${markets.length} markets`);
    if (markets.length > 0) {
      const m = markets[0];
      console.log(`  Sample: "${m.title.slice(0,60)}" yes_price=${m.yes_price} volume=${m.volume}`);
    }
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
