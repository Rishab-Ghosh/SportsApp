# SportsPulse

A Bloomberg Terminal-style sports intelligence dashboard. Real-time Kalshi prediction markets, live ESPN scores, multi-source scraped sports news, AI-powered story clustering, and a dynamic Heat Score engine — all in a dark, dense, three-panel terminal interface with WebSocket live updates.

![Dashboard](./screenshot.png)

---

## Tech Stack

| Layer | Tools |
|-------|-------|
| Frontend | React 18 · Vite · TailwindCSS · WebSocket |
| Backend | Node.js · Express · `ws` · `node-cache` |
| Scraping | `cheerio` · `xml2js` · Google News RSS · ESPN RSS · BBC Sport RSS · Reddit JSON |
| AI | Anthropic claude-haiku-4-5 for story summaries |
| Markets | Kalshi public + authenticated API (`node-forge` RSA-PSS) |
| Scores | ESPN unofficial scoreboard · OpenF1 |
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
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys | No — falls back to article snippet |
| `GUARDIAN_API_KEY` | [open-platform.theguardian.com](https://open-platform.theguardian.com/access/) | No — Guardian is supplemental |
| `KALSHI_API_KEY_ID` | kalshi.com → Settings → API | Phase 4 only |
| `KALSHI_PRIVATE_KEY` | Same as above — RSA PEM, one line with `\n` | Phase 4 only |
| `PORT` | Set automatically by Render | No (defaults 3001) |
| `FRONTEND_URL` | Your Vercel deploy URL | Yes in production |
| `ALLOWED_ORIGIN` | Same as FRONTEND_URL | Yes in production |
| `NODE_ENV` | `production` on Render | Recommended |

> **AI summary cost**: `claude-haiku-4-5` generates 2-sentence summaries. Approximate cost: ~$0.001 per 100 stories — effectively free for personal use.

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

> Render free tier supports WebSocket. The keep-alive `/api/ping` (every 14 min) prevents sleep while the browser tab is open.

### Step 2 — Deploy frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Set **Root Directory** to `client`
3. Framework preset: **Vite**
4. Add environment variables:
   - `VITE_API_BASE_URL` = `https://sportspulse-api.onrender.com`
   - `VITE_WS_URL` = `wss://sportspulse-api.onrender.com`
5. Deploy

### Step 3 — Wire CORS back

In the Render dashboard:
- `FRONTEND_URL` = your Vercel URL (e.g. `https://sportspulse.vercel.app`)
- `ALLOWED_ORIGIN` = same value

Redeploy the backend.

---

## API Endpoints

| Route | Source | Cache TTL |
|-------|--------|-----------|
| `GET /api/kalshi/sports-markets` | Kalshi public API | 60s |
| `GET /api/kalshi/portfolio` | Kalshi authenticated API | none |
| `GET /api/scores/:sport` | ESPN / OpenF1 | 60s |
| `GET /api/news` | Guardian API (legacy) | 60s |
| `GET /api/news/enriched` | Guardian + Kalshi cross-ref | 90s |
| `GET /api/news/feed?sport=&limit=` | Scraped + clustered StoryCards | 600s |
| `GET /api/news/all?limit=` | All sports StoryCards by relevance | 600s |
| `GET /api/heat-scores` | Seasonal baseline + Kalshi volume | 60s |
| `GET /api/tracker/:sport` | Kalshi + news filtered | 60s |
| `GET /health` | — | none |
| `GET /api/ping` | — | none |
| `WS /` | Push every 30s | — |

`:sport` accepts: `nba` · `nfl` · `mlb` · `soccer` · `f1` · `tennis`

---

## App Layout

```
┌─────────────────────────────────────────────────────┐
│  SPORTSPULSE  │  NEWS  ODDS  TRACKER  SCORES  │  WS │  ← 48px topbar
├────────────┬────────────────────────┬────────────────┤
│  Sports    │                        │  Kalshi        │
│  sidebar   │    Center feed /       │  Markets       │
│  220px     │    active tab          │                │
│            │                        ├────────────────┤
│  Heat dot  │    StoryCards (News)   │  Live Scores   │
│  per sport │    OddsTab / Tracker   │  280px         │
│            │    ScoresTab           │                │
└────────────┴────────────────────────┴────────────────┘
```

**News center feed** shows AI-clustered StoryCards sorted by relevance score:
- Recency (max 40pts) + Multi-source coverage (max 25pts) + Reddit upvotes (max 20pts) + Kalshi market match (+15pts)
- Thin gradient relevance bar at card bottom
- Green "📈 YES X¢" badge when a matching Kalshi market is found

---

## Scraping Sources

| Source | Type | Update interval |
|--------|------|----------------|
| Google News RSS | RSS (6 sport queries) | 10 min |
| Reddit r/nba, r/nfl, r/baseball, r/soccer, r/formula1, r/tennis | JSON API | 10 min |
| ESPN RSS (5 feeds) | RSS | 10 min |
| BBC Sport RSS (4 feeds) | RSS | 10 min |
| Sky Sports RSS (soccer, F1) | RSS | 10 min |

All scrapes run in parallel. Failed sources are skipped without crashing. Results cached for 10 minutes.

---

## Phase Roadmap

| Phase | Status | What shipped |
|-------|--------|-------------|
| **Phase 1** | ✅ | React + Vite + Tailwind · Express · Kalshi, ESPN, Guardian, OpenF1 · 5-tab layout · 60s cache |
| **Phase 2** | ✅ | Guardian API · News/Market cross-ref · Heat Score engine · Tracker cards · WebSocket updates · Win probability |
| **Phase 3** | ✅ | Kalshi RSA-PSS auth · `/portfolio` · WS heartbeat + exponential backoff · cold-start banner · keep-alive · mobile layout · share button |
| **Phase 3.5** | ✅ | Multi-source web scraper (Google News/ESPN/BBC/Reddit/Sky) · AI story clustering (union-find) · Claude Haiku summaries · relevance scoring · 3-panel redesign (topbar + sport sidebar + center feed + right panel) · SVG sparklines · `/api/news/feed` + `/api/news/all` |
| **Phase 4** | 🔜 | Live trading from the dashboard — Kalshi order placement, portfolio positions, P&L tracker |

---

## Notes

- Scraping respects each site's public RSS endpoint — no login or API key required
- Reddit JSON API requires only a `User-Agent` header; no OAuth needed for public posts
- ESPN scoreboard API is unofficial — for personal/demo projects only
- AI summaries are cached permanently in-process and only generated for stories with 2+ sources or 100+ Reddit upvotes
- The Kalshi public markets API has no key requirement; authenticated portfolio features require Phase 4 keys
