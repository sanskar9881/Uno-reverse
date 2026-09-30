import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const {
  groupCustomCardsFor,
  loadGroupCustomCards,
  loadGroupOptions,
  removeGroupCustomCard,
  saveGroupCustomCard,
  saveGroupCustomCardsBulk,
  saveGroupOptions,
} = await import('./storage');

describe('group options storage', () => {
  it('defaults to Normal only, seat order, and everything else off', () => {
    const options = loadGroupOptions();
    expect(options.types).toEqual(['normal']);
    expect(options.pickMode).toBe('order');
    expect(options.noTouch).toBe(false);
    expect(options.drinks).toBe(false);
    expect(options.passPenalty).toBe(false);
    expect(options.spicyConfirmed).toBe(false);
  });

  it('round-trips a saved patch', () => {
    saveGroupOptions({ types: ['normal', 'spicy'], pickMode: 'spin', noTouch: true, drinks: true, passPenalty: true, spicyConfirmed: true });
    const options = loadGroupOptions();
    expect(options.types).toEqual(['normal', 'spicy']);
    expect(options.pickMode).toBe('spin');
    expect(options.noTouch).toBe(true);
  });
});

describe('group custom card storage', () => {
  it('starts empty', () => {
    expect(loadGroupCustomCards()).toEqual([]);
  });

  it('saves a card with an optional timer, newest first', () => {
    saveGroupCustomCard({ cardType: 'normal', kind: 'truth', text: 'First', timerSeconds: null });
    const next = saveGroupCustomCard({ cardType: 'normal', kind: 'dare', text: 'Second', timerSeconds: 30 });
    expect(next.map((c) => c.text)).toEqual(['Second', 'First']);
    expect(next[0].timerSeconds).toBe(30);
  });

  it('bulk-adds one card per line', () => {
    const next = saveGroupCustomCardsBulk('revealing', 'truth', ['Line one', 'Line two', 'Line three']);
    expect(next).toHaveLength(3);
    expect(next.every((c) => c.cardType === 'revealing' && c.kind === 'truth')).toBe(true);
  });

  it('filters by type and kind', () => {
    saveGroupCustomCard({ cardType: 'normal', kind: 'truth', text: 'A', timerSeconds: null });
    saveGroupCustomCard({ cardType: 'spicy', kind: 'dare', text: 'B', timerSeconds: null });
    expect(groupCustomCardsFor('normal', 'truth').map((c) => c.text)).toEqual(['A']);
    expect(groupCustomCardsFor('spicy', 'dare').map((c) => c.text)).toEqual(['B']);
    expect(groupCustomCardsFor('normal', 'dare')).toEqual([]);
  });

  it('removes a card by id', () => {
    const [entry] = saveGroupCustomCard({ cardType: 'normal', kind: 'truth', text: 'Removable', timerSeconds: null });
    const next = removeGroupCustomCard(entry.id);
    expect(next.find((c) => c.id === entry.id)).toBeUndefined();
  });
});
