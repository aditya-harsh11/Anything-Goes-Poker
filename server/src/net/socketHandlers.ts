import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomSettings,
  Variant,
} from '@poker/shared';
import { VARIANTS } from '@poker/shared';
import { roomManager } from '../rooms/roomManager';
import type { Room } from '../rooms/room';

export interface SocketData {
  roomId?: string;
  playerId?: string;
}

type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type Sock = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

// ---- validation ------------------------------------------------------------

const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('fold') }),
  z.object({ type: z.literal('check') }),
  z.object({ type: z.literal('call') }),
  z.object({ type: z.literal('bet'), amount: z.number().finite() }),
  z.object({ type: z.literal('raise'), amount: z.number().finite() }),
]);

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.max(min, Math.min(max, n));
}

function clampSettings(s: unknown): RoomSettings {
  const obj = (s ?? {}) as Record<string, unknown>;
  const variant: Variant =
    typeof obj.variant === 'string' && obj.variant in VARIANTS ? (obj.variant as Variant) : 'texas';
  const bigBlind = clampInt(obj.bigBlind, 2, 1, 1_000_000);
  const smallBlind = clampInt(obj.smallBlind, Math.max(1, Math.floor(bigBlind / 2)), 1, bigBlind);
  const startingStack = clampInt(obj.startingStack, 1000, bigBlind, 100_000_000);
  const maxSeats = clampInt(obj.maxSeats, 8, 2, 8);
  return { variant, smallBlind, bigBlind, startingStack, maxSeats };
}

function cleanName(name: unknown): string {
  return String(name ?? '').trim().slice(0, 20) || 'Player';
}

// ---- broadcast -------------------------------------------------------------

function broadcast(io: IO, room: Room): void {
  for (const { socketId, viewerId } of room.audience()) {
    io.to(socketId).emit('roomState', room.snapshotFor(viewerId));
  }
}

function pushHoleCards(io: IO, room: Room): void {
  for (const player of room.players.values()) {
    if (player.socketId && player.inHand && player.holeCards.length) {
      io.to(player.socketId).emit('yourCards', player.holeCards);
    }
  }
}

// ---- registration ----------------------------------------------------------

