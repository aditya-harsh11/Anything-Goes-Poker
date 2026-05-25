import pokersolver from 'pokersolver';
import { type Card, cardToString } from '@poker/shared';

const { Hand } = pokersolver;
type PokerHand = InstanceType<typeof Hand>;
export type { PokerHand };

export interface SolvedHand {
  id: string;
  hand: PokerHand;
}

/** Best 5-card Texas Hold'em hand from hole cards + board (pokersolver picks the best 5 of 7). */
export function solve(hole: Card[], board: Card[]): PokerHand {
  const cards = [...hole, ...board].map(cardToString);
  return Hand.solve(cards);
}

/** Human-readable description, e.g. "Two Pair, A's & K's" or "Flush, K High"
 *  (the trailing suit letter on flush/high-card kickers is stripped). */
export function describe(hand: PokerHand): string {
  return hand.descr.replace(/\b(10|[2-9TJQKA])[shdc]\b/g, '$1');
}

/** >0 if a beats b, 0 if tie, <0 if b beats a. */
export function compareHands(a: PokerHand, b: PokerHand): number {
  const winners = Hand.winners([a, b]);
  const aw = winners.includes(a);
  const bw = winners.includes(b);
  if (aw && bw) return 0;
  return aw ? 1 : -1;
}

/** Ids of the winning player(s) among the given solved hands (ties => multiple ids). */
export function winnersAmong(solved: SolvedHand[]): string[] {
  if (solved.length === 0) return [];
  if (solved.length === 1) return [solved[0].id];
  const winning = Hand.winners(solved.map((s) => s.hand));
  const winSet = new Set<PokerHand>(winning);
  return solved.filter((s) => winSet.has(s.hand)).map((s) => s.id);
}

function arrCombos<T>(arr: T[], k: number): T[][] {
  const out: T[][] = [];
  const combo: T[] = [];
  const rec = (start: number) => {
    if (combo.length === k) {
      out.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      rec(i + 1);
      combo.pop();
    }
  };
  rec(0);
  return out;
}

function indexCombos(n: number, k: number): number[][] {
  return arrCombos(
    Array.from({ length: n }, (_, i) => i),
    k,
  );
}

/**
 * Best 5-card hand that uses ALL of `holeSubset` plus the best fill from the board.
 * (For "exactly k hole cards" rules — the k chosen cards are forced into the hand.)
 */
export function bestHandUsing(holeSubset: Card[], board: Card[]): PokerHand {
  const need = 5 - holeSubset.length;
  if (need <= 0) {
    return Hand.solve(holeSubset.slice(0, 5).map(cardToString));
  }
  let best: PokerHand | null = null;
  for (const fill of arrCombos(board, Math.min(need, board.length))) {
    const hand = Hand.solve([...holeSubset, ...fill].map(cardToString));
    if (!best || compareHands(hand, best) > 0) best = hand;
  }
  return best ?? Hand.solve(holeSubset.map(cardToString));
}

/** Evaluate the hand a player actually chose, by hole-card indices. */
export function handFromSelection(hole: Card[], indices: number[], board: Card[]): PokerHand {
  const subset = indices.map((i) => hole[i]).filter((c): c is Card => !!c);
  return bestHandUsing(subset, board);
}

/** The strongest hand a player could have made, given the variant's allowed hole-card counts. */
export function bestSelection(
  hole: Card[],
  board: Card[],
  allowedCounts: number[],
): { hand: PokerHand; indices: number[] } {
  let bestHand: PokerHand | null = null;
  let bestIdx: number[] = [];
  for (const k of allowedCounts) {
    if (k > hole.length) continue;
    for (const idx of indexCombos(hole.length, k)) {
      const hand = bestHandUsing(
        idx.map((i) => hole[i]),
        board,
      );
      if (!bestHand || compareHands(hand, bestHand) > 0) {
        bestHand = hand;
        bestIdx = idx;
      }
    }
  }
  if (!bestHand) {
    bestHand = bestHandUsing([], board);
    bestIdx = [];
  }
  return { hand: bestHand, indices: bestIdx };
}
