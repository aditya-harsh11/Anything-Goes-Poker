import { customAlphabet } from 'nanoid';
import type {
  Card,
  RoomSettings,
  RoomState,
  PublicPlayer,
  PublicGameState,
  JoinRequest,
  PlayerStatus,
  PlayerAction,
} from '@poker/shared';
import { VARIANTS } from '@poker/shared';
import { PokerGame } from '../engine/pokerGame';

const genToken = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 20);
const genId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10);

/** Server-side player record (superset of PublicPlayer — holds secrets + bookkeeping). */
export interface ServerPlayer {
  id: string;
  token: string;
  name: string;
  seat: number;
  stack: number;
  status: PlayerStatus;
  committedThisRound: number;
  totalCommitted: number;
  inHand: boolean;
  holeCards: Card[];
  /** Hole-card indices this player has voluntarily shown after a hand. */
  shownCards: number[];
  lastAction?: string;
  socketId: string | null;
  totalBoughtIn: number;
  isHost: boolean;
}

interface PendingRequest {
  requestId: string;
  name: string;
  buyIn: number;
  socketId: string;
  token: string;
}

export class Room {
  readonly id: string;
  settings: RoomSettings;
  hostId: string;
  players = new Map<string, ServerPlayer>();
  pending = new Map<string, PendingRequest>();

  dealerButton = -1; // seat index of the dealer; -1 until first hand
  handNumber = 0;
  game: PokerGame | null = null;

  constructor(id: string, settings: RoomSettings) {
    this.id = id;
    this.settings = settings;
    this.hostId = '';
  }

  // ---- lobby / membership -------------------------------------------------

  addHost(name: string, socketId: string): ServerPlayer {
    const host = this.makePlayer(name, this.settings.startingStack, socketId, true);
    this.hostId = host.id;
    return host;
  }

  private makePlayer(name: string, buyIn: number, socketId: string, isHost: boolean): ServerPlayer {
    const seat = this.firstFreeSeat();
    const player: ServerPlayer = {
      id: genId(),
      token: genToken(),
      name: name.slice(0, 20) || 'Player',
      seat,
      stack: buyIn,
      status: 'seated',
      committedThisRound: 0,
      totalCommitted: 0,
      inHand: false,
      holeCards: [],
      shownCards: [],
      socketId,
      totalBoughtIn: buyIn,
      isHost,
    };
    this.players.set(player.id, player);
    return player;
  }

  firstFreeSeat(): number {
    const taken = new Set([...this.players.values()].map((p) => p.seat));
    for (let s = 0; s < this.settings.maxSeats; s++) {
      if (!taken.has(s)) return s;
    }
    return -1;
  }

  hasFreeSeat(): boolean {
    return this.firstFreeSeat() !== -1;
  }

  requestJoin(name: string, buyIn: number, socketId: string): PendingRequest {
    const req: PendingRequest = {
      requestId: genId(),
      name: name.slice(0, 20) || 'Player',
      buyIn,
      socketId,
      token: genToken(),
    };
    this.pending.set(req.requestId, req);
    return req;
  }

  approveJoin(requestId: string): ServerPlayer | null {
    const req = this.pending.get(requestId);
    if (!req) return null;
    if (!this.hasFreeSeat()) return null;
    this.pending.delete(requestId);
    const seat = this.firstFreeSeat();
    const player: ServerPlayer = {
      id: req.requestId, // keep id stable so the pending socket's playerId still matches
      token: req.token,
      name: req.name,
      seat,
      stack: req.buyIn,
      status: 'seated',
      committedThisRound: 0,
      totalCommitted: 0,
      inHand: false,
      holeCards: [],
      shownCards: [],
      socketId: req.socketId,
      totalBoughtIn: req.buyIn,
      isHost: false,
    };
    this.players.set(player.id, player);
    return player;
  }

  rejectJoin(requestId: string): PendingRequest | null {
    const req = this.pending.get(requestId);
    if (!req) return null;
    this.pending.delete(requestId);
    return req;
  }

  removePlayer(playerId: string): ServerPlayer | null {
    const player = this.players.get(playerId);
    if (!player) return null;
    // If they're in an active hand, fold them out first.
    if (this.game && player.inHand) {
      this.game.forceFold(playerId);
    }
    this.players.delete(playerId);
    return player;
  }

  setSittingOut(playerId: string, out: boolean): void {
    const p = this.players.get(playerId);
    if (!p) return;
    if (p.inHand) return; // can't change mid-hand; takes effect next hand
    p.status = out ? 'sittingout' : 'seated';
  }

