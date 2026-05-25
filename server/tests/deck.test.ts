import { describe, it, expect } from 'vitest';
import { freshDeck, shuffle, Deck } from '../src/engine/deck';
import { cardToString } from '@poker/shared';

describe('deck', () => {
  it('fresh deck has 52 unique cards', () => {
    const deck = freshDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map(cardToString)).size).toBe(52);
  });

  it('shuffle preserves the full multiset of cards', () => {
    const deck = freshDeck();
    const before = deck.map(cardToString).sort();
    shuffle(deck);
    const after = deck.map(cardToString).sort();
    expect(after).toEqual(before);
  });

  it('Deck draws unique cards and tracks remaining', () => {
    const deck = new Deck();
    expect(deck.remaining).toBe(52);
    const drawn = deck.drawMany(52);
    expect(deck.remaining).toBe(0);
    expect(new Set(drawn.map(cardToString)).size).toBe(52);
    expect(() => deck.draw()).toThrow();
  });
});
