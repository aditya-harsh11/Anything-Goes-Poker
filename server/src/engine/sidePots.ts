export interface Contribution {
  id: string;
  /** Total chips this player put into the pot across the whole hand. */
  amount: number;
  folded: boolean;
}

export interface Pot {
  amount: number;
  /** Player ids eligible to win this pot (non-folded contributors at this layer). */
  eligible: string[];
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

/**
 * Build the main pot + side pots by layering on each distinct all-in level.
 * Folded players' chips stay in the pot but they are never eligible to win.
 */
export function buildPots(contribs: Contribution[]): Pot[] {
  const work = contribs.map((c) => ({ ...c }));
  const pots: Pot[] = [];

  for (;;) {
    const positive = work.filter((c) => c.amount > 0);
    if (positive.length === 0) break;

    const minAmt = Math.min(...positive.map((c) => c.amount));
    const potAmount = minAmt * positive.length;
    const eligible = positive
      .filter((c) => !c.folded)
      .map((c) => c.id)
      .sort();

    for (const c of positive) c.amount -= minAmt;

    if (eligible.length === 0) {
      // Degenerate (e.g. only folded chips left): fold the money into the previous pot.
      const prev = pots[pots.length - 1];
      if (prev) prev.amount += potAmount;
      continue;
    }

    const prev = pots[pots.length - 1];
    if (prev && sameSet(prev.eligible, eligible)) {
      prev.amount += potAmount;
    } else {
      pots.push({ amount: potAmount, eligible });
    }
  }

  return pots;
}
