import type { CouplesLevel } from '@shared';

export type OurDeckGame = 'couples' | 'intimacy';

export interface OurDeckEntry {
  id: string;
  createdAt: number;
  game: OurDeckGame;
  level: CouplesLevel;
  /** 'truth' | 'dare' for couples; an IntimacyCategory for intimacy. */
  slot: string;
  text: string;
  /** A resized data URL, or null when no photo was attached. */
  photo: string | null;
}

const KEY = 'uno-party:our-deck';
const MAX_ENTRIES = 300;

function read(): OurDeckEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OurDeckEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: OurDeckEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Private mode or storage full: the entry still shows for this session.
  }
}

export function loadOurDeck(): OurDeckEntry[] {
  return read();
}

export function saveOurDeckCard(input: {
  game: OurDeckGame;
  level: CouplesLevel;
  slot: string;
  text: string;
  photo: string | null;
}): OurDeckEntry[] {
  const entry: OurDeckEntry = { id: crypto.randomUUID(), createdAt: Date.now(), ...input };
  const next = [entry, ...read()].slice(0, MAX_ENTRIES);
  write(next);
  return next;
}

export function removeOurDeckCard(id: string): OurDeckEntry[] {
  const next = read().filter((e) => e.id !== id);
  write(next);
  return next;
}

export function ourDeckCardsFor(game: OurDeckGame, level: CouplesLevel, slot: string): OurDeckEntry[] {
  return read().filter((e) => e.game === game && e.level === level && e.slot === slot);
}

const onlyOursKey = (game: OurDeckGame): string => `uno-party:only-ours:${game}`;

/** Local-only "play only our cards" preference for Together mode (per game, per device). */
export function loadOnlyOurs(game: OurDeckGame): boolean {
  try {
    return localStorage.getItem(onlyOursKey(game)) === '1';
  } catch {
    return false;
  }
}

export function saveOnlyOurs(game: OurDeckGame, value: boolean): void {
  try {
    localStorage.setItem(onlyOursKey(game), value ? '1' : '0');
  } catch {
    // Private mode or storage full: the toggle still works this session.
  }
}
