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

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  process.env.FRONTEND_URL || null,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      callback(null, true); // permissive for dev; tighten in prod via FRONTEND_URL
    }
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

app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

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

wss.on('connection', (ws) => {
  let interval = null;

  const broadcast = async () => {
    if (ws.readyState !== ws.OPEN) return;
    try {
      const payload = await buildWsPayload();
      ws.send(JSON.stringify(payload));
    } catch (err) {
      console.error('WS broadcast error:', err.message);
    }
  };

  // Send initial payload after a short delay (routes need to be warm)
  setTimeout(broadcast, 500);
  interval = setInterval(broadcast, 30000);

  ws.on('close', () => clearInterval(interval));
  ws.on('error', () => {
    clearInterval(interval);
    ws.terminate();
  });
});

httpServer.listen(PORT, () => console.log(`SportsPulse API running on :${PORT} (HTTP + WS)`));

module.exports = app;
