import type { CouplesCard, CouplesLevel } from '@shared';

const AGE_KEY = 'uno-party:couples-age-confirmed';
const TOGETHER_KEY = 'uno-party:couples-together';
const FAVORITES_KEY = 'uno-party:couples-favorites';

export interface TogetherState {
  levelA: CouplesLevel;
  levelB: CouplesLevel;
  currentPartner: 0 | 1;
  usedByDeck: Record<string, string[]>;
}

const DEFAULT_TOGETHER: TogetherState = {
  levelA: 'sweet',
  levelB: 'sweet',
  currentPartner: 0,
  usedByDeck: {},
};

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or storage full: the game still works this session.
  }
}

export function isAgeConfirmed(): boolean {
  return read<boolean>(AGE_KEY) === true;
}

export function confirmAge(): void {
  write(AGE_KEY, true);
}

export function loadTogetherState(): TogetherState {
  return { ...DEFAULT_TOGETHER, ...read<Partial<TogetherState>>(TOGETHER_KEY) };
}

export function saveTogetherState(state: TogetherState): void {
  write(TOGETHER_KEY, state);
}

export function loadFavorites(): CouplesCard[] {
  return read<CouplesCard[]>(FAVORITES_KEY) ?? [];
}

export function addFavorite(card: CouplesCard): CouplesCard[] {
  const existing = loadFavorites();
  if (existing.some((c) => c.text === card.text)) return existing;
  const next = [card, ...existing].slice(0, 200);
  write(FAVORITES_KEY, next);
  return next;
}

export function removeFavorite(text: string): CouplesCard[] {
  const next = loadFavorites().filter((c) => c.text !== text);
  write(FAVORITES_KEY, next);
  return next;
}

export const deckKey = (level: CouplesLevel, kind: string): string => `${level}:${kind}`;
