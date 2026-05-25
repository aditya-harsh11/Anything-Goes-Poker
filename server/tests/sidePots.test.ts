import { describe, it, expect } from 'vitest';
import { buildPots } from '../src/engine/sidePots';

describe('sidePots', () => {
  it('equal contributions form a single main pot', () => {
    const pots = buildPots([
      { id: 'a', amount: 100, folded: false },
      { id: 'b', amount: 100, folded: false },
      { id: 'c', amount: 100, folded: false },
    ]);
    expect(pots).toEqual([{ amount: 300, eligible: ['a', 'b', 'c'] }]);
  });

  it('a short all-in creates a side pot', () => {
    const pots = buildPots([
      { id: 'a', amount: 50, folded: false }, // all-in for 50
      { id: 'b', amount: 100, folded: false },
      { id: 'c', amount: 100, folded: false },
    ]);
    expect(pots).toEqual([
      { amount: 150, eligible: ['a', 'b', 'c'] },
      { amount: 100, eligible: ['b', 'c'] },
    ]);
  });

  it("a folded player's chips stay in the pot but they are not eligible", () => {
    const pots = buildPots([
      { id: 'a', amount: 100, folded: true },
      { id: 'b', amount: 100, folded: false },
      { id: 'c', amount: 100, folded: false },
    ]);
    expect(pots).toEqual([{ amount: 300, eligible: ['b', 'c'] }]);
  });

  it('total chips are conserved across all pots', () => {
    const contribs = [
      { id: 'a', amount: 40, folded: false },
      { id: 'b', amount: 75, folded: true },
      { id: 'c', amount: 200, folded: false },
      { id: 'd', amount: 200, folded: false },
    ];
    const pots = buildPots(contribs);
    const total = contribs.reduce((s, c) => s + c.amount, 0);
    expect(pots.reduce((s, p) => s + p.amount, 0)).toBe(total);
  });
});
