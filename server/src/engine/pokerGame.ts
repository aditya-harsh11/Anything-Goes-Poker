import {
  type Card,
  type GamePhase,
  type PlayerStatus,
  type PublicGameState,
  type PotInfo,
  type AvailableActions,
  type HandResult,
  type PlayerAction,
  type VariantConfig,
} from '@poker/shared';
import { Deck } from './deck';
import {
  solve,
  describe,
  compareHands,
  winnersAmong,
  handFromSelection,
  bestSelection,
  type SolvedHand,
} from './handEvaluator';
import { buildPots, type Contribution } from './sidePots';
import { evaluateBlackjack, blackjackWinners, type BlackjackHand } from './blackjack';

/** Fixed ante posted by every player in a bomb pot. */
const BOMB_ANTE = 50;

/** Structural view of a player the engine reads/mutates (ServerPlayer satisfies this). */
export interface HandPlayer {
  id: string;
  name: string;
  seat: number;
  stack: number;
  status: PlayerStatus;
  committedThisRound: number;
  totalCommitted: number;
  inHand: boolean;
  holeCards: Card[];
  shownCards?: number[];
  lastAction?: string;
  handName?: string;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/** Runs a single hand of the given variant over a fixed set of participants. */
export class PokerGame {
  phase: GamePhase = 'preflop';
  board: Card[] = [];
  /** Bomb pots: the second board. */
  board2: Card[] = [];
  handNumber: number;
  lastResult: HandResult | null = null;
  smallBlindSeat = -1;
  bigBlindSeat = -1;

  /** Manual-select variants: at showdown, contenders choose which hole cards to use. */
  awaitingSelection = false;
  /** Crazy Pineapple: after the flop, contenders must discard a card. */
  awaitingDiscard = false;
  /** Private coaching notes ("you could have made X"), keyed by player id. */
  notes = new Map<string, string>();

  private deck = new Deck();
  private seats: HandPlayer[];
  private buttonIndex: number;
  private sb: number;
  private bb: number;
  private variant: VariantConfig;

  private currentBet = 0;
  private minRaise: number;
  private lastFullRaiseBet = 0;
  private toActIndex: number | null = null;
  private actedThisStreet = new Set<string>();
  private lastActedBet = new Map<string, number>();
  private selections = new Map<string, number[]>();
  private discardDone = false;
  private complete = false;

  constructor(
    participants: HandPlayer[],
    opts: { smallBlind: number; bigBlind: number },
    buttonIndex: number,
    handNumber: number,
    variant: VariantConfig,
  ) {
    this.seats = participants;
    this.buttonIndex = buttonIndex;
    this.sb = opts.smallBlind;
    this.bb = opts.bigBlind;
    this.minRaise = opts.bigBlind;
    this.handNumber = handNumber;
    this.variant = variant;

    for (const p of this.seats) {
      p.status = 'active';
      p.committedThisRound = 0;
      p.totalCommitted = 0;
      p.inHand = true;
      p.holeCards = [];
      p.lastAction = undefined;
      p.handName = undefined;
    }

    if (this.variant.bombPot) {
      this.deal();
      this.postAntes();
      this.dealBombFlops();
      this.openFlopBetting();
    } else {
      this.postBlinds();
      this.deal();
      this.openPreflopBetting();
    }
  }

  // ---- setup --------------------------------------------------------------

  /** Bomb pots: everyone antes straight into the pot (no blinds, no preflop). */
  private postAntes(): void {
    const ante = BOMB_ANTE;
    for (const p of this.seats) {
      const pay = Math.min(ante, p.stack);
      p.stack -= pay;
      p.totalCommitted += pay;
      p.lastAction = 'Ante';
      if (p.stack === 0) p.status = 'allin';
    }
    this.currentBet = 0;
    this.minRaise = this.bb;
    this.lastFullRaiseBet = 0;
  }

