import { describe, expect, it } from 'vitest';
import { decodeWheelShare, encodeWheelShare, landingIndex, pickWinner, targetRotation } from './logic';

describe('pickWinner', () => {
  it('is uniform over 100k draws (chi-square)', () => {
    const segments = 8;
    const counts = new Array(segments).fill(0);
    const trials = 100_000;
    for (let i = 0; i < trials; i++) counts[pickWinner(segments)]++;

    const expected = trials / segments;
    const chiSquare = counts.reduce((sum, observed) => sum + (observed - expected) ** 2 / expected, 0);
    // 7 degrees of freedom; 99.9% critical value is ~24.3. This is generous enough to
    // never flake on a truly uniform generator while still catching a biased one.
    expect(chiSquare).toBeLessThan(30);
  });

  it('always returns an index within range', () => {
    for (let i = 0; i < 1000; i++) {
      const n = 2 + (i % 99);
      const w = pickWinner(n);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThan(n);
    }
  });
});

describe('targetRotation / landingIndex', () => {
  it('the landing angle always maps back to the chosen segment', () => {
    for (let segments = 2; segments <= 100; segments++) {
      for (let index = 0; index < segments; index++) {
        for (const spot of [0.15, 0.5, 0.84]) {
          const rotation = targetRotation(index, segments, 5, spot);
          expect(landingIndex(rotation, segments)).toBe(index);
        }
      }
    }
  });

  it('adds the requested number of full spins', () => {
    const rotation = targetRotation(3, 10, 7, 0.5);
    expect(rotation).toBeGreaterThanOrEqual(7 * 360);
    expect(rotation).toBeLessThan(8 * 360);
  });
});

describe('wheel share links', () => {
  it('round-trips a wheel through the URL hash encoding', () => {
    const wheel = { title: "Riya's party", names: ['Sanskar', 'Riya', 'Amit', 'Zoya'] };
    const encoded = encodeWheelShare(wheel);
    expect(encoded).not.toBeNull();
    expect(decodeWheelShare(encoded!)).toEqual(wheel);
  });

  it('returns null for garbage input instead of throwing', () => {
    expect(decodeWheelShare('not valid base64url json')).toBeNull();
  });

  it('refuses to encode a wheel over the size cap', () => {
    const wheel = { title: 'Huge', names: Array.from({ length: 100 }, (_, i) => `A very long name indeed number ${i}`) };
    expect(encodeWheelShare(wheel)).toBeNull();
  });
});
