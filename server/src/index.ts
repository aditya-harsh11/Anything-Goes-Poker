import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';
import express from 'express';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@poker/shared';
import { registerHandlers, type SocketData } from './net/socketHandlers';

const app = express();
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// In production, serve the built client from this same server (single-host deploy).
const clientDist = fileURLToPath(new URL('../../client/dist', import.meta.url));
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const httpServer = createServer(app);
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>(httpServer, {
  cors: { origin: '*' },
  // Detect a dead socket reasonably fast (so the client shows "Reconnecting…" and
  // recovers) without being so twitchy that brief mobile lag drops players.
  pingInterval: 20_000,
  pingTimeout: 20_000,
  // Seamlessly restore a socket (its rooms + missed events) after a brief drop,
  // so a momentary "reconnecting…" doesn't drop a player out of the hand.
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  },
});

registerHandlers(io);

// A single bad event must never take the whole server (every active table) down.
process.on('uncaughtException', (err) => {
  console.error('[poker] uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[poker] unhandledRejection:', reason);
});

const PORT = Number(process.env.PORT) || 3001;
httpServer.listen(PORT, () => {
  console.log(`[poker] server listening on http://localhost:${PORT}`);
});