export function registerHandlers(io: IO): void {
  io.on('connection', (socket: Sock) => {
    const currentRoom = (): Room | undefined =>
      socket.data.roomId ? roomManager.get(socket.data.roomId) : undefined;

    const requireHost = (room: Room): boolean =>
      !!socket.data.playerId && room.isHost(socket.data.playerId);

    // Register a listener that can never crash the process: a throw in any handler is
    // logged and reported to that one client instead of taking the whole server down.
    const register = socket.on.bind(socket) as (event: string, fn: (...a: unknown[]) => void) => void;
    const on = <E extends keyof ClientToServerEvents>(event: E, handler: ClientToServerEvents[E]): void => {
      register(event as string, (...args: unknown[]) => {
        try {
          (handler as (...a: unknown[]) => void)(...args);
        } catch (err) {
          console.error(`[poker] handler "${String(event)}" threw:`, err);
          try {
            socket.emit('errorMsg', 'Something went wrong — try again.');
          } catch {
            /* ignore secondary failures */
          }
        }
      });
    };

    on('createRoom', (data, cb) => {
      const settings = clampSettings(data?.settings);
      const room = roomManager.create(settings);
      const host = room.addHost(cleanName(data?.name), socket.id);
      socket.data.roomId = room.id;
      socket.data.playerId = host.id;
      socket.join(room.id);
      cb({ ok: true, roomId: room.id, playerId: host.id, token: host.token });
      broadcast(io, room);
    });

    on('joinRoom', (data, cb) => {
      const room = roomManager.get(String(data?.roomId ?? ''));
      if (!room) {
        cb({ ok: false, error: 'Room not found' });
        return;
      }
      if (!room.hasFreeSeat()) {
        cb({ ok: false, error: 'Table is full' });
        return;
      }
      const buyIn = clampInt(data?.buyIn, room.settings.startingStack, 1, 100_000_000);
      const req = room.requestJoin(cleanName(data?.name), buyIn, socket.id);
      socket.data.roomId = room.id;
      socket.data.playerId = req.requestId;
      socket.join(room.id);
      cb({ ok: true, status: 'pending', playerId: req.requestId, token: req.token });
      broadcast(io, room);
    });

    on('rejoin', (data, cb) => {
      const room = roomManager.get(String(data?.roomId ?? ''));
      if (!room) {
        cb({ ok: false, error: 'Room not found' });
        return;
      }
      const token = String(data?.token ?? '');
      const found = room.reassociate(token, socket.id);
      if (found) {
        socket.data.roomId = room.id;
        socket.data.playerId = found.id;
        socket.join(room.id);
        cb({ ok: true, playerId: found.id, status: found.status, token });
        broadcast(io, room);
        return;
      }
      cb({ ok: false, error: 'Session not found' });
    });

    on('startHand', () => {
      const room = currentRoom();
      if (!room) return;
      if (!requireHost(room)) {
        socket.emit('errorMsg', 'Only the host can start the hand');
        return;
      }
      // The host doesn't deal directly anymore — they hand control to the dealer,
      // who then picks the variant which atomically triggers the actual deal.
      const res = room.startHand();
      if (!res.ok) {
        socket.emit('errorMsg', res.error ?? 'Could not start hand');
        return;
      }
      broadcast(io, room);
    });

    on('playerAction', (action) => {
      const room = currentRoom();
      if (!room || !socket.data.playerId) return;
      const parsed = actionSchema.safeParse(action);
      if (!parsed.success) {
        socket.emit('errorMsg', 'Invalid action');
        return;
      }
      const res = room.applyPlayerAction(socket.data.playerId, parsed.data);
      if (!res.ok) {
        socket.emit('errorMsg', res.error ?? 'Illegal action');
        return;
      }
      broadcast(io, room);
    });

    on('selectCards', (indices) => {
      const room = currentRoom();
      if (!room || !socket.data.playerId) return;
      const arr = Array.isArray(indices) ? indices.map(Number).filter((n) => Number.isFinite(n)) : [];
      room.selectCards(socket.data.playerId, arr);
      broadcast(io, room);
    });

    on('selectBombCards', (data) => {
      const room = currentRoom();
      if (!room || !socket.data.playerId) return;
      const toIdx = (v: unknown) => (Array.isArray(v) ? v.map(Number).filter((n) => Number.isFinite(n)) : []);
      room.selectBombCards(socket.data.playerId, toIdx(data?.a), toIdx(data?.b));
      broadcast(io, room);
    });

    on('discardCard', (index) => {
      const room = currentRoom();
      if (!room || !socket.data.playerId) return;
      room.discardCard(socket.data.playerId, Number(index));
      broadcast(io, room);
    });

    on('showCards', (indices) => {
      const room = currentRoom();
      if (!room || !socket.data.playerId) return;
      const arr = Array.isArray(indices) ? indices.map(Number).filter((n) => Number.isFinite(n)) : [];
      room.showCards(socket.data.playerId, arr);
      broadcast(io, room);
    });

    on('sitOut', () => {
      const room = currentRoom();
      if (!room || !socket.data.playerId) return;
      room.setSittingOut(socket.data.playerId, true);
      broadcast(io, room);
    });

    on('sitIn', () => {
      const room = currentRoom();
      if (!room || !socket.data.playerId) return;
      room.setSittingOut(socket.data.playerId, false);
      broadcast(io, room);
    });

    on('leaveRoom', () => {
      const room = currentRoom();
      if (!room || !socket.data.playerId) return;
      room.removePlayer(socket.data.playerId);
      room.rejectJoin(socket.data.playerId);
      socket.leave(room.id);
      socket.data.roomId = undefined;
      socket.data.playerId = undefined;
      if (room.isEmpty()) roomManager.delete(room.id);
      else broadcast(io, room);
    });

    // ---- host controls ----
    on('hostApproveJoin', (requestId) => {
      const room = currentRoom();
      if (!room || !requireHost(room)) return;
      const player = room.approveJoin(String(requestId));
      if (player) broadcast(io, room);
    });

    on('hostRejectJoin', (requestId) => {
      const room = currentRoom();
      if (!room || !requireHost(room)) return;
      const req = room.rejectJoin(String(requestId));
      if (req) {
        io.to(req.socketId).emit('errorMsg', 'The host declined your request to join');
        broadcast(io, room);
      }
    });

    on('hostAdjustStack', (data) => {
      const room = currentRoom();
      if (!room || !requireHost(room)) return;
      room.adjustStack(String(data?.playerId), clampInt(data?.delta, 0, -100_000_000, 100_000_000));
      broadcast(io, room);
    });

    on('hostSetStack', (data) => {
      const room = currentRoom();
      if (!room || !requireHost(room)) return;
      room.setStack(String(data?.playerId), clampInt(data?.value, 0, 0, 100_000_000));
      broadcast(io, room);
    });

    on('hostRemovePlayer', (playerId) => {
      const room = currentRoom();
      if (!room || !requireHost(room)) return;
      const removed = room.removePlayer(String(playerId));
      if (removed?.socketId) {
        io.to(removed.socketId).emit('errorMsg', 'You were removed from the table by the host');
      }
      broadcast(io, room);
    });

    on('hostForceShowdown', () => {
      const room = currentRoom();
      if (!room || !requireHost(room)) return;
      room.forceShowdown();
      broadcast(io, room);
    });

    on('hostSetVariant', (variant) => {
      const room = currentRoom();
      if (!room || !socket.data.playerId) return;
      // Only the dealer-on-the-clock may pick — and picking atomically deals the
      // hand. The legacy "host fallback" was removed: hand 1 now also goes through
      // this same dealer-picks flow.
      const res = room.setVariantAndDeal(socket.data.playerId, String(variant));
      if (!res.ok) {
        socket.emit('errorMsg', res.error ?? 'Could not pick the game');
        return;
      }
      pushHoleCards(io, room);
      broadcast(io, room);
    });

    on('hostShuffleSeats', () => {
      const room = currentRoom();
      if (!room || !requireHost(room)) return;
      if (room.shuffleSeats()) broadcast(io, room);
    });

    socket.on('disconnect', () => {
      const room = currentRoom();
      if (!room || !socket.data.playerId) return;
      const player = room.getPlayer(socket.data.playerId);
      if (player) {
        player.socketId = null; // keep their seat; they can rejoin with their token
      } else {
        room.rejectJoin(socket.data.playerId); // drop an un-approved pending request
      }
      if (room.isEmpty()) roomManager.delete(room.id);
      else broadcast(io, room);
    });
  });
}
