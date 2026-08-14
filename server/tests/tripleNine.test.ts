import { describe, it, expect } from 'vitest';
import { VARIANTS, cardFromString } from '@poker/shared';
import { PokerGame, type HandPlayer } from '../src/engine/pokerGame';
import { cardDigit, tripleNineValue, bestTripleNineSelection } from '../src/engine/tripleNine';

function makePlayers(stacks: number[]): HandPlayer[] {
  return stacks.map((stack, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    seat: i,
    stack,
    status: 'seated' as const,
    committedThisRound: 0,
    totalCommitted: 0,
    inHand: false,
    holeCards: [],
  }));
}

const totalChips = (players: HandPlayer[]) => players.reduce((s, p) => s + p.stack, 0);

const c = (s: string) => cardFromString(s);
const cards = (s: string) => s.split(' ').map(c);

describe('Number (Triple 9) scoring', () => {
  it('maps ranks to digits per the house rule', () => {
    expect(cardDigit('2')).toBe(2);
    expect(cardDigit('9')).toBe(9);
    expect(cardDigit('T')).toBe(0);
    expect(cardDigit('J')).toBe(0);
    expect(cardDigit('Q')).toBe(0);
    expect(cardDigit('K')).toBe(0);
    expect(cardDigit('A')).toBe(1);
  });

  it('combines 3 cards into a number in the given order (order matters)', () => {
    const forward = cards('7h Jc As');
    expect(tripleNineValue(forward)).toBe(701); // 7, 0, 1
    expect(tripleNineValue([...forward].reverse())).toBe(107); // 1, 0, 7
  });

  it('bestTripleNineSelection finds the closest 3-card number to the target', () => {
    const hole = cards('9h 9c 9d 2s 3h');
    const { value } = bestTripleNineSelection(hole, 999);
    expect(value).toBe(999);
  });
});

describe('Number (Triple 9) showdown', () => {
  it('pauses for an ordered selection and splits the pot: poker half + closest-number half', () => {
    const players = makePlayers([1000, 1000, 1000]);
    const before = totalChips(players);
    const game = new PokerGame(players, { smallBlind: 5, bigBlind: 10 }, 0, 1, VARIANTS.triple9, 500);

    expect(game.tripleNineTarget).toBe(500);
    expect(players.every((p) => p.holeCards.length === 5)).toBe(true);

    // Check/call to the river.
    let guard = 0;
    while (!game.isComplete() && !game.awaitingSelection && guard++ < 200) {
      const id = game.currentActorId;
      if (!id) break;
      const av = game.availableActionsFor(id)!;
      game.applyAction(id, av.canCheck ? { type: 'check' } : { type: 'call' });
    }
    expect(game.awaitingSelection).toBe(true);

    // Wrong count is rejected — Number needs exactly 3, unlike other selection variants.
    expect(game.submitSelection('p0', [0, 1]).ok).toBe(false);

    // Submit a deliberately non-ascending order and confirm it's preserved, not
    // re-sorted like every other variant's selection.
    const p0 = players[0];
    const order = [3, 0, 2];
    const expectedValue = tripleNineValue(order.map((i) => p0.holeCards[i]));
    expect(game.submitSelection('p0', order).ok).toBe(true);
    // Can't select twice.
    expect(game.submitSelection('p0', [1, 2, 4]).ok).toBe(false);

    for (const p of players.slice(1)) {
      expect(game.submitSelection(p.id, [0, 1, 2]).ok).toBe(true);
    }

    expect(game.isComplete()).toBe(true);
    expect(totalChips(players)).toBe(before);
    expect(players.every((p) => p.stack >= 0)).toBe(true);
    expect(p0.handName).toContain(String(expectedValue).padStart(3, '0'));

    const winners = game.lastResult?.winners ?? [];
    expect(winners.some((w) => w.label === 'Poker')).toBe(true);
    expect(winners.some((w) => w.label === 'Number')).toBe(true);
    // Split-pot variant: every contender reveals ("beats best" is ambiguous across
    // two independent competitions).
    for (const p of players) expect(p.shownCards?.length).toBe(p.holeCards.length);
  });

  it('force-resolve auto-picks the closest number for stragglers', () => {
    const players = makePlayers([1000, 1000]);
    const before = totalChips(players);
    const game = new PokerGame(players, { smallBlind: 5, bigBlind: 10 }, 0, 1, VARIANTS.triple9, 999);
    let guard = 0;
    while (!game.isComplete() && !game.awaitingSelection && guard++ < 200) {
      const id = game.currentActorId;
      if (!id) break;
      const av = game.availableActionsFor(id)!;
      game.applyAction(id, av.canCheck ? { type: 'check' } : { type: 'call' });
    }
    expect(game.awaitingSelection).toBe(true);
    game.forceResolve();
    expect(game.isComplete()).toBe(true);
    expect(totalChips(players)).toBe(before);
  });

  it('defaults the target to 0 when none is supplied', () => {
    const players = makePlayers([1000, 1000]);
    const game = new PokerGame(players, { smallBlind: 5, bigBlind: 10 }, 0, 1, VARIANTS.triple9);
    expect(game.tripleNineTarget).toBe(0);
  });
});