  private dealBombFlops(): void {
    this.phase = 'flop';
    this.board.push(...this.deck.drawMany(3));
    this.board2.push(...this.deck.drawMany(3));
  }

  private openFlopBetting(): void {
    this.toActIndex = this.nextUnsettledIndex(this.buttonIndex);
    if (this.toActIndex === null) this.endRound();
  }

  private postBlinds(): void {
    const n = this.seats.length;
    const sbIndex = n === 2 ? this.buttonIndex : (this.buttonIndex + 1) % n;
    const bbIndex = n === 2 ? (this.buttonIndex + 1) % n : (this.buttonIndex + 2) % n;
    this.smallBlindSeat = this.seats[sbIndex].seat;
    this.bigBlindSeat = this.seats[bbIndex].seat;
    this.postBlind(sbIndex, this.sb, 'SB');
    this.postBlind(bbIndex, this.bb, 'BB');
    this.currentBet = Math.max(...this.seats.map((p) => p.committedThisRound));
    this.lastFullRaiseBet = this.bb;
    this.minRaise = this.bb;
  }

  private postBlind(index: number, amount: number, label: string): void {
    const p = this.seats[index];
    const pay = Math.min(amount, p.stack);
    p.stack -= pay;
    p.committedThisRound = pay;
    p.totalCommitted = pay;
    p.lastAction = label;
    if (p.stack === 0) p.status = 'allin';
  }

  private deal(): void {
    for (let r = 0; r < this.variant.holeCards; r++) {
      for (const p of this.seats) p.holeCards.push(this.deck.draw());
    }
  }

  private openPreflopBetting(): void {
    const n = this.seats.length;
    const bbIndex = n === 2 ? (this.buttonIndex + 1) % n : (this.buttonIndex + 2) % n;
    this.toActIndex = this.nextUnsettledIndex(bbIndex);
    if (this.toActIndex === null) this.endRound();
  }

  // ---- turn / settlement helpers -----------------------------------------

  private isSettled(p: HandPlayer): boolean {
    if (p.status === 'folded' || p.status === 'allin') return true;
    return p.committedThisRound === this.currentBet && this.actedThisStreet.has(p.id);
  }

  private roundComplete(): boolean {
    return this.seats.every((p) => this.isSettled(p));
  }

  private nextUnsettledIndex(fromExclusive: number): number | null {
    const n = this.seats.length;
    for (let k = 1; k <= n; k++) {
      const idx = (fromExclusive + k) % n;
      const p = this.seats[idx];
      if (p.status === 'folded' || p.status === 'allin') continue;
      if (!this.isSettled(p)) return idx;
    }
    return null;
  }

  private contenders(): HandPlayer[] {
    return this.seats.filter((p) => p.status !== 'folded');
  }

  private ableToAct(): HandPlayer[] {
    return this.seats.filter((p) => p.status !== 'folded' && p.status !== 'allin' && p.stack > 0);
  }

  private potTotal(): number {
    return this.seats.reduce((sum, p) => sum + p.totalCommitted, 0);
  }

  // ---- public queries -----------------------------------------------------

  get currentActorId(): string | null {
    if (this.complete || this.toActIndex === null) return null;
    return this.seats[this.toActIndex].id;
  }

  isComplete(): boolean {
    return this.complete;
  }

  isContender(id: string): boolean {
    const p = this.seats.find((s) => s.id === id);
    return !!p && p.status !== 'folded';
  }

  /** At showdown, all-in players can't muck — force their cards face-up. */
  private forceShowAllIns(): void {
    for (const p of this.seats) {
      if (p.status === 'allin' && p.holeCards.length > 0) {
        p.shownCards = p.holeCards.map((_, i) => i);
      }
    }
  }

  hasSelected(id: string): boolean {
    return this.selections.has(id);
  }

  getSelection(id: string): number[] | undefined {
    return this.selections.get(id);
  }

