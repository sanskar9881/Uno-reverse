import { describe, expect, it } from 'vitest';
import { landingIndex, pickTarget, rotationToTarget } from './logic';

describe('pickTarget', () => {
  it('never lands on the spinner unless allowed', () => {
    for (let i = 0; i < 5000; i++) {
      const count = 2 + (i % 11);
      const spinner = i % count;
      const target = pickTarget(count, spinner, false);
      expect(target).not.toBe(spinner);
      expect(target).toBeGreaterThanOrEqual(0);
      expect(target).toBeLessThan(count);
    }
  });

  it('can land on the spinner when allowed', () => {
    const count = 4;
    const spinner = 1;
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) seen.add(pickTarget(count, spinner, true));
    expect(seen.has(spinner)).toBe(true);
  });

  it('is roughly uniform over the other players (chi-square)', () => {
    const count = 6;
    const spinner = 2;
    const others = count - 1;
    const counts = new Array(count).fill(0);
    const trials = 60_000;
    for (let i = 0; i < trials; i++) counts[pickTarget(count, spinner, false)]++;
    expect(counts[spinner]).toBe(0);

    const expected = trials / others;
    const chiSquare = counts.reduce((sum, observed, idx) => (idx === spinner ? sum : sum + (observed - expected) ** 2 / expected), 0);
    expect(chiSquare).toBeLessThan(25);
  });
});

describe('rotationToTarget / landingIndex', () => {
  it('always lands back on the chosen player', () => {
    for (let count = 2; count <= 12; count++) {
      for (let index = 0; index < count; index++) {
        const rotation = rotationToTarget(index, count, 4);
        expect(landingIndex(rotation, count)).toBe(index);
      }
    }
  });
});
