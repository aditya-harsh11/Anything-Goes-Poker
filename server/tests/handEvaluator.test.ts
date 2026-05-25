import { describe, it, expect } from 'vitest';
import { solve, winnersAmong } from '../src/engine/handEvaluator';
import { cardFromString } from '@poker/shared';

const c = (s: string) => cardFromString(s);
const board = (s: string) => s.split(' ').map(c);

describe('handEvaluator', () => {
  it('picks the better hand among players (flush beats a pair)', () => {
    const b = board('Qs Js Ts 2c 3d');
    const a = { id: 'flush', hand: solve([c('As'), c('Ks')], b) }; // royal-ish flush
    const d = { id: 'pair', hand: solve([c('Ah'), c('Ad')], b) }; // trip/pair
    expect(winnersAmong([a, d])).toEqual(['flush']);
  });

  it('splits when both players play the board', () => {
    const b = board('As Ks Qs Js Ts'); // royal flush on the board
    const a = { id: 'a', hand: solve([c('2c'), c('3d')], b) };
    const d = { id: 'b', hand: solve([c('4h'), c('5h')], b) };
    expect(winnersAmong([a, d]).sort()).toEqual(['a', 'b']);
  });

  it('higher full house beats lower full house', () => {
    const b = board('Kd Kc 5h 5d 2s');
    const a = { id: 'kings', hand: solve([c('Ks'), c('5c')], b) }; // kings full of fives
    const d = { id: 'fives', hand: solve([c('5s'), c('2d')], b) }; // fives full of twos
    expect(winnersAmong([a, d])).toEqual(['kings']);
  });
});