  availableActionsFor(playerId: string): AvailableActions | null {
    if (this.complete || this.toActIndex === null) return null;
    const p = this.seats[this.toActIndex];
    if (p.id !== playerId) return null;

    const toCall = this.currentBet - p.committedThisRound;
    const canCheck = toCall <= 0;
    const canCall = toCall > 0 && p.stack > 0;
    const callAmount = Math.min(Math.max(toCall, 0), p.stack);

    const allInTo = p.committedThisRound + p.stack;
    let maxRaiseTo = allInTo;
    if (this.variant.bettingStructure === 'pot-limit') {
      // Pot-limit cap: raise-to = currentBet + (pot before action) + (amount to call).
      const potLimitTo = this.currentBet + this.potTotal() + Math.max(toCall, 0);
      maxRaiseTo = Math.min(allInTo, potLimitTo);
    }

    const hasRoom = maxRaiseTo > this.currentBet;
    const reopened =
      !this.actedThisStreet.has(p.id) || this.lastFullRaiseBet > (this.lastActedBet.get(p.id) ?? -1);
    const canAggress = p.stack > 0 && hasRoom && reopened;
    const isBet = this.currentBet === 0;
    const minRaiseTo = Math.min(maxRaiseTo, this.currentBet + this.minRaise);

    return {
      canFold: true,
      canCheck,
      canCall,
      callAmount,
      canBet: isBet && canAggress,
      canRaise: !isBet && canAggress,
      minRaiseTo,
      maxRaiseTo,
    };
  }

  publicState(): PublicGameState {
    const contribs: Contribution[] = this.seats.map((p) => ({
      id: p.id,
      amount: p.totalCommitted,
      folded: p.status === 'folded',
    }));
    const pots: PotInfo[] = buildPots(contribs).map((p) => ({ amount: p.amount, eligible: p.eligible }));
    return {
      phase: this.phase,
      communityCards: this.board,
      communityCards2: this.board2,
      pots,
      totalPot: this.potTotal(),
      currentBet: this.currentBet,
      minRaise: this.minRaise,
      toAct: this.currentActorId,
      awaitingSelection: this.awaitingSelection,
      awaitingDiscard: this.awaitingDiscard,
      dealerSeat: this.seats[this.buttonIndex]?.seat ?? null,
      smallBlindSeat: this.smallBlindSeat >= 0 ? this.smallBlindSeat : null,
      bigBlindSeat: this.bigBlindSeat >= 0 ? this.bigBlindSeat : null,
      smallBlind: this.sb,
      bigBlind: this.bb,
      handNumber: this.handNumber,
    };
  }

  // ---- actions ------------------------------------------------------------

  applyAction(playerId: string, action: PlayerAction): ActionResult {
    if (this.complete || this.toActIndex === null) return { ok: false, error: 'no action expected' };
    const p = this.seats[this.toActIndex];
    if (p.id !== playerId) return { ok: false, error: 'not your turn' };

    const av = this.availableActionsFor(playerId);
    if (!av) return { ok: false, error: 'not your turn' };

    switch (action.type) {
      case 'fold':
        p.status = 'folded';
        p.lastAction = 'Fold';
        break;

      case 'check':
        if (!av.canCheck) return { ok: false, error: 'cannot check' };
        p.lastAction = 'Check';
        break;

      case 'call': {
        if (!av.canCall) return { ok: false, error: 'cannot call' };
        const pay = av.callAmount;
        p.stack -= pay;
        p.committedThisRound += pay;
        p.totalCommitted += pay;
        if (p.stack === 0) p.status = 'allin';
        p.lastAction = p.status === 'allin' ? 'Call (all-in)' : 'Call';
        break;
      }

      case 'bet':
      case 'raise': {
        const allowed = action.type === 'bet' ? av.canBet : av.canRaise;
        if (!allowed) return { ok: false, error: `cannot ${action.type}` };
        const to = Math.floor(action.amount);
        if (to < av.minRaiseTo || to > av.maxRaiseTo) {
          return { ok: false, error: `${action.type} must be between ${av.minRaiseTo} and ${av.maxRaiseTo}` };
        }
        const pay = to - p.committedThisRound;
        p.stack -= pay;
        p.committedThisRound = to;
        p.totalCommitted += pay;
        const increment = to - this.currentBet;
        const isFullRaise = increment >= this.minRaise;
        this.currentBet = to;
        if (isFullRaise) {
          this.minRaise = increment;
          this.lastFullRaiseBet = to;
        }
        if (p.stack === 0) p.status = 'allin';
        const verb = action.type === 'bet' ? 'Bet' : 'Raise to';
        p.lastAction = p.status === 'allin' ? `${verb} ${to} (all-in)` : `${verb} ${to}`;
        break;
      }

      default:
        return { ok: false, error: 'unknown action' };
    }

    this.actedThisStreet.add(p.id);
    this.lastActedBet.set(p.id, this.currentBet);
    this.resolveAfterAction();
    return { ok: true };
  }

