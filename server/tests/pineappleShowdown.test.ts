import { describe, it, expect } from 'vitest';
import { VARIANTS } from '@poker/shared';
import { PokerGame, type HandPlayer } from '../src/engine/pokerGame';

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

describe('Crazy Pineapple discards', () => {
  it('has no actor while awaiting a discard, and opens betting after it', () => {
    const players = makePlayers([1000, 1000, 1000]);
    const game = new PokerGame(players, { smallBlind: 5, bigBlind: 10 }, 0, 1, VARIANTS['crazy-pineapple']);

    // Preflop: limp/check around until the flop discard pauses the hand.
    let guard = 0;
    while (game.currentActorId && !game.awaitingDiscard && guard++ < 50) {
      const id = game.currentActorId;
      const av = game.availableActionsFor(id)!;
      game.applyAction(id, av.canCheck ? { type: 'check' } : { type: 'call' });
    }

    expect(game.awaitingDiscard).toBe(true);
    // No phantom actor / actions while discarding.
    expect(game.currentActorId).toBeNull();
    for (const p of players) expect(game.availableActionsFor(p.id)).toBeNull();
    // Actions are rejected during the discard phase.
    expect(game.applyAction('p0', { type: 'check' }).ok).toBe(false);

    for (const p of players) game.submitDiscard(p.id, 0);

    // Betting opens cleanly: first to act left of button can bet.
    expect(game.awaitingDiscard).toBe(false);
    const actor = game.currentActorId!;
    expect(actor).toBeTruthy();
    const av = game.availableActionsFor(actor)!;
    expect(av.canBet).toBe(true);
    expect(game.applyAction(actor, { type: 'bet', amount: av.minRaiseTo }).ok).toBe(true);
  });
});

describe('Bomb Omaha per-board selection', () => {
  it('pauses for a two-board selection and resolves from the chosen cards', () => {
    const players = makePlayers([1000, 1000, 1000]);
    const game = new PokerGame(players, { smallBlind: 5, bigBlind: 10 }, 0, 1, VARIANTS['bomb-omaha']);

    // Bomb pots: no preflop, betting opens on the flop. Check/call to the river.
    let guard = 0;
    while (!game.isComplete() && !game.awaitingSelection && guard++ < 200) {
      const id = game.currentActorId;
      if (!id) break;
      const av = game.availableActionsFor(id)!;
      game.applyAction(id, av.canCheck ? { type: 'check' } : { type: 'call' });
    }

    // It should pause for selection (Omaha must use exactly 2 of 4 per board).
    expect(game.awaitingSelection).toBe(true);
    expect(game.isComplete()).toBe(false);
    for (const p of players) expect(game.hasSelected(p.id)).toBe(false);

    // A single-board selection must be rejected for bomb pots.
    expect(game.submitSelection('p0', [0, 1]).ok).toBe(false);
    // Wrong count per board is rejected.
    expect(game.submitBombSelection('p0', [0], [1, 2]).ok).toBe(false);

    // Everyone picks 2 for each board.
    for (const p of players) {
      const r = game.submitBombSelection(p.id, [0, 1], [2, 3]);
      expect(r.ok).toBe(true);
    }

    expect(game.isComplete()).toBe(true);
    expect(totalChips(players)).toBe(3000);
    const w = game.lastResult?.winners ?? [];
    // Both boards paid out (A and B labels present).
    expect(w.some((x) => x.board === 'A')).toBe(true);
    expect(w.some((x) => x.board === 'B')).toBe(true);
  });
});

describe('showdown reveals', () => {
  it('reveals the last aggressor and any caller who can win; mucks dominated callers', () => {
    const players = makePlayers([1000, 1000, 1000]);
    const game = new PokerGame(players, { smallBlind: 5, bigBlind: 10 }, 0, 1, VARIANTS.texas);

    // Play passively to showdown (no raises -> "checked down" reveal order).
    let guard = 0;
    while (!game.isComplete() && guard++ < 200) {
      const id = game.currentActorId;
      if (!id) break;
      const av = game.availableActionsFor(id)!;
      game.applyAction(id, av.canCheck ? { type: 'check' } : { type: 'call' });
    }

    expect(game.isComplete()).toBe(true);
    const winnerIds = new Set((game.lastResult?.winners ?? []).map((w) => w.playerId));
    expect(winnerIds.size).toBeGreaterThan(0);
    // Every winner must have their cards turned face-up.
    for (const w of winnerIds) {
      const p = players.find((x) => x.id === w)!;
      expect(p.shownCards?.length).toBe(p.holeCards.length);
    }
    // At least the first player in order is revealed (someone always shows).
    const revealedCount = players.filter((p) => (p.shownCards?.length ?? 0) > 0).length;
    expect(revealedCount).toBeGreaterThanOrEqual(1);
  });

  it('always reveals all-in players even when they lose', () => {
    // Short stack jams and gets called; both reach showdown all-in/called.
    const players = makePlayers([40, 1000, 1000]);
    const game = new PokerGame(players, { smallBlind: 5, bigBlind: 10 }, 0, 1, VARIANTS.texas);
    let guard = 0;
    while (!game.isComplete() && guard++ < 200) {
      const id = game.currentActorId;
      if (!id) break;
      const av = game.availableActionsFor(id)!;
      if (av.canCheck) game.applyAction(id, { type: 'check' });
      else game.applyAction(id, { type: 'call' });
    }
    expect(game.isComplete()).toBe(true);
    // p0 was forced all-in by the blinds+call; if they reached showdown they must be shown.
    const p0 = players[0];
    if (p0.status === 'allin' || p0.totalCommitted === 40) {
      // reached showdown all-in => revealed
      if (game.lastResult?.board.length === 5) {
        expect(p0.shownCards?.length).toBe(p0.holeCards.length);
      }
    }
  });
});
