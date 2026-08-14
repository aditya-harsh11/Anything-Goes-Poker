import type { Card } from './cards';
import type { Variant } from './variants';

export type GamePhase =
  | 'waiting'   // between hands / not enough players
  | 'preflop'
  | 'flop'
  | 'turn'
  | 'river'
  | 'showdown';

export type PlayerStatus =
  | 'seated'      // in the game, will be dealt in next hand
  | 'active'      // in the current hand, still to act / can act
  | 'folded'      // folded this hand
  | 'allin'       // all chips committed this hand
  | 'sittingout'; // seated but skipped until they sit back in

export type YourStatus = 'host' | 'seated' | 'pending' | 'spectator';

export interface RoomSettings {
  variant: Variant;
  smallBlind: number;
  bigBlind: number;
  startingStack: number;
  maxSeats: number; // 2..8
}

/** Host toggle for an automatic, timed action (auto-deal / auto-pick). */
export interface AutoActionSettings {
  enabled: boolean;
  /** Delay before the action fires, in seconds (clamped 3..60 server-side). */
  seconds: number;
}

export interface PublicPlayer {
  id: string;
  name: string;
  seat: number;
  stack: number;
  status: PlayerStatus;
  /** Chips pushed into the pot during the current betting round (the bet "in front"). */
  committedThisRound: number;
  /** Chips committed across the whole current hand. */
  totalCommitted: number;
  /** Holding cards in the current hand. */
  inHand: boolean;
  isDealer: boolean;
  isConnected: boolean;
  /** Total chips this player has bought in (for the ledger). */
  boughtIn: number;
  /** stack - boughtIn, for end-of-session settle-up. */
  netResult: number;
  /** Number of times the host topped this player up after their first buy-in. */
  rebuys: number;
  /** Short label of last action this hand, e.g. "Call", "Raise 200", "Fold". */
  lastAction?: string;
  /** Cards visible to the recipient: their own always; others' only if voluntarily shown. */
  holeCards?: Card[];
  /** Count of face-down cards to render (cards held that the viewer can't see). */
  cardBacks: number;
  /** Hole-card indices this player has publicly shown. */
  shown: number[];
  /** During a manual-select showdown, whether this player has locked in their selection. */
  hasSelected?: boolean;
  /** Evaluated hand name (e.g. "Two Pair") — shown to others only when fully revealed. */
  handName?: string;
}

export interface PotInfo {
  amount: number;
  /** Player ids eligible to win this (main or side) pot. */
  eligible: string[];
}

export interface PublicGameState {
  phase: GamePhase;
  communityCards: Card[];
  /** Bomb pots: the second board (otherwise empty). */
  communityCards2: Card[];
  /** Number (Triple 9): this hand's dealer-set target (0-999), or null outside this variant. */
  tripleNineTarget: number | null;
  pots: PotInfo[];
  totalPot: number;
  /** Highest committedThisRound among players — the amount to match. */
  currentBet: number;
  minRaise: number;
  toAct: string | null;
  /** Manual-select variants: at showdown, contenders are choosing which hole cards to use. */
  awaitingSelection: boolean;
  /** Crazy Pineapple: after the flop, contenders are discarding a card. */
  awaitingDiscard: boolean;
  dealerSeat: number | null;
  smallBlindSeat: number | null;
  bigBlindSeat: number | null;
  smallBlind: number;
  bigBlind: number;
  handNumber: number;
}

export interface JoinRequest {
  requestId: string;
  name: string;
  buyIn: number;
}

export interface HandResult {
  handNumber: number;
  board: Card[];
  /** Bomb pots: the second board. */
  board2?: Card[];
  winners: {
    playerId: string;
    name: string;
    amount: number;
    handName?: string;
    board?: 'A' | 'B';
    label?: string;
  }[];
  /** Hands shown at showdown (omitted when a hand ends by everyone folding). */
  revealed: { playerId: string; name: string; holeCards: Card[]; handName: string }[];
}

/** The per-recipient, redacted snapshot broadcast to each client. */
export interface RoomState {
  roomId: string;
  hostId: string;
  settings: RoomSettings;
  players: PublicPlayer[];
  game: PublicGameState;
  youId: string;
  youAreHost: boolean;
  youStatus: YourStatus;
  /** Player who will be the dealer for the next hand (picks the variant + starts it). */
  nextDealerId?: string | null;
  /** True when the recipient is the upcoming dealer (can choose the game + deal). */
  youAreDealer?: boolean;
  /**
   * True between the host clicking "Start hand" and the dealer locking in a variant.
   * While this is true the dealer is on the clock to pick a variant; once they do
   * the server immediately deals the hand and clears this flag.
   */
  awaitingDealerPick: boolean;
  /**
   * Number (Triple 9) only: true between the dealer picking the variant and locking in
   * this hand's target number. The deal is blocked on it, same as awaitingDealerPick.
   */
  awaitingTripleNineTarget: boolean;
  /** Host-configurable auto-start: when on, the next hand auto-begins after a hand ends. */
  autoStart: AutoActionSettings;
  /**
   * Epoch ms (server clock) at which the next hand will auto-begin, or null when no
   * countdown is running. Clients tick down toward this to show "next hand in Ns".
   */
  autoStartAt?: number | null;
  /** Host-configurable auto-pick: if the dealer doesn't pick a game in time, the server picks for them. */
  autoPick: AutoActionSettings;
  /** Epoch ms at which the dealer's pick will be auto-chosen, or null when not counting down. */
  autoPickAt?: number | null;
  /** Legal actions for the recipient right now (empty if it's not their turn). */
  availableActions?: AvailableActions;
  /** True when the recipient must choose which of their hole cards to use (manual-select showdown). */
  youMustSelect?: boolean;
  /** True when the recipient must discard a card after the flop (Crazy Pineapple). */
  youMustDiscard?: boolean;
  /** The hole-card indices the recipient locked in this hand (so they can see their picks). */
  yourSelection?: number[];
  /** Private coaching note for the recipient, e.g. "you could have made a flush". */
  youNote?: string;
  /** Only populated for the host. */
  joinRequests?: JoinRequest[];
  lastResult?: HandResult;
}

export interface AvailableActions {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canBet: boolean;
  canRaise: boolean;
  /** Minimum legal total amount to bet/raise "to". */
  minRaiseTo: number;
  /** Maximum legal total amount to bet/raise "to" (all-in cap). */
  maxRaiseTo: number;
}
