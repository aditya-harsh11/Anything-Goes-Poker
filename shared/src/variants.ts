export type Variant =
  | 'texas'
  | 'plo'
  | 'dirty-omaha'
  | 'two-or-three'
  | 'all-five'
  | 'one-three-five'
  | 'crazy-pineapple'
  | 'bomb-holdem'
  | 'bomb-omaha'
  | 'blackjack-holdem';

export interface VariantConfig {
  id: Variant;
  name: string;
  description: string;
  /** Number of hole cards dealt to each player. */
  holeCards: number;
  /** Legal counts of hole cards a player may use to form their hand at showdown. */
  allowedHoleCounts: number[];
  /** If true, players manually choose which hole cards to use at showdown. */
  manualSelect: boolean;
  /** Cards each player must discard after the flop is dealt (0 = none). */
  discardAfterFlop: number;
  /** Bomb pot: ante instead of blinds, no preflop, two boards, pot split per board. */
  bombPot: boolean;
  /** Blackjack Hold'em: split 4 cards into 2 for poker + 2 for blackjack; pot split 50/50. */
  blackjack: boolean;
  bettingStructure: 'no-limit' | 'pot-limit';
}

export const VARIANTS: Record<Variant, VariantConfig> = {
  texas: {
    id: 'texas',
    name: "Texas Hold'em",
    description: '2 hole cards. Best five of seven (chosen for you).',
    holeCards: 2,
    allowedHoleCounts: [0, 1, 2],
    manualSelect: false,
    discardAfterFlop: 0,
    bombPot: false,
    blackjack: false,
    bettingStructure: 'no-limit',
  },
  plo: {
    id: 'plo',
    name: 'Pot-Limit Omaha',
    description: '4 hole cards. Use exactly 2. Pot-limit betting.',
    holeCards: 4,
    allowedHoleCounts: [2],
    manualSelect: true,
    discardAfterFlop: 0,
    bombPot: false,
    blackjack: false,
    bettingStructure: 'pot-limit',
  },
  'dirty-omaha': {
    id: 'dirty-omaha',
    name: 'Dirty Omaha',
    description: '4 hole cards. Use any number (even play the board).',
    holeCards: 4,
    allowedHoleCounts: [0, 1, 2, 3, 4],
    manualSelect: true,
    discardAfterFlop: 0,
    bombPot: false,
    blackjack: false,
    bettingStructure: 'no-limit',
  },
  'two-or-three': {
    id: 'two-or-three',
    name: '2-or-3',
    description: '5 hole cards. Use exactly 2 or exactly 3.',
    holeCards: 5,
    allowedHoleCounts: [2, 3],
    manualSelect: true,
    discardAfterFlop: 0,
    bombPot: false,
    blackjack: false,
    bettingStructure: 'no-limit',
  },
  'all-five': {
    id: 'all-five',
    name: 'All 5',
    description: '5 hole cards. Use any number (even play the board).',
    holeCards: 5,
    allowedHoleCounts: [0, 1, 2, 3, 4, 5],
    manualSelect: true,
    discardAfterFlop: 0,
    bombPot: false,
    blackjack: false,
    bettingStructure: 'no-limit',
  },
  'one-three-five': {
    id: 'one-three-five',
    name: '1-3-5',
    description: '5 hole cards. Use exactly 1, 3, or 5.',
    holeCards: 5,
    allowedHoleCounts: [1, 3, 5],
    manualSelect: true,
    discardAfterFlop: 0,
    bombPot: false,
    blackjack: false,
    bettingStructure: 'no-limit',
  },
  'crazy-pineapple': {
    id: 'crazy-pineapple',
    name: 'Crazy Pineapple',
    description: '3 hole cards. Discard 1 after the flop, then play like Hold’em.',
    holeCards: 3,
    allowedHoleCounts: [0, 1, 2],
    manualSelect: false,
    discardAfterFlop: 1,
    bombPot: false,
    blackjack: false,
    bettingStructure: 'no-limit',
  },
  'bomb-holdem': {
    id: 'bomb-holdem',
    name: 'Bomb Pot (Hold’em)',
    description: 'Everyone antes, no preflop, two boards. Pot splits per board — scoop both to win it all.',
    holeCards: 2,
    allowedHoleCounts: [0, 1, 2],
    manualSelect: false,
    discardAfterFlop: 0,
    bombPot: true,
    blackjack: false,
    bettingStructure: 'no-limit',
  },
  'bomb-omaha': {
    id: 'bomb-omaha',
    name: 'Bomb Pot (Omaha)',
    description: 'Antes, no preflop, two boards. 4 cards, use exactly 2 per board.',
    holeCards: 4,
    allowedHoleCounts: [2],
    manualSelect: false,
    discardAfterFlop: 0,
    bombPot: true,
    blackjack: false,
    bettingStructure: 'no-limit',
  },
  'blackjack-holdem': {
    id: 'blackjack-holdem',
    name: "Blackjack Hold'em",
    description: '4 cards. At showdown split into 2 for poker + 2 for blackjack. Pot splits 50/50.',
    holeCards: 4,
    allowedHoleCounts: [2],
    manualSelect: true,
    discardAfterFlop: 0,
    bombPot: false,
    blackjack: true,
    bettingStructure: 'no-limit',
  },
};

export const VARIANT_LIST: VariantConfig[] = Object.values(VARIANTS);

/** Human-readable hint describing how many cards must be selected. */
export function selectionHint(counts: number[]): string {
  const sorted = [...counts].filter((c) => c > 0).sort((a, b) => a - b);
  const canBoard = counts.includes(0);
  if (sorted.length === 0) return 'play the board';
  const list =
    sorted.length === 1
      ? `exactly ${sorted[0]}`
      : `${sorted.slice(0, -1).join(', ')} or ${sorted[sorted.length - 1]}`;
  return canBoard ? `${list} (or none — play the board)` : list;
}
