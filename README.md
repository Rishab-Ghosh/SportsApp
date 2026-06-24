# SportsPulse — Sports Intelligence Terminal

A Bloomberg Terminal-style sports dashboard. Dark, dense, data-first. Live Kalshi prediction markets, ESPN scores, Guardian sports news, and a dynamic heat score engine — all in one view with real-time WebSocket updates.

## Stack

- **Frontend**: React 18 + Vite + TailwindCSS — deploys to Vercel
- **Backend**: Node.js + Express + WebSocket (`ws`) — deploys to Render
- **APIs**: Kalshi (prediction markets), ESPN public API (scores), Guardian API (headlines), OpenF1 (F1 sessions)

---

## Local Setup

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### 1. Clone and install

```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### 2. Get a free Guardian API key

1. Go to [open-platform.theguardian.com](https://open-platform.theguardian.com/access/) and click **Register**
2. Sign up — the developer tier is free and gives generous rate limits
3. Copy your API key from the confirmation email

> The Guardian's news API returns structured sports content directly from their editorial feed. No CORS issues, no request-from-browser restrictions.

### 3. Configure environment variables

**Backend** — create `server/.env`:
```bash
cp server/.env.example server/.env
# Edit server/.env:
GUARDIAN_API_KEY=your_guardian_key_here
PORT=3001
FRONTEND_URL=http://localhost:5173   # change to Vercel URL in production
```

**Frontend** — create `client/.env.local`:
```bash
cp client/.env.example client/.env.local
# Defaults work for local dev:
VITE_API_BASE_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

### 4. Run locally

```bash
# Terminal 1 — backend (HTTP + WebSocket on :3001)
cd server
npm run dev

# Terminal 2 — frontend
cd client
npm run dev      # → http://localhost:5173
```

---

## Phase 2 — What's New

### Features added over Phase 1

| Feature | Details |
|---------|---------|
| **Guardian API** | Replaces NewsAPI — structured sports editorial, no browser restrictions |
| **News/Market Cross-Reference** | `/api/news/enriched` matches article titles against Kalshi market titles using token overlap. Articles with a match get a `market_match` field; the News tab shows a green "📈 Live Market — YES X%" badge |
| **Dynamic Heat Score Engine** | `/api/heat-scores` computes a 0–100 activity score per sport using a seasonal calendar baseline (Free Agency, Transfer Window, Trade Deadline, etc.) multiplied by a Kalshi volume signal |
| **Tracker Cards** | `/api/tracker/:sport` returns Kalshi market cards with related news articles attached via token matching. Sports with no markets show "Rumor" cards with the latest news |
| **WebSocket Live Updates** | Server pushes `{ type: "update", kalshi, heat, scores }` to all connected clients every 30 seconds. Frontend `WebSocketProvider` reconnects automatically after 3 seconds if the connection drops |
| **Win Probability on Scores** | Scores tab matches each game to a Kalshi market by team name tokens. When a match is found, a "KALSHI MARKET ODDS" row shows YES/NO bars clearly labeled as market-derived (not statistical) |

### Heat Score Algorithm

Each sport has a **seasonal baseline** (0–100) derived from the current calendar date:

| Sport | Peak Event | Peak Score |
|-------|-----------|-----------|
| NBA | Free Agency (Jun 25 – Jul 20) | 96 |
| NBA | Trade Deadline (Feb 1–6) | 98 |
| NFL | Free Agency (Mar 10–20) | 88 |
| NFL | Draft (Apr 24–26) | 85 |
| MLB | Trade Deadline (Jul 25 – Aug 1) | 88 |
| Soccer | Summer Transfer Window (Jun 10 – Aug 31) | 90 |
| F1 | Silly Season (Oct 1 – Dec 15) | 72 |

The baseline is then multiplied by a **Kalshi volume signal**: sports whose Kalshi market volume is in the top tercile get ×1.15 (cap 100), bottom tercile get ×0.90.

### Kalshi Phase 3 Note

Public market data (what Phase 1 and 2 use) requires no API key — it's the open endpoint.

The `KALSHI_API_KEY` variable is reserved for Phase 3 features:
1. Create an account at [kalshi.com](https://kalshi.com)
2. Generate an API key at **kalshi.com/settings/api**
3. Phase 3 will use it for portfolio data, order placement, and authenticated private markets

---

## Tabs

| Tab | What it shows |
|-----|---------------|
| **Home** | 3-column: top Kalshi markets by volume · live scores · breaking headlines |
| **Odds** | Full Kalshi feed, filter by sport, sort by Volume / Movement / Closing Soon |
| **Tracker** | SVG arc heat gauge per sport (colors: gray→yellow→orange→red) + prediction market cards with related news. "Rumor" card style when no markets exist |
| **News** | Breaking (enriched) · Scores & Recaps · Market Moves. Green badge on articles with a matching Kalshi market |
| **Scores** | Live / Upcoming / Final game cards. Shows "Kalshi Market Odds" row when a matching prediction market is found |

---

## Deploying to Vercel (Frontend)

1. Push to a GitHub repo
2. Import in [vercel.com](https://vercel.com), set **Root Directory** to `client`
3. Add environment variables:
   - `VITE_API_BASE_URL` = your Render backend URL (e.g. `https://sportspulse-api.onrender.com`)
   - `VITE_WS_URL` = `wss://sportspulse-api.onrender.com` (note `wss://` for HTTPS backends)
4. Deploy

---

## Deploying to Render (Backend)

1. Push to GitHub
2. New **Web Service** on [render.com](https://render.com)
3. Set:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Runtime**: Node ≥ 18
4. Environment variables in Render dashboard:
   - `GUARDIAN_API_KEY` = your Guardian API key
   - `FRONTEND_URL` = your Vercel frontend URL (for CORS)
   - `NODE_ENV` = `production`
5. Use `server/render.yaml` for one-click Blueprint deploys

> **WebSocket on Render**: Render's free tier supports WebSocket connections. The WS server shares the HTTP port — no extra config needed. Set `VITE_WS_URL=wss://your-render-url.onrender.com` in Vercel.

After deploying, update both `VITE_API_BASE_URL` and `VITE_WS_URL` in Vercel to point at your Render URL, then redeploy the frontend.

---

## API Endpoints

| Route | Source | Cache TTL |
|-------|--------|-----------|
| `GET /api/kalshi/sports-markets` | Kalshi public API | 60s |
| `GET /api/scores/:sport` | ESPN / OpenF1 | 60s |
| `GET /api/news` | Guardian API | 60s |
| `GET /api/news/enriched` | Guardian + Kalshi cross-ref | 90s |
| `GET /api/heat-scores` | Seasonal + Kalshi volume | 60s |
| `GET /api/tracker/:sport` | Kalshi + Guardian filtered | 60s |
| `GET /api/health` | — | none |
| `WS /` | Pushes every 30s | — |

**`:sport`** accepts: `nba`, `nfl`, `mlb`, `soccer`, `f1`, `tennis`

---

## Notes

- Guardian API is free for non-commercial use with a developer key; no browser-side CORS issues
- Kalshi public markets API has rate limits; the in-memory cache ensures at most 1 call per 60 seconds per endpoint
- ESPN's public scoreboard API is unofficial — use for personal/demo projects only
- All external calls have 8-second timeouts with graceful error fallbacks and mock data where applicable
- The WebSocket server shares the Express HTTP port; no separate process or port needed
