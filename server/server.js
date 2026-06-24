require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const axios = require('axios');

const kalshiRoutes = require('./routes/kalshi');
const scoresRoutes = require('./routes/scores');
const newsRoutes = require('./routes/news');
const heatScoresRoutes = require('./routes/heatScores');
const trackerRoutes = require('./routes/tracker');
const { runScraper } = require('./lib/scraper');

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  process.env.FRONTEND_URL || null,
  process.env.ALLOWED_ORIGIN || null,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(o => origin.startsWith(o))) return callback(null, true);
    // In production, reject unknown origins; in dev allow all
    if (process.env.NODE_ENV === 'production') return callback(new Error('CORS'));
    callback(null, true);
  },
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

app.use('/api/kalshi', kalshiRoutes);
app.use('/api/scores', scoresRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/heat-scores', heatScoresRoutes);
app.use('/api/tracker', trackerRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime(), ts: Date.now() }));
app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
app.get('/api/ping', (_req, res) => res.json({ pong: true }));

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── WebSocket ────────────────────────────────────────────────────────────────

const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer });

async function buildWsPayload() {
  const base = `http://localhost:${PORT}`;
  const [marketsRes, heatRes, nbaRes] = await Promise.allSettled([
    axios.get(`${base}/api/kalshi/sports-markets`, { timeout: 5000 }).then(r => r.data.markets),
    axios.get(`${base}/api/heat-scores`, { timeout: 5000 }).then(r => r.data),
    axios.get(`${base}/api/scores/nba`, { timeout: 5000 }).then(r => r.data.games),
  ]);

  return {
    type: 'update',
    kalshi: marketsRes.status === 'fulfilled' ? marketsRes.value : [],
    heat: heatRes.status === 'fulfilled' ? heatRes.value : {},
    scores: { nba: nbaRes.status === 'fulfilled' ? nbaRes.value : [] },
    lastUpdated: Date.now(),
  };
}

async function sendUpdate(ws) {
  if (ws.readyState !== ws.OPEN) return;
  try {
    const payload = await buildWsPayload();
    ws.send(JSON.stringify(payload));
  } catch (err) {
    console.error('WS send error:', err.message);
  }
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  sendUpdate(ws);
  const interval = setInterval(() => sendUpdate(ws), 30000);

  ws.on('close', () => clearInterval(interval));
  ws.on('error', () => {
    clearInterval(interval);
    ws.terminate();
  });
});

// Heartbeat: terminate stale connections every 45s
setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 45000);

httpServer.listen(PORT, () => {
  console.log(`SportsPulse API running on :${PORT} (HTTP + WS)`);
  // Warm up news cache immediately so first page load is instant
  runScraper().catch(err => console.error('[scraper] Startup scrape failed:', err.message));
  // Refresh every 10 minutes
  setInterval(() => runScraper().catch(err => console.error('[scraper] Refresh failed:', err.message)), 10 * 60 * 1000);
});

module.exports = app;
