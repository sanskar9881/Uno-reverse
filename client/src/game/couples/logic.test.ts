import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TogetherState } from './storage';

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

const baseState = (overrides: Partial<TogetherState> = {}): TogetherState => ({
  levelA: 'sweet',
  levelB: 'sweet',
  currentPartner: 0,
  usedByDeck: {},
  ...overrides,
});

describe('togetherEffectiveLevel', () => {
  it('plays at the lower of the two partners', () => {
    expect(togetherEffectiveLevel(baseState({ levelA: 'spicy', levelB: 'flirty' }))).toBe('flirty');
  });
});

describe('drawTogetherCard', () => {
  it('does not repeat a card until the pool is exhausted', () => {
    let state = baseState();
    const seen = new Set<string>();
    // Sweet truths has 40 built-in cards.
    for (let i = 0; i < 40; i++) {
      const result = drawTogetherCard(state, 'sweet', 'truth', false);
      expect(result).not.toBeNull();
      expect(seen.has(result!.card.text)).toBe(false);
      seen.add(result!.card.text);
      state = result!.state;
    }
    expect(seen.size).toBe(40);
  });

  it('returns null when "only ours" is on and Our Deck is empty', () => {
    expect(drawTogetherCard(baseState(), 'sweet', 'dare', true)).toBeNull();
  });

  it('draws Our Deck cards when "only ours" is on, and they carry a photo', () => {
    saveOurDeckCard({ game: 'couples', level: 'sweet', slot: 'dare', text: 'Our own dare', photo: 'data:image/jpeg;base64,xyz' });
    const result = drawTogetherCard(baseState(), 'sweet', 'dare', true);
    expect(result?.card.text).toBe('Our own dare');
    expect(result?.card.photo).toBe('data:image/jpeg;base64,xyz');
  });

  it('mixes in Our Deck cards alongside the built-in deck when "only ours" is off', () => {
    saveOurDeckCard({ game: 'couples', level: 'sweet', slot: 'truth', text: 'A custom test truth', photo: null });
    let state = baseState();
    const seen = new Set<string>();
    for (let i = 0; i < 41; i++) {
      const result = drawTogetherCard(state, 'sweet', 'truth', false)!;
      seen.add(result.card.text);
      state = result.state;
    }
    expect(seen.has('A custom test truth')).toBe(true);
    expect(seen.size).toBe(41);
  });
});

describe('nextPartner', () => {
  it('alternates between the two partners', () => {
    expect(nextPartner(baseState({ currentPartner: 0 })).currentPartner).toBe(1);
    expect(nextPartner(baseState({ currentPartner: 1 })).currentPartner).toBe(0);
  });
});