  /** Fold a player out of turn (host removed them mid-hand). */
  forceFold(playerId: string): void {
    if (this.complete) return;
    const idx = this.seats.findIndex((p) => p.id === playerId);
    if (idx === -1) return;
    const p = this.seats[idx];
    if (p.status === 'folded' || p.status === 'allin') return;
    p.status = 'folded';
    p.lastAction = 'Fold';
    if (this.toActIndex === idx) {
      this.resolveAfterAction();
    } else if (this.contenders().length <= 1) {
      this.endHandByFold();
    }
  }

  // ---- round / street progression ----------------------------------------

  private resolveAfterAction(): void {
    if (this.contenders().length <= 1) {
      this.endHandByFold();
      return;
    }
    if (this.roundComplete()) {
      this.endRound();
      return;
    }
    const from = this.toActIndex ?? this.buttonIndex;
    this.toActIndex = this.nextUnsettledIndex(from);
    if (this.toActIndex === null) this.endRound();
  }

  private endRound(): void {
    this.returnUncalledBet();
    if (this.contenders().length <= 1) {
      this.endHandByFold();
      return;
    }
    this.startNextStreet();
  }

  /** Return the uncalled portion of a bet to the lone top bettor (e.g. shove over a short all-in). */
  private returnUncalledBet(): void {
    const live = this.contenders();
    if (live.length === 0) return;
    const sorted = [...live].sort((a, b) => b.committedThisRound - a.committedThisRound);
    const top = sorted[0];
    const second = sorted[1]?.committedThisRound ?? 0;
    if (top.committedThisRound > second) {
      const refund = top.committedThisRound - second;
      top.stack += refund;
      top.committedThisRound -= refund;
      top.totalCommitted -= refund;
      if (top.status === 'allin' && top.stack > 0) top.status = 'active';
    }
  }

  private startNextStreet(): void {
    for (;;) {
      if (this.phase === 'river') {
        this.goToShowdown();
        return;
      }
      this.dealNextStreet();
      // Crazy Pineapple: after the flop, pause for everyone to discard before betting.
      if (this.phase === 'flop' && this.variant.discardAfterFlop > 0 && !this.discardDone) {
        this.awaitingDiscard = true;
        return;
      }
      this.resetStreetBetting();
      if (this.ableToAct().length >= 2) {
        this.toActIndex = this.nextUnsettledIndex(this.buttonIndex);
        if (this.toActIndex !== null) return;
      }
      // Nobody (or only one) can act this street — deal the next one (all-in run-out).
    }
  }

  private targetHoleCards(): number {
    return this.variant.holeCards - this.variant.discardAfterFlop;
  }

