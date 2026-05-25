import { describe, it, expect } from 'vitest';
import { cardFromString } from '@poker/shared';
import { evaluateBlackjack, compareBlackjack, blackjackWinners } from '../src/engine/blackjack';

const c = (s: string) => cardFromString(s);
const hand = (s: string) => evaluateBlackjack(s.split(' ').map(c));

describe('blackjack evaluation', () => {
  it('values aces as 11 or 1 and 10-value cards as 10', () => {
    expect(hand('As Ks').total).toBe(21);
    expect(hand('As Ks').isNatural).toBe(true);
    expect(hand('Ah Ad').total).toBe(12); // one ace drops to 1
    expect(hand('Kh Qd').total).toBe(20);
    expect(hand('9h 8d').total).toBe(17);
  });

  it('ranks naturals AK > AQ > AJ > A10', () => {
    expect(compareBlackjack(hand('As Ks'), hand('As Qd'))).toBeGreaterThan(0);
    expect(compareBlackjack(hand('As Qs'), hand('As Jd'))).toBeGreaterThan(0);
    expect(compareBlackjack(hand('As Js'), hand('As Td'))).toBeGreaterThan(0);
  });

  it('a natural beats a non-natural 20', () => {
    expect(compareBlackjack(hand('As Td'), hand('Kh Qd'))).toBeGreaterThan(0);
  });

  it('closest to 21 wins; equal totals break by higher card (KQ beats J10)', () => {
    expect(compareBlackjack(hand('Kh Qd'), hand('9s 8c'))).toBeGreaterThan(0); // 20 > 17
    expect(compareBlackjack(hand('Kh Qd'), hand('Js Td'))).toBeGreaterThan(0); // both 20, K>J
  });

  it('picks the winner(s) among several hands', () => {
    const entries = [
      { id: 'a', hand: hand('As Ks') }, // natural blackjack
      { id: 'b', hand: hand('Kh Qd') }, // 20
      { id: 'c', hand: hand('9s 9d') }, // 18
    ];
    expect(blackjackWinners(entries)).toEqual(['a']);
  });
});
