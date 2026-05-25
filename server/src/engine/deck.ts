import { randomInt } from 'node:crypto';
import { type Card, RANKS, SUITS } from '@poker/shared';

export function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/** In-place cryptographically-seeded Fisher–Yates shuffle. */
export function shuffle(deck: Card[]): void {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
}

export class Deck {
  private cards: Card[];

  constructor() {
    this.cards = freshDeck();
    shuffle(this.cards);
  }

  draw(): Card {
    const card = this.cards.pop();
    if (!card) throw new Error('deck exhausted');
    return card;
  }

  drawMany(n: number): Card[] {
    const out: Card[] = [];
    for (let i = 0; i < n; i++) out.push(this.draw());
    return out;
  }

  get remaining(): number {
    return this.cards.length;
  }
}
