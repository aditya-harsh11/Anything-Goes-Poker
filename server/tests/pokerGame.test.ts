import { describe, it, expect } from 'vitest';
import { VARIANTS } from '@poker/shared';
import { PokerGame, type HandPlayer } from '../src/engine/pokerGame';

function makePlayers(stacks: number[]): HandPlayer[] {
  return stacks.map((stack, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    seat: i,
    stack,
    status: 'seated',
    committedThisRound: 0,
    totalCommitted: 0,
    inHand: false,
    holeCards: [],
  }));
}

const totalChips = (players: HandPlayer[]) => players.reduce((s, p) => s + p.stack, 0);

/** Play passively to completion: check when possible, otherwise call. */
function playPassive(game: PokerGame, players: HandPlayer[]) {
  let guard = 0;
  while (!game.isComplete() && guard++ < 200) {
    const actorId = game.currentActorId;
    if (!actorId) break;
    const av = game.availableActionsFor(actorId)!;
    if (av.canCheck) game.applyAction(actorId, { type: 'check' });
    else game.applyAction(actorId, { type: 'call' });
  }
}

describe('PokerGame betting', () => {
  it('conserves chips through a passive hand to showdown', () => {
    const players = makePlayers([1000, 1000, 1000]);
    const before = totalChips(players);
    const game = new PokerGame(players, { smallBlind: 5, bigBlind: 10 }, 0, 1, VARIANTS.texas);
    playPassive(game, players);
    expect(game.isComplete()).toBe(true);
    expect(totalChips(players)).toBe(before);
    expect(players.every((p) => p.stack >= 0)).toBe(true);
  });

  it('awards the blinds to the big blind when everyone folds preflop', () => {
    const players = makePlayers([1000, 1000, 1000]);
    const game = new PokerGame(players, { smallBlind: 5, bigBlind: 10 }, 0, 1, VARIANTS.texas);
    // Heads-around folding: keep folding the actor until the hand ends.
    let guard = 0;
    while (!game.isComplete() && guard++ < 50) {
      const actorId = game.currentActorId!;
      game.applyAction(actorId, { type: 'fold' });
    }
    expect(game.isComplete()).toBe(true);
    expect(totalChips(players)).toBe(3000);
    // BB is seat 2 (button=0 -> SB=1, BB=2); they should be up by the small blind (5).
    const bb = players[2];
    expect(bb.stack).toBe(1005);
    expect(game.lastResult?.winners[0]?.playerId).toBe('p2');
  });

  it('rejects a raise below the minimum and illegal turn order', () => {
    const players = makePlayers([1000, 1000]);
    const game = new PokerGame(players, { smallBlind: 5, bigBlind: 10 }, 0, 1, VARIANTS.texas);
    // Heads-up: button (p0) is SB and acts first preflop. currentBet=10, minRaise=10 => min raise-to is 20.
    const actor = game.currentActorId;
    expect(actor).toBe('p0');
    expect(game.applyAction('p1', { type: 'call' }).ok).toBe(false); // not p1's turn
    expect(game.applyAction('p0', { type: 'raise', amount: 15 }).ok).toBe(false); // below min
    expect(game.applyAction('p0', { type: 'raise', amount: 20 }).ok).toBe(true); // legal min raise
  });

  it('conserves chips and builds side pots when players are all-in for different amounts', () => {
    const players = makePlayers([50, 200, 1000]);
    const before = totalChips(players);
    const game = new PokerGame(players, { smallBlind: 5, bigBlind: 10 }, 0, 1, VARIANTS.texas);
    // Everyone jams / calls all-in.
    let guard = 0;
    while (!game.isComplete() && guard++ < 200) {
      const actorId = game.currentActorId!;
      const av = game.availableActionsFor(actorId)!;
      if (av.canRaise) game.applyAction(actorId, { type: 'raise', amount: av.maxRaiseTo });
      else if (av.canBet) game.applyAction(actorId, { type: 'bet', amount: av.maxRaiseTo });
      else if (av.canCall) game.applyAction(actorId, { type: 'call' });
      else game.applyAction(actorId, { type: 'check' });
    }
    expect(game.isComplete()).toBe(true);
    expect(totalChips(players)).toBe(before);
    expect(players.every((p) => p.stack >= 0)).toBe(true);
  });
});
