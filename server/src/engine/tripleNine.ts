import type { Card, Rank } from '@poker/shared';

/** 2-9 = 2-9, T/J/Q/K = 0, A = 1. */
export function cardDigit(rank: Rank): number {
  if (rank === 'A') return 1;
  if (rank === 'T' || rank === 'J' || rank === 'Q' || rank === 'K') return 0;
  return Number(rank);
}

/** Combines 3 cards, in order, into a 0-999 number (first card = hundreds digit). */
export function tripleNineValue(cards: Card[]): number {
  return cards.reduce((n, c) => n * 10 + cardDigit(c.rank), 0);
}

/**
 * Fallback for players who didn't choose (host force-resolve): the 3-card, ordered
 * selection out of their hand that lands closest to the target. Ignores poker-hand
 * quality on the leftover 2 — matching a player's chosen number is the safer default
 * for someone who never got to pick.
 */
export function bestTripleNineSelection(hole: Card[], target: number): { indices: number[]; value: number } {
  const n = hole.length;
  let best: { indices: number[]; value: number; diff: number } | null = null;
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      if (b === a) continue;
      for (let c = 0; c < n; c++) {
        if (c === a || c === b) continue;
        const indices = [a, b, c];
        const value = tripleNineValue(indices.map((i) => hole[i]));
        const diff = Math.abs(value - target);
        if (!best || diff < best.diff) best = { indices, value, diff };
      }
    }
  }
  return best ? { indices: best.indices, value: best.value } : { indices: hole.map((_, i) => i).slice(0, 3), value: 0 };
}
