// End-to-end test of Crazy Pineapple: deal 3 -> preflop bet -> flop -> each player
// discards 1 -> flop/turn/river betting -> showdown. Verifies chips are conserved.
import { io } from 'socket.io-client';

const URL = process.env.SMOKE_URL ?? 'http://localhost:3001';
const log = (...a) => console.log(...a);
const connect = () => io(URL, { transports: ['websocket'], forceNew: true });

const approved = new Set();
let started = false;
let finished = false;
const discarded = new Set();

function driver(sock, getId, label) {
  sock.on('errorMsg', (m) => log(`[${label}] error: ${m}`));
  sock.on('roomState', (st) => {
    const myId = getId();

    if (st.youAreHost && st.joinRequests) {
      for (const r of st.joinRequests) {
        if (!approved.has(r.requestId)) {
          approved.add(r.requestId);
          sock.emit('hostApproveJoin', r.requestId);
        }
      }
      if (!started && st.players.length === 3 && st.game.phase === 'waiting') {
        started = true;
        log('[host] starting crazy-pineapple hand');
        sock.emit('startHand');
      }
    }

    if (st.youMustDiscard && !discarded.has(label)) {
      discarded.add(label);
      log(`[${label}] discarding card 0 (board: ${st.game.communityCards.map((c) => c.rank + c.suit).join(' ')})`);
      setTimeout(() => sock.emit('discardCard', 0), 15);
    }

    if (st.game.toAct === myId && st.availableActions) {
      const av = st.availableActions;
      const action = av.canCheck ? { type: 'check' } : av.canCall ? { type: 'call' } : { type: 'fold' };
      setTimeout(() => sock.emit('playerAction', action), 15);
    }

    if (!finished && st.lastResult && st.game.phase === 'showdown' && !st.game.awaitingSelection) {
      finished = true;
      const total = st.players.reduce((s, p) => s + p.stack, 0);
      log('\n=== HAND COMPLETE ===');
      log('board:', st.lastResult.board.map((c) => c.rank + c.suit).join(' '));
      log('winners:', st.lastResult.winners.map((w) => `${w.name} +${w.amount}`).join(', '));
      log('total chips (expect 3000):', total);
      log(total === 3000 ? 'PASS: chips conserved' : 'FAIL: chip mismatch');
      setTimeout(() => process.exit(total === 3000 ? 0 : 1), 100);
    }
  });
}

const host = connect();
let hostId = '';
host.on('connect', () => {
  host.emit(
    'createRoom',
    { name: 'Alice', settings: { variant: 'crazy-pineapple', smallBlind: 5, bigBlind: 10, startingStack: 1000, maxSeats: 8 } },
    (ack) => {
      hostId = ack.playerId;
      log('[host] created room', ack.roomId);
      driver(host, () => hostId, 'Alice');
      for (const name of ['Bob', 'Carol']) {
        const p = connect();
        let pid = '';
        p.on('connect', () => {
          p.emit('joinRoom', { roomId: ack.roomId, name }, (jack) => {
            if (jack.ok) {
              pid = jack.playerId;
              driver(p, () => pid, name);
            }
          });
        });
      }
    },
  );
});

setTimeout(() => {
  log('TIMEOUT');
  process.exit(2);
}, 15000);
