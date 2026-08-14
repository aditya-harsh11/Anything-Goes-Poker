export interface Payment {
  from: string;
  to: string;
  amount: number;
}

/**
 * Minimal-ish set of payments that settles everyone's net result.
 *
 * Pass 1 settles any debtor/creditor pair whose remaining amounts match exactly (one
 * transaction fully closes both out) — this is what makes e.g. a -300 and a +300 net
 * directly against each other instead of getting split up while paying off someone else.
 * Pass 2 greedily matches the largest remaining debtor against the largest remaining
 * creditor until everyone's settled. Doesn't always hit the theoretical minimum
 * transaction count (that's NP-hard in general), but it's simple, deterministic, and
 * matches how people naturally settle a group tab by hand.
 */
export function computeSettlement(players: { name: string; netResult: number }[]): Payment[] {
  const creditors = players.filter((p) => p.netResult > 0).map((p) => ({ name: p.name, amount: p.netResult }));
  const debtors = players.filter((p) => p.netResult < 0).map((p) => ({ name: p.name, amount: -p.netResult }));

  const payments: Payment[] = [];

  // Pass 1: exact-amount pairs settle directly in a single transaction.
  for (const debtor of debtors) {
    if (debtor.amount <= 0) continue;
    const match = creditors.find((c) => c.amount === debtor.amount);
    if (match) {
      payments.push({ from: debtor.name, to: match.name, amount: debtor.amount });
      match.amount = 0;
      debtor.amount = 0;
    }
  }

  // Pass 2: largest remaining debtor pays down the largest remaining creditor.
  const remainingCreditors = creditors.filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);
  const remainingDebtors = debtors.filter((d) => d.amount > 0).sort((a, b) => b.amount - a.amount);
  let i = 0;
  let j = 0;
  while (i < remainingDebtors.length && j < remainingCreditors.length) {
    const debtor = remainingDebtors[i];
    const creditor = remainingCreditors[j];
    const amount = Math.min(debtor.amount, creditor.amount);
    if (amount > 0) {
      payments.push({ from: debtor.name, to: creditor.name, amount });
      debtor.amount -= amount;
      creditor.amount -= amount;
    }
    if (debtor.amount <= 0) i++;
    if (creditor.amount <= 0) j++;
  }
  return payments;
}
