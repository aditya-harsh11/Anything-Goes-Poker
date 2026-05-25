import { customAlphabet } from 'nanoid';
import type { RoomSettings } from '@poker/shared';
import { Room } from './room';

// Lowercase, no ambiguous characters (no 0/o/1/l) so codes are easy to share verbally.
const genRoomId = customAlphabet('abcdefghijkmnpqrstuvwxyz23456789', 6);

export class RoomManager {
  private rooms = new Map<string, Room>();

  create(settings: RoomSettings): Room {
    let id = genRoomId();
    while (this.rooms.has(id)) id = genRoomId();
    const room = new Room(id, settings);
    this.rooms.set(id, room);
    return room;
  }

  get(id: string): Room | undefined {
    return this.rooms.get(id.toLowerCase());
  }

  delete(id: string): void {
    this.rooms.delete(id.toLowerCase());
  }

  get count(): number {
    return this.rooms.size;
  }
}

export const roomManager = new RoomManager();