  /** Crazy Pineapple: a player discards one of their hole cards after the flop. */
  submitDiscard(playerId: string, index: number): ActionResult {
    if (!this.awaitingDiscard) return { ok: false, error: 'no discard expected' };
    const p = this.seats.find((s) => s.id === playerId);
    if (!p || p.status === 'folded') return { ok: false, error: 'not in the hand' };
    if (p.holeCards.length <= this.targetHoleCards()) return { ok: false, error: 'already discarded' };
    if (!Number.isInteger(index) || index < 0 || index >= p.holeCards.length) {
      return { ok: false, error: 'bad card index' };
    }
    p.holeCards.splice(index, 1);
    if (this.contenders().every((c) => c.holeCards.length <= this.targetHoleCards())) {
      this.resumeAfterDiscard();
    }
    return { ok: true };
  }

  mustDiscard(playerId: string): boolean {
    if (!this.awaitingDiscard) return false;
    const p = this.seats.find((s) => s.id === playerId);
    return !!p && p.status !== 'folded' && p.holeCards.length > this.targetHoleCards();
  }

  private resumeAfterDiscard(): void {
    this.discardDone = true;
    this.awaitingDiscard = false;
    this.resetStreetBetting();
    if (this.ableToAct().length >= 2) {
      const idx = this.nextUnsettledIndex(this.buttonIndex);
      if (idx !== null) {
        this.toActIndex = idx;
        return;
      }
    }
    // No flop betting possible (all-in run-out) — continue dealing the remaining streets.
    this.startNextStreet();
  }

  private dealNextStreet(): void {
    const bomb = this.variant.bombPot;
    if (this.phase === 'preflop') {
      this.phase = 'flop';
      this.board.push(...this.deck.drawMany(3));
      if (bomb) this.board2.push(...this.deck.drawMany(3));
    } else if (this.phase === 'flop') {
      this.phase = 'turn';
      this.board.push(this.deck.draw());
      if (bomb) this.board2.push(this.deck.draw());
    } else if (this.phase === 'turn') {
      this.phase = 'river';
      this.board.push(this.deck.draw());
      if (bomb) this.board2.push(this.deck.draw());
    }
  }

  private resetStreetBetting(): void {
    this.currentBet = 0;
    this.minRaise = this.bb;
    this.lastFullRaiseBet = 0;
    this.actedThisStreet.clear();
    this.lastActedBet.clear();
    for (const p of this.seats) {
      p.committedThisRound = 0;
      if (p.status === 'active') p.lastAction = undefined;
    }
  }

  // ---- hand resolution ----------------------------------------------------

  private endHandByFold(): void {
    const winner = this.contenders()[0];
    const pot = this.potTotal();
    if (winner) winner.stack += pot;
    this.phase = 'showdown';
    this.toActIndex = null;
    this.complete = true;
    this.lastResult = {
      handNumber: this.handNumber,
      board: this.board,
      winners: winner ? [{ playerId: winner.id, name: winner.name, amount: pot }] : [],
      revealed: [],
    };
  }

  private goToShowdown(): void {
    this.phase = 'showdown';
    this.toActIndex = null;
    const contenders = this.contenders();
    if (this.variant.bombPot) {
      this.resolveBombShowdown(contenders);
      return;
    }
    if (this.variant.manualSelect && contenders.length > 1) {
      // Pause for players to choose which hole cards to use.
      this.awaitingSelection = true;
      return;
    }
    this.resolveAutoShowdown(contenders);
  }

