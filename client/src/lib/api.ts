import type {
  RoomSettings,
  CreateRoomAck,
  JoinRoomAck,
  RejoinAck,
  PlayerAction,
} from '@poker/shared';
import { socket } from './socket';

export function createRoom(name: string, settings: RoomSettings): Promise<CreateRoomAck> {
  return new Promise((resolve) => socket.emit('createRoom', { name, settings }, resolve));
}

export function joinRoom(roomId: string, name: string, buyIn?: number): Promise<JoinRoomAck> {
  return new Promise((resolve) => socket.emit('joinRoom', { roomId, name, buyIn }, resolve));
}

export function rejoin(roomId: string, token: string): Promise<RejoinAck> {
  return new Promise((resolve) => socket.emit('rejoin', { roomId, token }, resolve));
}

export const api = {
  startHand: () => socket.emit('startHand'),
  act: (action: PlayerAction) => socket.emit('playerAction', action),
  selectCards: (indices: number[]) => socket.emit('selectCards', indices),
  discardCard: (index: number) => socket.emit('discardCard', index),
  showCards: (indices: number[]) => socket.emit('showCards', indices),
  forceShowdown: () => socket.emit('hostForceShowdown'),
  sitOut: () => socket.emit('sitOut'),
  sitIn: () => socket.emit('sitIn'),
  leaveRoom: () => socket.emit('leaveRoom'),
  approveJoin: (requestId: string) => socket.emit('hostApproveJoin', requestId),
  rejectJoin: (requestId: string) => socket.emit('hostRejectJoin', requestId),
  adjustStack: (playerId: string, delta: number) => socket.emit('hostAdjustStack', { playerId, delta }),
  setStack: (playerId: string, value: number) => socket.emit('hostSetStack', { playerId, value }),
  removePlayer: (playerId: string) => socket.emit('hostRemovePlayer', playerId),
};
