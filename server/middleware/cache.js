const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 60 });

function withCache(key, fetchFn, ttl) {
  const cached = cache.get(key);
  if (cached !== undefined) return Promise.resolve(cached);
  return fetchFn().then(data => {
    if (ttl !== undefined) cache.set(key, data, ttl);
    else cache.set(key, data);
    return data;
  });
}

module.exports = { cache, withCache };
