# Deploying the Card Room

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
  itself restarted, the rooms are gone. Persisting rooms to a database is the fix when
  you want durability.
- Free tiers that sleep on idle will drop everyone when they spin down.
