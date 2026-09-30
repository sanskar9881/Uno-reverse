import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GroupOptions } from './storage';

function fakeLocalStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => void map.clear(),
  };
}

let nextId = 0;
beforeEach(() => {
  vi.stubGlobal('localStorage', fakeLocalStorage());
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `id-${nextId++}` as ReturnType<typeof crypto.randomUUID>);
});

const { createTogetherState, drawTogetherCard, finishTurn, spinForNext } = await import('./logic');
const { saveGroupCustomCard } = await import('./storage');

const baseOptions = (overrides: Partial<GroupOptions> = {}): GroupOptions => ({
  types: ['normal'],
  pickMode: 'order',
  noTouch: false,
  drinks: false,
  passPenalty: false,
  spicyConfirmed: false,
  ...overrides,
});

describe('drawTogetherCard', () => {
  it('draws only from the included type', () => {
    const state = createTogetherState(['Alex', 'Blair', 'Casey']);
    const result = drawTogetherCard(state, 'truth', baseOptions());
    expect(result?.card.cardType).toBe('normal');
  });

  it('does not repeat a card until the pool is exhausted', () => {
    let state = createTogetherState(['Alex', 'Blair', 'Casey']);
    const options = baseOptions();
    const seen = new Set<string>();
    // Normal truths has 40 built-in cards.
    for (let i = 0; i < 40; i++) {
      const result = drawTogetherCard(state, 'truth', options)!;
      expect(seen.has(result.card.text)).toBe(false);
      seen.add(result.card.text);
      state = result.state;
    }
    expect(seen.size).toBe(40);
  });

  it('replaces {left} and {right} with real neighbor names', () => {
    const state = createTogetherState(['Alex', 'Blair', 'Casey']);
    saveGroupCustomCard({ cardType: 'normal', kind: 'dare', text: 'Wave at {left} and {right}.', timerSeconds: null });
    const options = baseOptions();
    let found: string | null = null;
    let s = state;
    for (let i = 0; i < 45 && !found; i++) {
      const result = drawTogetherCard(s, 'dare', options)!;
      if (result.card.text.startsWith('Wave at')) found = result.card.text;
      s = result.state;
    }
    expect(found).toBe('Wave at Casey and Blair.');
  });

  it('filters out touch dares when No-touch is on', () => {
    const state = createTogetherState(['Alex', 'Blair']);
    const options = baseOptions({ types: ['spicy'], noTouch: true });
    for (let i = 0; i < 30; i++) {
      const result = drawTogetherCard(state, 'dare', options)!;
      expect(result.card.text).not.toContain('cheek');
    }
  });

  it('returns null when there are no cards for the current options', () => {
    const state = createTogetherState(['Alex', 'Blair']);
    // No built-in type selected and no custom cards exist for it.
    const result = drawTogetherCard(state, 'truth', baseOptions({ types: [] }));
    expect(result).toBeNull();
  });
});

describe('finishTurn', () => {
  it('advances to the next player in seat order by default', () => {
    const state = createTogetherState(['Alex', 'Blair', 'Casey']);
    const next = finishTurn(state, 'order');
    expect(next.currentIndex).toBe(1);
    expect(next.awaitingSpin).toBe(false);
  });

  it('wraps around after the last player', () => {
    const state = { ...createTogetherState(['Alex', 'Blair', 'Casey']), currentIndex: 2 };
    expect(finishTurn(state, 'order').currentIndex).toBe(0);
  });

  it('waits for a spin instead of advancing when pickMode is spin', () => {
    const state = createTogetherState(['Alex', 'Blair', 'Casey']);
    const next = finishTurn(state, 'spin');
    expect(next.awaitingSpin).toBe(true);
    expect(next.currentIndex).toBe(0);
  });
});

describe('spinForNext', () => {
  it('picks a player and clears awaitingSpin', () => {
    const state = { ...createTogetherState(['Alex', 'Blair', 'Casey']), awaitingSpin: true };
    const { index, state: next } = spinForNext(state);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(3);
    expect(next.currentIndex).toBe(index);
    expect(next.awaitingSpin).toBe(false);
  });
});
