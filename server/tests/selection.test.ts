import { describe, it, expect } from 'vitest';
import { cardFromString } from '@poker/shared';
import {
  handFromSelection,
  bestSelection,
  compareHands,
  solve,
} from '../src/engine/handEvaluator';

const c = (s: string) => cardFromString(s);
const cards = (s: string) => s.split(' ').map(c);

describe('manual selection evaluation', () => {
  it('forces the chosen hole cards into the hand (Omaha "exactly 2")', () => {
    // Hole has two aces and two low cards; board is all spades.
    const hole = cards('Ah Ad 2c 3d');
    const board = cards('Ks Qs Js 9s 4s'); // a flush is only possible by NOT using the aces
    // Using the two aces (no spade) => just a pair of aces, no flush.
    const withAces = handFromSelection(hole, [0, 1], board);
    expect(withAces.name).toBe('Pair');
  });

  it('bestSelection finds the strongest legal hand', () => {
    const hole = cards('As 2c 7d 9h'); // As is the only spade
    const board = cards('Ks Qs Js Ts 4c'); // As + 4 board spades = royal-ish flush, but needs exactly 2 hole in PLO
    // PLO requires exactly 2 hole cards, so the As flush is NOT makeable (only 1 spade in hand).
    const plo = bestSelection(hole, board, [2]);
    expect(plo.hand.name).not.toBe('Straight Flush');
    // Dirty Omaha allows using just 1 hole card => As + board spades = straight flush.
    const dirty = bestSelection(hole, board, [0, 1, 2, 3, 4]);
    expect(dirty.hand.name).toBe('Straight Flush');
    expect(dirty.indices).toEqual([0]); // used only the ace of spades
  });

  it('detects when a better hand was available (advisor)', () => {
    const hole = cards('As Ks 2c 2d'); // could make the nut flush with As Ks
    const board = cards('Qs Js 5s 8d 3h');
    const chosen = handFromSelection(hole, [2, 3], board); // played pair of twos
    const best = bestSelection(hole, board, [2]); // As Ks => flush
    expect(compareHands(best.hand, chosen)).toBeGreaterThan(0);
    expect(best.hand.name).toBe('Flush');
  });

  it('play-the-board selection (0 hole cards) equals the board hand', () => {
    const hole = cards('2c 3d 4h 5s');
    const board = cards('As Ks Qs Js Ts'); // royal flush on board
    const boardHand = bestSelection(hole, board, [0, 1, 2, 3, 4]);
    expect(boardHand.hand.name).toBe('Straight Flush');
    expect(boardHand.indices).toEqual([]);
    expect(compareHands(boardHand.hand, solve([], board))).toBe(0);
  });
});
