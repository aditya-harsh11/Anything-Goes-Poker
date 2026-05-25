import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@poker/shared';
import { registerHandlers, type SocketData } from './net/socketHandlers';

const app = express();
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

const httpServer = createServer(app);
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>(httpServer, {
  cors: { origin: '*' },
});

registerHandlers(io);

const PORT = Number(process.env.PORT) || 3001;
httpServer.listen(PORT, () => {
  console.log(`[poker] server listening on http://localhost:${PORT}`);
});
