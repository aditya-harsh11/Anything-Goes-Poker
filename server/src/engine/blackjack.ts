import type { Card, Rank } from '@poker/shared';

export interface BlackjackHand {
  total: number;
  isNatural: boolean; // 2-card 21
  bust: boolean;
  cards: Card[];
}

const RANK_ORDER: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14,
};

function blackjackValue(rank: Rank): number {
  if (rank === 'A') return 11; // reduced to 1 below if needed
  if (rank === 'T' || rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return Number(rank);
}

export function evaluateBlackjack(cards: Card[]): BlackjackHand {
  let total = cards.reduce((sum, c) => sum + blackjackValue(c.rank), 0);
  let aces = cards.filter((c) => c.rank === 'A').length;
  while (total > 21 && aces > 0) {
    total -= 10; // count an ace as 1 instead of 11
    aces -= 1;
  }
  return {
    total,
    isNatural: cards.length === 2 && total === 21,
    bust: total > 21,
    cards,
  };
}

/** >0 if a is the stronger blackjack hand, 0 tie, <0 if b is stronger. */
export function compareBlackjack(a: BlackjackHand, b: BlackjackHand): number {
  // A natural (2-card 21) beats everything else.
  if (a.isNatural !== b.isNatural) return a.isNatural ? 1 : -1;

  // Bust loses.
  if (a.bust !== b.bust) return a.bust ? -1 : 1;

  // Closer to 21 (higher non-bust total) wins.
  if (a.total !== b.total) return a.total - b.total;

  // Equal total / both natural: higher card combination wins (by card rank, desc).
  const ar = a.cards.map((c) => RANK_ORDER[c.rank]).sort((x, y) => y - x);
  const br = b.cards.map((c) => RANK_ORDER[c.rank]).sort((x, y) => y - x);
  for (let i = 0; i < Math.max(ar.length, br.length); i++) {
    const diff = (ar[i] ?? 0) - (br[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Ids of the winning blackjack hand(s) among the entries. */
export function blackjackWinners(entries: { id: string; hand: BlackjackHand }[]): string[] {
  if (entries.length === 0) return [];
  let best = entries[0].hand;
  for (const e of entries) if (compareBlackjack(e.hand, best) > 0) best = e.hand;
  return entries.filter((e) => compareBlackjack(e.hand, best) === 0).map((e) => e.id);
}
