import { describe, expect, it } from 'vitest';
import { isDuplicateName } from './names';

describe('isDuplicateName', () => {
  it('is false against an empty or unrelated group', () => {
    expect(isDuplicateName([], 'Riya')).toBe(false);
    expect(isDuplicateName(['Amit', 'Zoya'], 'Riya')).toBe(false);
  });

  it('catches an exact match', () => {
    expect(isDuplicateName(['Riya'], 'Riya')).toBe(true);
  });

  it('ignores case and surrounding whitespace', () => {
    expect(isDuplicateName(['Riya'], 'riya')).toBe(true);
    expect(isDuplicateName(['Riya'], 'RIYA')).toBe(true);
    expect(isDuplicateName(['Riya'], '  Riya  ')).toBe(true);
    expect(isDuplicateName(['  Riya  '], 'riya')).toBe(true);
  });

  it('collapses internal whitespace like normalizeNickname does', () => {
    expect(isDuplicateName(['Riya   Sharma'], 'riya sharma')).toBe(true);
  });

  it('does not flag names that only look similar', () => {
    expect(isDuplicateName(['Riya'], 'Riyaa')).toBe(false);
    expect(isDuplicateName(['Riya'], 'Riy')).toBe(false);
  });
});
