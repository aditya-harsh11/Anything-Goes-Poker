export type Variant =
  | 'texas'
  | 'plo'
  | 'dirty-omaha'
  | 'two-or-three'
  | 'all-five'
  | 'one-three-five';

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
    bettingStructure: 'no-limit',
  },
  plo: {
    id: 'plo',
    name: 'Pot-Limit Omaha',
    description: '4 hole cards. Use exactly 2. Pot-limit betting.',
    holeCards: 4,
    allowedHoleCounts: [2],
    manualSelect: true,
    bettingStructure: 'pot-limit',
  },
  'dirty-omaha': {
    id: 'dirty-omaha',
    name: 'Dirty Omaha',
    description: '4 hole cards. Use any number (even play the board).',
    holeCards: 4,
    allowedHoleCounts: [0, 1, 2, 3, 4],
    manualSelect: true,
    bettingStructure: 'no-limit',
  },
  'two-or-three': {
    id: 'two-or-three',
    name: '2-or-3',
    description: '5 hole cards. Use exactly 2 or exactly 3.',
    holeCards: 5,
    allowedHoleCounts: [2, 3],
    manualSelect: true,
    bettingStructure: 'no-limit',
  },
  'all-five': {
    id: 'all-five',
    name: 'All 5',
    description: '5 hole cards. Use any number (even play the board).',
    holeCards: 5,
    allowedHoleCounts: [0, 1, 2, 3, 4, 5],
    manualSelect: true,
    bettingStructure: 'no-limit',
  },
  'one-three-five': {
    id: 'one-three-five',
    name: '1-3-5',
    description: '5 hole cards. Use exactly 1, 3, or 5.',
    holeCards: 5,
    allowedHoleCounts: [1, 3, 5],
    manualSelect: true,
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
