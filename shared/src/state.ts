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
  /** Legal actions for the recipient right now (empty if it's not their turn). */
  availableActions?: AvailableActions;
  /** True when the recipient must choose which of their hole cards to use (manual-select showdown). */
  youMustSelect?: boolean;
  /** True when the recipient must discard a card after the flop (Crazy Pineapple). */
  youMustDiscard?: boolean;
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
