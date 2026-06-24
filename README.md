# SportsPulse

A Bloomberg Terminal-style sports intelligence dashboard. Real-time Kalshi prediction markets, live ESPN scores, Guardian sports headlines, and a dynamic Heat Score engine — all in one dark, dense, data-first interface with WebSocket live updates.

![Dashboard](./screenshot.png)

---

## Tech Stack

| Layer | Tools |
|-------|-------|
| Frontend | React 18 · Vite · TailwindCSS · WebSocket |
| Backend | Node.js · Express · `ws` · `node-cache` |
| APIs | Kalshi · ESPN (unofficial) · Guardian · OpenF1 |
| Deploy | Vercel (frontend) · Render (backend) |

---

## Local Setup

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9

### 1. Clone and install

```bash
git clone https://github.com/Rishab-Ghosh/SportsApp.git
cd SportsApp

cd server && npm install
cd ../client && npm install
```

### 2. Configure environment variables

**Backend** — `server/.env`
```bash
cp server/.env.example server/.env
# Fill in your keys (see table below)
```

**Frontend** — `client/.env.local`
```bash
cp client/.env.example client/.env.local
# Defaults work for local dev — no changes needed
```

### 3. Run locally

```bash
# Terminal 1 — backend (HTTP + WebSocket on :3001)
cd server && npm run dev

# Terminal 2 — frontend (http://localhost:5173)
cd client && npm run dev
```

---

## Environment Variable Reference

### Backend (`server/.env`)

| Variable | Where to get it | Required? |
|----------|----------------|-----------|
| `GUARDIAN_API_KEY` | [open-platform.theguardian.com](https://open-platform.theguardian.com/access/) → Register (free) | Yes — fallback to mock data if missing |
| `KALSHI_API_KEY_ID` | kalshi.com → Settings → API | Phase 3 only |
| `KALSHI_PRIVATE_KEY` | Same as above — RSA PEM, store as single line with `\n` | Phase 3 only |
| `PORT` | Set by Render automatically | No (defaults to 3001) |
| `FRONTEND_URL` | Your Vercel deploy URL | Yes in production |
| `ALLOWED_ORIGIN` | Same as FRONTEND_URL | Yes in production |
| `NODE_ENV` | `production` on Render | Recommended |

### Frontend (`client/.env.local`)

| Variable | Value | Required? |
|----------|-------|-----------|
| `VITE_API_BASE_URL` | Render backend URL in prod; empty string locally | Yes in production |
| `VITE_WS_URL` | `wss://your-render-url.onrender.com` in prod | Yes in production |

---

## Deployment

### Step 1 — Deploy backend to Render

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect the repo, set **Root Directory** to `server`
4. Build: `npm install` · Start: `node server.js` · Runtime: Node ≥ 18
5. Add environment variables in the Render dashboard (see table above)
6. Note your service URL: `https://sportspulse-api.onrender.com`

> Render free tier supports WebSocket — the WS server shares the HTTP port, no extra config.

### Step 2 — Deploy frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Set **Root Directory** to `client`
3. Framework preset: **Vite**
4. Add environment variables:
   - `VITE_API_BASE_URL` = `https://sportspulse-api.onrender.com`
   - `VITE_WS_URL` = `wss://sportspulse-api.onrender.com`
5. Deploy

### Step 3 — Wire CORS back

In the Render dashboard, set:
- `FRONTEND_URL` = your Vercel URL (e.g. `https://sportspulse.vercel.app`)
- `ALLOWED_ORIGIN` = same value

Redeploy the backend. Done.

---

## API Endpoints

| Route | Source | Cache TTL |
|-------|--------|-----------|
| `GET /api/kalshi/sports-markets` | Kalshi public API | 60s |
| `GET /api/kalshi/portfolio` | Kalshi authenticated API | none |
| `GET /api/scores/:sport` | ESPN / OpenF1 | 60s |
| `GET /api/news` | Guardian API | 60s |
| `GET /api/news/enriched` | Guardian + Kalshi cross-reference | 90s |
| `GET /api/heat-scores` | Seasonal baseline + Kalshi volume | 60s |
| `GET /api/tracker/:sport` | Kalshi + Guardian filtered | 60s |
| `GET /health` | — | none |
| `GET /api/ping` | — | none |
| `WS /` | Push every 30s | — |

`:sport` accepts: `nba` · `nfl` · `mlb` · `soccer` · `f1` · `tennis`

---

## Tabs

| Tab | What it shows |
|-----|---------------|
| **Home** | Top Kalshi markets by volume · live scores · breaking headlines |
| **Odds** | Full Kalshi feed — filter by sport, sort by Volume / Movement / Closing Soon |
| **Tracker** | SVG arc heat gauge per sport (gray→yellow→orange→red) + market cards with related news |
| **News** | Enriched feed with green "📈 Live Market" badge when a matching Kalshi market exists |
| **Scores** | Live / Upcoming / Final cards with "KALSHI MARKET ODDS" row when a match is found |

---

## Phase Roadmap

| Phase | Status | What shipped |
|-------|--------|-------------|
| **Phase 1** | ✅ | React + Vite + Tailwind frontend · Express backend · Kalshi, ESPN, Guardian, OpenF1 routes · 5-tab layout · 60s cache |
| **Phase 2** | ✅ | Guardian API · News/Market cross-reference · Heat Score engine · Tracker cards · WebSocket live updates · Win probability on Scores · enriched News badges |
| **Phase 3** | ✅ | Kalshi authenticated API layer (RSA-PSS signing) · `/api/kalshi/portfolio` · exponential-backoff WS reconnect · heartbeat pings · cold-start banner · keep-alive · mobile-responsive layout · share button |
| **Phase 4** | 🔜 | Live trading from the dashboard — Kalshi order placement, portfolio positions, P&L tracker |

---

## Notes

- Kalshi public markets API requires no key — it's the open endpoint used in Phases 1–2
- Guardian API is free for non-commercial developer use; rate limits are generous
- ESPN scoreboard API is unofficial — for personal/demo projects only
- All external calls have 8s timeouts with graceful mock fallbacks
- Render free tier sleeps after 15 min inactivity; the keep-alive `/api/ping` (every 14 min) prevents this while the tab is open
