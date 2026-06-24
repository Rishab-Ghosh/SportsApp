const crypto = require('crypto');
const NodeCache = require('node-cache');

const summaryCache = new NodeCache({ stdTTL: 0 }); // permanent in-process cache

const STOPWORDS = new Set([
  'the','a','an','in','on','at','to','for','of','and','or','is','was','are',
  'were','has','have','been','with','from','by','that','this','its','his','her',
  'their','our','they','them','he','she','it','be','do','did','not','but','as',
  'after','before','about','into','over','than','more','what','when','who',
]);

function tokenize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/['']/g, '')
    .split(/\W+/)
    .filter(w => w.length > 4 && !STOPWORDS.has(w));
}

// ── Union-Find ────────────────────────────────────────────────────────────────

function makeUF(n) {
  const parent = Array.from({ length: n }, (_, i) => i);
  function find(x) {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  }
  function union(x, y) { parent[find(x)] = find(y); }
  return { find, union };
}

function clusterArticles(articles) {
  const n = articles.length;
  if (n === 0) return [];

  const tokenSets = articles.map(a => new Set(tokenize(a.title)));
  const uf = makeUF(n);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // Must share same sport_tag first (avoid cross-sport false clusters)
      if (articles[i].sport_tag !== articles[j].sport_tag) continue;
      let shared = 0;
      for (const t of tokenSets[i]) {
        if (tokenSets[j].has(t)) { shared++; if (shared >= 2) break; }
      }
      if (shared >= 2) uf.union(i, j);
    }
  }

  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(articles[i]);
  }
  return [...groups.values()];
}

// ── Relevance Score ───────────────────────────────────────────────────────────

function scoreCluster(articles, hasMarket) {
  const now = Date.now();
  const mostRecent = Math.max(...articles.map(a => new Date(a.publishedAt).getTime() || 0));
  const ageMs = now - mostRecent;

  let score = 0;

  // Recency (max 40)
  if (ageMs < 3600000)       score += 40;
  else if (ageMs < 21600000) score += 30;
  else if (ageMs < 86400000) score += 20;
  else                       score += 5;

  // Source count (max 25)
  const sourceNames = new Set(articles.map(a => a.source));
  const sc = sourceNames.size;
  if (sc >= 4)      score += 25;
  else if (sc >= 3) score += 18;
  else if (sc >= 2) score += 10;
  else              score += 5;

  // Reddit upvotes (max 20)
  const totalUpvotes = articles.reduce((s, a) => s + (a.upvotes || 0), 0);
  if (totalUpvotes > 1000)     score += 20;
  else if (totalUpvotes > 500) score += 15;
  else if (totalUpvotes > 100) score += 10;
  else if (totalUpvotes > 0)   score += 5;

  // Kalshi market match bonus (+15)
  if (hasMarket) score += 15;

  return Math.min(100, score);
}

// ── Claude AI Summary ─────────────────────────────────────────────────────────

async function generateSummary(headlines, clusterId) {
  const cached = summaryCache.get(clusterId);
  if (cached) return cached;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your_anthropic_api_key_here') return null;

  try {
    const prompt = `Given these headlines about the same sports story, write a 2-sentence factual summary in plain English. Be specific, include names and numbers if present. Headlines: ${headlines.join(' | ')}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.content?.[0]?.text?.trim() || null;
    if (text) summaryCache.set(clusterId, text);
    return text;
  } catch (err) {
    console.warn('[cluster] AI summary failed:', err.message);
    return null;
  }
}

// ── Build StoryCards ──────────────────────────────────────────────────────────

async function buildStoryCards(articles, kalshiMarkets = []) {
  const clusters = clusterArticles(articles);

  // Match clusters to Kalshi markets
  function findMarketMatch(clusterArticles) {
    const tokens = new Set(clusterArticles.flatMap(a => tokenize(a.title)));
    for (const m of kalshiMarkets) {
      const mt = tokenize(m.title || '');
      if (mt.some(t => tokens.has(t))) return m;
    }
    return null;
  }

  const cards = await Promise.all(
    clusters.map(async (group) => {
      // Pick headline from highest-upvote article, or first one
      const sorted = [...group].sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
      const lead = sorted[0];

      const market = findMarketMatch(group);
      const relevance = scoreCluster(group, !!market);

      // Only generate AI summary for noteworthy clusters
      const worthSummary = group.length >= 2 || sorted.reduce((s, a) => s + (a.upvotes || 0), 0) >= 100;
      const clusterId = crypto.createHash('md5').update(lead.title).digest('hex').slice(0, 12);

      let summary = null;
      if (worthSummary) {
        summary = await generateSummary(group.map(a => a.title), clusterId);
      }
      if (!summary) summary = lead.description || lead.title;

      const totalUpvotes = group.reduce((s, a) => s + (a.upvotes || 0), 0);
      const mostRecent = group.reduce((latest, a) => {
        const t = new Date(a.publishedAt).getTime();
        return t > latest ? t : latest;
      }, 0);

      return {
        id: clusterId,
        headline: lead.title,
        summary,
        sport_tag: lead.sport_tag,
        sources: [...new Map(group.map(a => [a.source, { name: a.source, url: a.url }])).values()],
        source_count: new Set(group.map(a => a.source)).size,
        reddit_upvotes: totalUpvotes,
        relevance_score: relevance,
        publishedAt: mostRecent ? new Date(mostRecent).toISOString() : lead.publishedAt,
        market_match: market ? {
          id: market.id,
          title: market.title,
          yes_price: market.yes_price,
          url: `https://kalshi.com/markets/${market.id}`,
        } : null,
      };
    })
  );

  return cards.sort((a, b) => b.relevance_score - a.relevance_score);
}

module.exports = { buildStoryCards };