  /** Bomb pot: split each pot in half between the best hand on each of the two boards. */
  private resolveBombShowdown(contenders: HandPlayer[]): void {
    const counts = this.variant.allowedHoleCounts;
    const solvedA = new Map<string, SolvedHand>();
    const solvedB = new Map<string, SolvedHand>();
    for (const p of contenders) {
      const a = bestSelection(p.holeCards, this.board, counts).hand;
      const b = bestSelection(p.holeCards, this.board2, counts).hand;
      solvedA.set(p.id, { id: p.id, hand: a });
      solvedB.set(p.id, { id: p.id, hand: b });
      p.handName = `${describe(a)} (A) · ${describe(b)} (B)`;
    }

    const contribs: Contribution[] = this.seats.map((p) => ({
      id: p.id,
      amount: p.totalCommitted,
      folded: p.status === 'folded',
    }));
    const pots = buildPots(contribs);

    const winsA = new Map<string, number>();
    const winsB = new Map<string, number>();
    for (const pot of pots) {
      const halfA = Math.ceil(pot.amount / 2); // odd chip goes to board A
      const halfB = pot.amount - halfA;
      this.awardBombHalf(pot.eligible, solvedA, halfA, winsA);
      this.awardBombHalf(pot.eligible, solvedB, halfB, winsB);
    }

    const apply = (m: Map<string, number>) => {
      for (const [id, amt] of m) {
        const p = this.seats.find((s) => s.id === id);
        if (p) p.stack += amt;
      }
    };
    apply(winsA);
    apply(winsB);

    const nameOf = (id: string) => this.seats.find((s) => s.id === id)?.name ?? '';
    const winners: HandResult['winners'] = [
      ...[...winsA.entries()].map(([id, amount]) => ({ playerId: id, name: nameOf(id), amount, board: 'A' as const })),
      ...[...winsB.entries()].map(([id, amount]) => ({ playerId: id, name: nameOf(id), amount, board: 'B' as const })),
    ];

    this.phase = 'showdown';
    this.toActIndex = null;
    this.complete = true;
    this.forceShowAllIns();
    this.lastResult = {
      handNumber: this.handNumber,
      board: this.board,
      board2: this.board2,
      winners,
      revealed: [],
    };
  }

  private awardBombHalf(
    eligibleIds: string[],
    solved: Map<string, SolvedHand>,
    amount: number,
    out: Map<string, number>,
  ): void {
    if (amount <= 0) return;
    const eligible = eligibleIds
      .map((id) => solved.get(id))
      .filter((s): s is SolvedHand => !!s);
    const winnerIds = winnersAmong(eligible);
    if (winnerIds.length === 0) return;
    const ordered = this.orderByPosition(winnerIds);
    const base = Math.floor(amount / ordered.length);
    let remainder = amount - base * ordered.length;
    for (const id of ordered) {
      let share = base;
      if (remainder > 0) {
        share += 1;
        remainder -= 1;
      }
      out.set(id, (out.get(id) ?? 0) + share);
    }
  }

  /** Auto showdown (Texas): engine forms the best hand for each contender. */
  private resolveAutoShowdown(contenders: HandPlayer[]): void {
    const solved = new Map<string, SolvedHand>();
    for (const p of contenders) {
      solved.set(p.id, { id: p.id, hand: solve(p.holeCards, this.board) });
    }
    this.awardFromSolved(solved);
  }

  /** A player locks in which hole cards to use (manual-select variants). */
  submitSelection(playerId: string, indices: number[]): ActionResult {
    if (!this.awaitingSelection) return { ok: false, error: 'no selection expected' };
    const p = this.seats.find((s) => s.id === playerId);
    if (!p || p.status === 'folded') return { ok: false, error: 'not in the hand' };
    if (this.selections.has(playerId)) return { ok: false, error: 'already selected' };

    const valid = [...new Set(indices)]
      .filter((i) => Number.isInteger(i) && i >= 0 && i < p.holeCards.length)
      .sort((a, b) => a - b);
    if (!this.variant.allowedHoleCounts.includes(valid.length)) {
      return { ok: false, error: 'illegal number of cards selected' };
    }

    this.selections.set(playerId, valid);
    this.maybeResolveSelections();
    return { ok: true };
  }

