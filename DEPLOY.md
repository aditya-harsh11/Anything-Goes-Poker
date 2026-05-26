# Deploying Anything Goes Poker

The catch: the server is a **long-lived Socket.IO (WebSocket) process that holds game
state in memory**. That rules out Vercel/Netlify *for the server* — their serverless
functions don't keep persistent WebSocket connections or shared in-memory state. You
need a host that runs a normal Node process.

## Option A — one service (recommended, simplest)

Deploy the whole repo to **Render**, **Railway**, or **Fly.io** as a single Node web
service. The server serves the built client and the socket from the same origin (no
CORS, no extra config — `socket.ts` connects same-origin in production).

- **Build command:** `npm install && npm run build`
- **Start command:** `npm start`
- **Health check path:** `/health`
- The platform sets `PORT`; the server already reads `process.env.PORT`.

That's it — open the service URL, create a game, share the link.

### Render quick steps
1. Push this repo to GitHub.
2. Render → New → **Web Service** → pick the repo.
3. Environment **Node**, Build `npm install && npm run build`, Start `npm start`.
4. Deploy.

## Option B — client on Vercel, server elsewhere

Host the static client on **Vercel** and the server on Render/Railway/Fly.

- Server: deploy as in Option A (it still works as an API/socket host).
- Client on Vercel: project root `client/`, build `npm run build`, output `dist`.
  Set an env var **`VITE_SERVER_URL`** = your server's public URL (e.g.
  `https://your-poker-server.onrender.com`). The client reads it at build time.
- The server already allows any origin (`cors: { origin: '*' }`).

## Important caveats

- **Single instance only.** Game state lives in memory, so run exactly one server
  instance. Scaling to multiple instances would need sticky sessions + a Socket.IO
  Redis adapter and moving room state into Redis/DB.
- **A server restart wipes all active games** (redeploys included). Players can refresh
  to rejoin a *running* server (their seat token is in localStorage), but if the server
  itself restarted, the rooms are gone. The client detects this (a failed rejoin) and
  shows a **"Table unavailable"** screen instead of a dead UI. Persisting rooms to a
  database is the fix when you want true durability.

### Free-tier idle spin-down (Render et al.) — the big gotcha
Free tiers decide a service is "idle" from **HTTP request** activity, and a live
WebSocket sends **none** — so they can spin the server down **mid-game** (~15 min),
which wipes every table. Two mitigations:

1. **Built-in keep-alive (already in the app):** while a player is at a table the client
   pings `/health` every 4 min (prod only, `client/src/lib/useRoom.ts`), so the service
   stays awake as long as someone's playing.
2. **External uptime pinger (recommended for always-on):** point a free monitor
   (UptimeRobot, cron-job.org, BetterStack) at `https://<your-app>.onrender.com/health`
   every 5 min. This keeps the service warm even between sessions. (On Render free this
   roughly consumes the ~750 free instance-hours/month — enough for one service.)

The bulletproof fix is a **paid instance** (no spin-down) or moving room state into a
datastore so restarts don't matter.