  adjustStack(playerId: string, delta: number): void {
    const p = this.players.get(playerId);
    if (!p) return;
    p.stack = Math.max(0, p.stack + delta);
    if (delta > 0) p.totalBoughtIn += delta;
  }

  setStack(playerId: string, value: number): void {
    const p = this.players.get(playerId);
    if (!p) return;
    const v = Math.max(0, Math.floor(value));
    if (v > p.stack) p.totalBoughtIn += v - p.stack;
    p.stack = v;
  }

  /** Re-bind a reconnecting socket to an existing seat or pending request via its token. */
  reassociate(token: string, socketId: string): { id: string; status: 'seated' | 'pending' } | null {
    for (const p of this.players.values()) {
      if (p.token === token) {
        p.socketId = socketId;
        return { id: p.id, status: 'seated' };
      }
    }
    for (const r of this.pending.values()) {
      if (r.token === token) {
        r.socketId = socketId;
        return { id: r.requestId, status: 'pending' };
      }
    }
    return null;
  }

  // ---- game flow ----------------------------------------------------------

  startHand(): { ok: boolean; error?: string } {
    if (this.game && !this.game.isComplete()) {
      return { ok: false, error: 'a hand is already in progress' };
    }
    const participants = this.eligiblePlayers();
    if (participants.length < 2) {
      return { ok: false, error: 'need at least 2 players with chips' };
    }
    let buttonIdx: number;
    if (this.dealerButton < 0) {
      buttonIdx = 0;
    } else {
      buttonIdx = participants.findIndex((p) => p.seat > this.dealerButton);
      if (buttonIdx === -1) buttonIdx = 0;
    }
    this.dealerButton = participants[buttonIdx].seat;
    this.handNumber++;
    // Clear last hand's cards/reveals for everyone before dealing the new one.
    for (const p of this.players.values()) {
      p.holeCards = [];
      p.shownCards = [];
    }
    this.game = new PokerGame(
      participants,
      { smallBlind: this.settings.smallBlind, bigBlind: this.settings.bigBlind },
      buttonIdx,
      this.handNumber,
      VARIANTS[this.settings.variant],
    );
    this.maybeFinalize();
    return { ok: true };
  }

  applyPlayerAction(playerId: string, action: PlayerAction): { ok: boolean; error?: string } {
    if (!this.game || this.game.isComplete()) return { ok: false, error: 'no active hand' };
    const res = this.game.applyAction(playerId, action);
    if (res.ok) this.maybeFinalize();
    return res;
  }

  /** A player locks in which hole cards to use at a manual-select showdown. */
  selectCards(playerId: string, indices: number[]): void {
    if (!this.game) return;
    this.game.submitSelection(playerId, indices);
    this.maybeFinalize();
  }

  /** Host forces the showdown to resolve (auto-picks best for anyone who hasn't chosen). */
  forceShowdown(): void {
    if (!this.game) return;
    this.game.forceResolve();
    this.maybeFinalize();
  }

  /**
   * When a hand ends, clear betting bookkeeping. Players who reached the end (didn't fold)
   * KEEP their hole cards until the next hand so they can optionally "Show"; folded players
   * muck (cards cleared). Cards are wiped for everyone when the next hand starts.
   */
  private maybeFinalize(): void {
    if (!this.game || !this.game.isComplete()) return;
    for (const p of this.players.values()) {
      if (!p.inHand) continue;
      const folded = p.status === 'folded';
      p.committedThisRound = 0;
      p.totalCommitted = 0;
      p.inHand = false;
      p.lastAction = undefined;
      if (folded) {
        p.holeCards = [];
        p.shownCards = [];
      }
      if (p.status !== 'sittingout') p.status = 'seated';
    }
  }

  /** A player voluntarily reveals some of their hole cards after a hand. */
  showCards(playerId: string, indices: number[]): void {
    if (!this.game || this.game.phase !== 'showdown') return;
    const p = this.players.get(playerId);
    if (!p || p.holeCards.length === 0) return;
    const valid = indices.filter((i) => Number.isInteger(i) && i >= 0 && i < p.holeCards.length);
    p.shownCards = [...new Set([...p.shownCards, ...valid])].sort();
  }

  isHost(playerId: string): boolean {
    return playerId === this.hostId;
  }

  getPlayer(playerId: string): ServerPlayer | undefined {
    return this.players.get(playerId);
  }

