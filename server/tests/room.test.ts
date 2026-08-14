import { describe, it, expect } from 'vitest';
import { Room } from '../src/rooms/room';

const settings = { variant: 'texas' as const, smallBlind: 5, bigBlind: 10, startingStack: 1000, maxSeats: 8 };

describe('Room chip ledger', () => {
  it('undoing a buy-in via setStack does not read as a loss', () => {
    const room = new Room('r1', settings);
    const host = room.addHost('Host', 'sock1');

    room.adjustStack(host.id, 1000); // "+ buy-in": 1000 -> 2000
    expect(host.stack).toBe(2000);
    expect(host.totalBoughtIn).toBe(2000);
    expect(host.stack - host.totalBoughtIn).toBe(0);

    room.setStack(host.id, 1000); // undo the mistaken buy-in back to 1000
    expect(host.stack).toBe(1000);
    expect(host.totalBoughtIn).toBe(1000);
    expect(host.stack - host.totalBoughtIn).toBe(0); // should read even, not -1000
  });

  it('setStack raising the stack still counts as a real buy-in', () => {
    const room = new Room('r1', settings);
    const host = room.addHost('Host', 'sock1');

    room.setStack(host.id, 1500); // topped up by 500
    expect(host.stack).toBe(1500);
    expect(host.totalBoughtIn).toBe(1500);
    expect(host.stack - host.totalBoughtIn).toBe(0);
    expect(host.rebuys).toBe(1);
  });

  it('adjustStack clamps at 0 and only moves totalBoughtIn by the applied delta', () => {
    const room = new Room('r1', settings);
    const host = room.addHost('Host', 'sock1');

    room.adjustStack(host.id, -5000); // can't go below 0
    expect(host.stack).toBe(0);
    expect(host.totalBoughtIn).toBe(0); // only the actually-applied -1000 was removed
    expect(host.stack - host.totalBoughtIn).toBe(0);
  });

  it('a real gameplay loss (stack change outside host tools) still shows up as net loss', () => {
    const room = new Room('r1', settings);
    const host = room.addHost('Host', 'sock1');
    // Simulate a hand result directly moving the stack (as PokerGame would) without
    // going through adjustStack/setStack — this should NOT touch totalBoughtIn.
    host.stack -= 300;
    expect(host.stack - host.totalBoughtIn).toBe(-300);
  });
});
