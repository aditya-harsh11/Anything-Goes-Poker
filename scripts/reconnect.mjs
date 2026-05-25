// Verifies that a host which loses its socket and reconnects reclaims its seat
// and still receives join requests (the "host offline / no requests" bug).
import { io } from 'socket.io-client';

const URL = process.env.SMOKE_URL ?? 'http://localhost:3001';
const log = (...a) => console.log(...a);
const connect = () => io(URL, { transports: ['websocket'], forceNew: true });

const host = connect();
let roomId = '';
let token = '';
let hostId = '';
let sawRequest = false;
let hostOnlineAfterReconnect = null;

// Mimic the client: (re)register the session on every connect.
host.on('connect', () => {
  if (token) host.emit('rejoin', { roomId, token }, () => log('[host] re-registered after reconnect'));
});

host.on('roomState', (st) => {
  const me = st.players.find((p) => p.id === hostId);
  if (me) hostOnlineAfterReconnect = me.isConnected;
  if (st.joinRequests && st.joinRequests.length > 0) {
    sawRequest = true;
    log('[host] sees join request from:', st.joinRequests.map((r) => r.name).join(', '));
    log('[host] host.isConnected =', me?.isConnected);
    log(sawRequest && me?.isConnected ? '\nPASS: host reconnected and received the join request' : '\nFAIL');
    setTimeout(() => process.exit(sawRequest && me?.isConnected ? 0 : 1), 100);
  }
});

host.emit(
  'createRoom',
  { name: 'Alice', settings: { variant: 'texas', smallBlind: 5, bigBlind: 10, startingStack: 1000, maxSeats: 8 } },
  (ack) => {
    roomId = ack.roomId;
    token = ack.token;
    hostId = ack.playerId;
    log('[host] created room', roomId);

    // Force a socket drop + reconnect (what browsers do automatically).
    setTimeout(() => {
      log('[host] forcing reconnect…');
      host.io.engine.close();
    }, 300);

    // After the reconnect, a player requests to join.
    setTimeout(() => {
      const p = connect();
      p.on('connect', () => p.emit('joinRoom', { roomId, name: 'Bob' }, () => log('[Bob] requested to join')));
    }, 1500);
  },
);

setTimeout(() => {
  log('TIMEOUT');
  process.exit(2);
}, 8000);
