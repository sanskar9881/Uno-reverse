import { describe, expect, it } from 'vitest';
import { secureRng } from '../src/game/deck';
import { createBottleState, startSpin } from '../src/games/bottle/engine';

const SETTINGS = { mode: 'bottle' as const, pack: 'off' as const, canLandOnSelf: false, clockwiseTurns: false };

describe('bottle engine: startSpin targeting', () => {
  it('never targets the spinner unless canLandOnSelf is set', () => {
    for (let i = 0; i < 2000; i++) {
      const ids = ['a', 'b', 'c', 'd', 'e'];
      const state = createBottleState(ids, SETTINGS);
      const spinnerId = ids[i % ids.length];
      state.spinnerId = spinnerId;
      const spin = startSpin(state, spinnerId, 0, ids, secureRng, Date.now(), [1, 2]);
      expect(spin.targetId).not.toBe(spinnerId);
      expect(ids).toContain(spin.targetId);
    }
  });

  it('only targets connected players', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const state = createBottleState(ids, SETTINGS);
    for (let i = 0; i < 500; i++) {
      state.spin = null;
      const spin = startSpin(state, 'a', state.turnId, ['a', 'b'], secureRng, Date.now(), [1, 2]);
      expect(spin.targetId).toBe('b');
    }
  });

  it('targets are uniform over 10k spins (chi-square)', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const others = ids.slice(1);
    const counts: Record<string, number> = Object.fromEntries(others.map((id) => [id, 0]));
    const trials = 10_000;
    for (let i = 0; i < trials; i++) {
      const state = createBottleState(ids, SETTINGS);
      const spin = startSpin(state, 'a', 0, ids, secureRng, Date.now(), [1, 2]);
      counts[spin.targetId]++;
    }
    const expected = trials / others.length;
    const chiSquare = Object.values(counts).reduce((sum, observed) => sum + (observed - expected) ** 2 / expected, 0);
    // 4 degrees of freedom; generous threshold to avoid flakes while still catching real bias.
    expect(chiSquare).toBeLessThan(25);
  });

  it('can target the spinner when canLandOnSelf is on', () => {
    const ids = ['a', 'b'];
    const state = createBottleState(ids, { ...SETTINGS, canLandOnSelf: true });
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      state.spin = null;
      const spin = startSpin(state, 'a', state.turnId, ids, secureRng, Date.now(), [1, 2]);
      seen.add(spin.targetId);
      state.turnId++;
    }
    expect(seen.has('a')).toBe(true);
  });
});
