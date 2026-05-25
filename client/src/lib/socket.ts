import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@poker/shared';

// Where to reach the game server:
//  - VITE_SERVER_URL wins (set it for a split client/server deploy)
//  - dev: the same host on port 3001 (the server runs separately from Vite)
//  - prod: same origin (the Node server serves this build and the socket)
const serverUrl =
  import.meta.env.VITE_SERVER_URL ??
  (import.meta.env.DEV ? `${window.location.protocol}//${window.location.hostname}:3001` : undefined);

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(serverUrl, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
});
