import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntimacyTogetherState } from './storage';

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

const { drawTogetherCard, nextPartner, togetherEffectiveLevel } = await import('./logic');
const { saveOurDeckCard } = await import('../ourDeck/storage');

const baseState = (overrides: Partial<IntimacyTogetherState> = {}): IntimacyTogetherState => ({
  levelA: 'sweet',
  levelB: 'sweet',
  categories: ['kiss'],
  currentPartner: 0,
  usedByDeck: {},
  ...overrides,
});

describe('togetherEffectiveLevel', () => {
  it('plays at the lower of the two partners', () => {
    expect(togetherEffectiveLevel(baseState({ levelA: 'spicy', levelB: 'flirty' }))).toBe('flirty');
    expect(togetherEffectiveLevel(baseState({ levelA: 'sweet', levelB: 'spicy' }))).toBe('sweet');
  });
});

describe('drawTogetherCard', () => {
  it('draws only from the included category', () => {
    const result = drawTogetherCard(baseState(), 'sweet', false);
    expect(result?.card.category).toBe('kiss');
  });

  it('does not repeat a card until the pool is exhausted, within one category', () => {
    let state = baseState();
    const seen = new Set<string>();
    // Sweet kiss has 10 built-in cards.
    for (let i = 0; i < 10; i++) {
      const result = drawTogetherCard(state, 'sweet', false);
      expect(result).not.toBeNull();
      expect(seen.has(result!.card.text)).toBe(false);
      seen.add(result!.card.text);
      state = result!.state;
    }
    expect(seen.size).toBe(10);
  });

  it('returns null when "only ours" is on and Our Deck has nothing for this category', () => {
    expect(drawTogetherCard(baseState(), 'sweet', true)).toBeNull();
  });

  it('draws Our Deck cards, including a photo, when "only ours" is on', () => {
    saveOurDeckCard({ game: 'intimacy', level: 'sweet', slot: 'kiss', text: 'Our own kiss card', photo: 'data:image/jpeg;base64,xyz' });
    const result = drawTogetherCard(baseState(), 'sweet', true);
    expect(result?.card.text).toBe('Our own kiss card');
    expect(result?.card.photo).toBe('data:image/jpeg;base64,xyz');
  });
});

describe('nextPartner', () => {
  it('alternates between the two partners', () => {
    const state = baseState({ currentPartner: 0 });
    expect(nextPartner(state).currentPartner).toBe(1);
    expect(nextPartner(nextPartner(state)).currentPartner).toBe(0);
  });
});
