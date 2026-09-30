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

const { loadOnlyOurs, loadOurDeck, ourDeckCardsFor, removeOurDeckCard, saveOnlyOurs, saveOurDeckCard } = await import('./storage');

describe('our deck storage', () => {
  it('starts empty', () => {
    expect(loadOurDeck()).toEqual([]);
  });

  it('saves a card and lists it back, newest first', () => {
    saveOurDeckCard({ game: 'couples', level: 'sweet', slot: 'truth', text: 'First', photo: null });
    const next = saveOurDeckCard({ game: 'couples', level: 'sweet', slot: 'truth', text: 'Second', photo: null });
    expect(next.map((e) => e.text)).toEqual(['Second', 'First']);
  });

  it('filters by game, level and slot', () => {
    saveOurDeckCard({ game: 'couples', level: 'sweet', slot: 'truth', text: 'A couples sweet truth', photo: null });
    saveOurDeckCard({ game: 'couples', level: 'spicy', slot: 'truth', text: 'A couples spicy truth', photo: null });
    saveOurDeckCard({ game: 'intimacy', level: 'sweet', slot: 'kiss', text: 'An intimacy sweet kiss', photo: null });

    expect(ourDeckCardsFor('couples', 'sweet', 'truth').map((e) => e.text)).toEqual(['A couples sweet truth']);
    expect(ourDeckCardsFor('couples', 'spicy', 'truth').map((e) => e.text)).toEqual(['A couples spicy truth']);
    expect(ourDeckCardsFor('intimacy', 'sweet', 'kiss').map((e) => e.text)).toEqual(['An intimacy sweet kiss']);
    expect(ourDeckCardsFor('intimacy', 'sweet', 'touch')).toEqual([]);
  });

  it('keeps a photo attached to its card', () => {
    saveOurDeckCard({ game: 'couples', level: 'sweet', slot: 'dare', text: 'With a photo', photo: 'data:image/jpeg;base64,abc' });
    expect(ourDeckCardsFor('couples', 'sweet', 'dare')[0].photo).toBe('data:image/jpeg;base64,abc');
  });

  it('removes a card by id', () => {
    const afterSave = saveOurDeckCard({ game: 'couples', level: 'sweet', slot: 'truth', text: 'Removable', photo: null });
    const id = afterSave[0].id;
    const afterRemove = removeOurDeckCard(id);
    expect(afterRemove.find((e) => e.id === id)).toBeUndefined();
  });

  it('remembers "play only our cards" per game', () => {
    expect(loadOnlyOurs('couples')).toBe(false);
    saveOnlyOurs('couples', true);
    expect(loadOnlyOurs('couples')).toBe(true);
    // Independent of the other game.
    expect(loadOnlyOurs('intimacy')).toBe(false);
  });
});
