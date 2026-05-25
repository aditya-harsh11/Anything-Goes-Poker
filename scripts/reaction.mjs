// Verifies emoji reactions broadcast to everyone in the room.
import { io } from 'socket.io-client';

const URL = process.env.SMOKE_URL ?? 'http://localhost:3001';
const log = (...a) => console.log(...a);
const connect = () => io(URL, { transports: ['websocket'], forceNew: true });

let got = false;
const host = connect();
host.on('connect', () => {
  host.emit(
    'createRoom',
    { name: 'Alice', settings: { variant: 'texas', smallBlind: 5, bigBlind: 10, startingStack: 1000, maxSeats: 8 } },
    (ack) => {
      const watcher = connect();
      watcher.on('reaction', (r) => {
        log('watcher received reaction:', r.emoji, 'from', r.fromName);
        got = r.emoji === '🤡' && r.fromName === 'Alice';
        log(got ? 'PASS' : 'FAIL');
        setTimeout(() => process.exit(got ? 0 : 1), 50);
      });
      watcher.on('connect', () => {
        watcher.emit('joinRoom', { roomId: ack.roomId, name: 'Bob' }, () => {
          setTimeout(() => host.emit('sendReaction', '🤡'), 100);
        });
      });
    },
  );
});

setTimeout(() => {
  log('TIMEOUT (no reaction received)');
  process.exit(2);
}, 6000);
