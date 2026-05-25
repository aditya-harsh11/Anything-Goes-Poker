import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@poker/shared';

// Connect straight to the game server (port 3001) on whatever host the page was
// loaded from — works for localhost and for LAN play (e.g. http://192.168.x.x:5173).
// This avoids relying on the Vite dev proxy for the websocket, which can drop.
const SERVER_URL = `${window.location.protocol}//${window.location.hostname}:3001`;

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SERVER_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
});
