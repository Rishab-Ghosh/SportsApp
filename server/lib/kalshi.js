const forge = require('node-forge');
const axios = require('axios');

const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

function signRequest(method, path, timestampMs, privateKeyPem) {
  const message = `${timestampMs}${method}/trade-api/v2${path}`;
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
  const md = forge.md.sha256.create();
  md.update(message, 'utf8');
  const signature = privateKey.sign(md, 'RSASSA-PSS');
  return forge.util.encode64(signature);
}

async function kalshiGet(path) {
  const keyId = process.env.KALSHI_API_KEY_ID;
  const privateKeyPem = (process.env.KALSHI_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  const url = `${KALSHI_BASE}${path}`;

  if (!keyId || !privateKeyPem || privateKeyPem.length < 100) {
    const res = await axios.get(url, { timeout: 8000 });
    return res.data;
  }

  const ts = Date.now();
  const sig = signRequest('GET', path, ts, privateKeyPem);

  const res = await axios.get(url, {
    headers: {
      'KALSHI-ACCESS-KEY': keyId,
      'KALSHI-ACCESS-SIGNATURE': sig,
      'KALSHI-ACCESS-TIMESTAMP': String(ts),
    },
    timeout: 8000,
  });
  return res.data;
}

module.exports = { kalshiGet };