  /** Seated, chipped, not-sitting-out players eligible to be dealt into a hand. */
  eligiblePlayers(): ServerPlayer[] {
    return [...this.players.values()]
      .filter((p) => p.status !== 'sittingout' && p.stack > 0)
      .sort((a, b) => a.seat - b.seat);
  }

  isEmpty(): boolean {
    return this.players.size === 0 && this.pending.size === 0;
  }

  // ---- snapshots ----------------------------------------------------------

  private gameStateView(): PublicGameState {
    if (this.game) return this.game.publicState();
    return {
      phase: 'waiting',
      communityCards: [],
      pots: [],
      totalPot: 0,
      currentBet: 0,
      minRaise: this.settings.bigBlind,
      toAct: null,
      awaitingSelection: false,
      dealerSeat: this.dealerButton >= 0 ? this.dealerButton : null,
      smallBlindSeat: null,
      bigBlindSeat: null,
      smallBlind: this.settings.smallBlind,
      bigBlind: this.settings.bigBlind,
      handNumber: this.handNumber,
    };
  }

  private toPublicPlayer(p: ServerPlayer, viewerId: string): PublicPlayer {
    const phase = this.game?.phase;
    const active = phase === 'preflop' || phase === 'flop' || phase === 'turn' || phase === 'river';

    let visible: Card[] | undefined;
    let cardBacks = 0;
    if (p.id === viewerId) {
      // You always see your own cards.
      visible = p.holeCards.length ? p.holeCards : undefined;
    } else if (active) {
      // During play, others' live cards show as face-down backs.
      if (p.status !== 'folded') cardBacks = p.holeCards.length;
    } else {
      // Between hands / showdown: only the cards a player chose to show are visible.
      const shown = p.shownCards.filter((i) => i < p.holeCards.length).map((i) => p.holeCards[i]);
      visible = shown.length ? shown : undefined;
    }

    return {
      id: p.id,
      name: p.name,
      seat: p.seat,
      stack: p.stack,
      status: p.status,
      committedThisRound: p.committedThisRound,
      totalCommitted: p.totalCommitted,
      inHand: p.inHand,
      isDealer: p.seat === this.dealerButton,
      isConnected: p.socketId !== null,
      boughtIn: p.totalBoughtIn,
      netResult: p.stack - p.totalBoughtIn,
      lastAction: p.lastAction,
      holeCards: visible,
      cardBacks,
      shown: p.shownCards,
      hasSelected: this.game?.awaitingSelection ? this.game.hasSelected(p.id) : undefined,
    };
  }

  /** Build the redacted state for a given viewer (a seated player, host, or pending request). */
  snapshotFor(viewerId: string): RoomState {
    const players = [...this.players.values()]
      .sort((a, b) => a.seat - b.seat)
      .map((p) => this.toPublicPlayer(p, viewerId));

    const isPending = this.pending.has(viewerId);
    const isPlayer = this.players.has(viewerId);
    const youAreHost = viewerId === this.hostId;

    const state: RoomState = {
      roomId: this.id,
      hostId: this.hostId,
      settings: this.settings,
      players,
      game: this.gameStateView(),
      youId: viewerId,
      youAreHost,
      youStatus: youAreHost ? 'host' : isPlayer ? 'seated' : isPending ? 'pending' : 'spectator',
      lastResult: this.game?.lastResult ?? undefined,
    };

    if (this.game) {
      if (this.game.awaitingSelection && this.game.isContender(viewerId) && !this.game.hasSelected(viewerId)) {
        state.youMustSelect = true;
      }
      const note = this.game.notes.get(viewerId);
      if (note) state.youNote = note;
    }

    if (youAreHost) {
      const requests: JoinRequest[] = [...this.pending.values()].map((r) => ({
        requestId: r.requestId,
        name: r.name,
        buyIn: r.buyIn,
      }));
      state.joinRequests = requests;
    }

    if (this.game && isPlayer) {
      const actions = this.game.availableActionsFor(viewerId);
      if (actions) state.availableActions = actions;
    }

    return state;
  }

  /** Every socket id that should receive a snapshot, paired with its viewer id. */
  audience(): { socketId: string; viewerId: string }[] {
    const out: { socketId: string; viewerId: string }[] = [];
    for (const p of this.players.values()) {
      if (p.socketId) out.push({ socketId: p.socketId, viewerId: p.id });
    }
    for (const r of this.pending.values()) {
      out.push({ socketId: r.socketId, viewerId: r.requestId });
    }
    return out;
  }
}