  /** Host can force progress if someone is slow/disconnected (auto-picks for them). */
  forceResolve(): void {
    if (this.awaitingDiscard) {
      // Auto-discard the trailing card(s) for anyone who hasn't.
      for (const p of this.contenders()) {
        while (p.holeCards.length > this.targetHoleCards()) p.holeCards.pop();
      }
      this.resumeAfterDiscard();
      return;
    }
    if (!this.awaitingSelection) return;
    for (const p of this.contenders()) {
      if (!this.selections.has(p.id)) {
        this.selections.set(p.id, bestSelection(p.holeCards, this.board, this.variant.allowedHoleCounts).indices);
      }
    }
    this.resolveSelectedShowdown();
  }

  private maybeResolveSelections(): void {
    const contenders = this.contenders();
    if (contenders.every((p) => this.selections.has(p.id))) {
      this.resolveSelectedShowdown();
    }
  }

  private resolveSelectedShowdown(): void {
    this.awaitingSelection = false;
    if (this.variant.blackjack) {
      this.resolveBlackjackShowdown();
      return;
    }
    const contenders = this.contenders();
    const solved = new Map<string, SolvedHand>();
    const playedBest = new Set<string>();
    for (const p of contenders) {
      const chosen = this.selections.get(p.id);
      const sel = chosen ?? bestSelection(p.holeCards, this.board, this.variant.allowedHoleCounts).indices;
      const hand = handFromSelection(p.holeCards, sel, this.board);
      solved.set(p.id, { id: p.id, hand });

      // Advisor: privately note if a meaningfully stronger hand was available
      // (skip kicker-only improvements, which would read as the same hand name).
      const best = bestSelection(p.holeCards, this.board, this.variant.allowedHoleCounts);
      const better = compareHands(best.hand, hand) > 0 && describe(best.hand) !== describe(hand);
      if (better) {
        this.notes.set(p.id, `You played ${describe(hand)} — you could have made ${describe(best.hand)}.`);
      } else if (chosen) {
        // They made an explicit choice and it was already optimal.
        playedBest.add(p.id);
      }
    }
    this.awaitingSelection = false;
    this.awardFromSolved(solved);
    // Drop the "could have made more" nudge for winners (they won — no need).
    for (const w of this.lastResult?.winners ?? []) {
      if (!playedBest.has(w.playerId)) this.notes.delete(w.playerId);
    }
    // Praise players who squeezed the best possible hand out of their cards.
    for (const id of playedBest) {
      this.notes.set(id, 'Nicely played — the best hand your cards could make.');
    }
  }

  /** Build side pots, award to the best eligible solved hands, and finish the hand. */
  private awardFromSolved(solved: Map<string, SolvedHand>): void {
    for (const [id, s] of solved) {
      const p = this.seats.find((x) => x.id === id);
      if (p) p.handName = describe(s.hand);
    }
    const contribs: Contribution[] = this.seats.map((p) => ({
      id: p.id,
      amount: p.totalCommitted,
      folded: p.status === 'folded',
    }));
    const pots = buildPots(contribs);

    const winningsById = new Map<string, number>();
    for (const pot of pots) {
      const eligibleSolved = pot.eligible
        .map((id) => solved.get(id))
        .filter((s): s is SolvedHand => !!s);
      const winnerIds = winnersAmong(eligibleSolved);
      if (winnerIds.length === 0) continue;
      const ordered = this.orderByPosition(winnerIds);
      const base = Math.floor(pot.amount / ordered.length);
      let remainder = pot.amount - base * ordered.length;
      for (const id of ordered) {
        let share = base;
        if (remainder > 0) {
          share += 1;
          remainder -= 1;
        }
        winningsById.set(id, (winningsById.get(id) ?? 0) + share);
      }
    }

    for (const [id, amount] of winningsById) {
      const p = this.seats.find((s) => s.id === id);
      if (p) p.stack += amount;
    }

    const winners = [...winningsById.entries()].map(([id, amount]) => {
      const p = this.seats.find((s) => s.id === id)!;
      return { playerId: id, name: p.name, amount };
    });

    this.phase = 'showdown';
    this.toActIndex = null;
    this.complete = true;
    this.forceShowAllIns();
    this.lastResult = { handNumber: this.handNumber, board: this.board, winners, revealed: [] };
  }

