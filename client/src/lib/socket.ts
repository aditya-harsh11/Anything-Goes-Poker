import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@poker/shared';

// Where to reach the game server:
//  - VITE_SERVER_URL wins (set it for a split client/server deploy)
//  - dev: the same host on port 3001 (the server runs separately from Vite)
//  - prod: same origin (the Node server serves this build and the socket)
const serverUrl =
  import.meta.env.VITE_SERVER_URL ??
  (import.meta.env.DEV ? `${window.location.protocol}//${window.location.hostname}:3001` : undefined);

/** Base URL for plain HTTP requests to the server (e.g. the /health keep-alive). */
export const serverBase = serverUrl ?? '';

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(serverUrl, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
  // Keep trying forever on a dropped connection (phones sleep, wifi flaps, server cold-starts).
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 4000,
  randomizationFactor: 0.5,
  timeout: 20000,
});
