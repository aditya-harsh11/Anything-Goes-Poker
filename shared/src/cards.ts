// Card primitives. Rank/suit codes match the format the `pokersolver` library expects,
// e.g. "As" (ace of spades), "Td" (ten of diamonds), "9h", "Kc".

export type Suit = 's' | 'h' | 'd' | 'c';
export type Rank =
  | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export const SUITS: Suit[] = ['s', 'h', 'd', 'c'];
export const RANKS: Rank[] = [
  '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A',
];

/** "As", "Td", "9h" — the string form used by pokersolver and for compact transport. */
export function cardToString(card: Card): string {
  return `${card.rank}${card.suit}`;
}

export function cardFromString(s: string): Card {
  return { rank: s[0] as Rank, suit: s[1] as Suit };
}

export const SUIT_SYMBOL: Record<Suit, string> = {
  s: '♠', // ♠
  h: '♥', // ♥
  d: '♦', // ♦
  c: '♣', // ♣
};