  /** Blackjack Hold'em: split each pot between the best poker hand and the best blackjack hand. */
  private resolveBlackjackShowdown(): void {
    const contenders = this.contenders();
    const pokerSolved = new Map<string, SolvedHand>();
    const bjByPlayer = new Map<string, BlackjackHand>();
    for (const p of contenders) {
      const sel = this.selections.get(p.id) ?? bestSelection(p.holeCards, this.board, [2]).indices;
      const bjCards = p.holeCards.filter((_, i) => !sel.includes(i));
      const pokerHand = handFromSelection(p.holeCards, sel, this.board);
      const bj = evaluateBlackjack(bjCards);
      pokerSolved.set(p.id, { id: p.id, hand: pokerHand });
      bjByPlayer.set(p.id, bj);
      p.handName = `${describe(pokerHand)} · BJ ${bj.total}${bj.isNatural ? ' (blackjack!)' : ''}`;
    }

    const contribs: Contribution[] = this.seats.map((p) => ({
      id: p.id,
      amount: p.totalCommitted,
      folded: p.status === 'folded',
    }));
    const pots = buildPots(contribs);

    const winsPoker = new Map<string, number>();
    const winsBj = new Map<string, number>();
    for (const pot of pots) {
      const halfPoker = Math.ceil(pot.amount / 2); // odd chip to the poker half
      const halfBj = pot.amount - halfPoker;
      this.awardBombHalf(pot.eligible, pokerSolved, halfPoker, winsPoker);
      this.awardBlackjackHalf(pot.eligible, bjByPlayer, halfBj, winsBj);
    }

    const apply = (m: Map<string, number>) => {
      for (const [id, amt] of m) {
        const p = this.seats.find((s) => s.id === id);
        if (p) p.stack += amt;
      }
    };
    apply(winsPoker);
    apply(winsBj);

    const nameOf = (id: string) => this.seats.find((s) => s.id === id)?.name ?? '';
    const winners: HandResult['winners'] = [
      ...[...winsPoker.entries()].map(([id, amount]) => ({ playerId: id, name: nameOf(id), amount, label: 'Poker' })),
      ...[...winsBj.entries()].map(([id, amount]) => ({ playerId: id, name: nameOf(id), amount, label: 'Blackjack' })),
    ];

    this.phase = 'showdown';
    this.toActIndex = null;
    this.complete = true;
    this.forceShowAllIns();
    this.lastResult = { handNumber: this.handNumber, board: this.board, winners, revealed: [] };
  }

  private awardBlackjackHalf(
    eligibleIds: string[],
    bjByPlayer: Map<string, BlackjackHand>,
    amount: number,
    out: Map<string, number>,
  ): void {
    if (amount <= 0) return;
    const entries = eligibleIds
      .map((id) => ({ id, hand: bjByPlayer.get(id) }))
      .filter((e): e is { id: string; hand: BlackjackHand } => !!e.hand);
    const winnerIds = blackjackWinners(entries);
    if (winnerIds.length === 0) return;
    const ordered = this.orderByPosition(winnerIds);
    const base = Math.floor(amount / ordered.length);
    let remainder = amount - base * ordered.length;
    for (const id of ordered) {
      let share = base;
      if (remainder > 0) {
        share += 1;
        remainder -= 1;
      }
      out.set(id, (out.get(id) ?? 0) + share);
    }
  }

  /** Order winner ids by position starting just left of the button (for odd-chip distribution). */
  private orderByPosition(ids: string[]): string[] {
    const n = this.seats.length;
    const ordered: string[] = [];
    for (let k = 1; k <= n; k++) {
      const idx = (this.buttonIndex + k) % n;
      const p = this.seats[idx];
      if (ids.includes(p.id)) ordered.push(p.id);
    }
    return ordered.length === ids.length ? ordered : ids;
  }
}
