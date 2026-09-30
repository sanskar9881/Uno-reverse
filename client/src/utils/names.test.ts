import { describe, expect, it } from 'vitest';
import { isDuplicateName } from './names';

describe('isDuplicateName', () => {
  it('is false against an empty or unrelated group', () => {
    expect(isDuplicateName([], 'Harsh')).toBe(false);
    expect(isDuplicateName(['Amit', 'Zoya'], 'Harsh')).toBe(false);
  });

  it('catches an exact match', () => {
    expect(isDuplicateName(['Harsh'], 'Harsh')).toBe(true);
  });

  it('ignores case and surrounding whitespace', () => {
    expect(isDuplicateName(['Harsh'], 'harsh')).toBe(true);
    expect(isDuplicateName(['Harsh'], 'HARSH')).toBe(true);
    expect(isDuplicateName(['Harsh'], '  Harsh  ')).toBe(true);
    expect(isDuplicateName(['  Harsh  '], 'harsh')).toBe(true);
  });

  it('collapses internal whitespace like normalizeNickname does', () => {
    expect(isDuplicateName(['Harsh   Sharma'], 'harsh sharma')).toBe(true);
  });

  it('does not flag names that only look similar', () => {
    expect(isDuplicateName(['Harsh'], 'Harsha')).toBe(false);
    expect(isDuplicateName(['Harsh'], 'Har')).toBe(false);
  });
});
