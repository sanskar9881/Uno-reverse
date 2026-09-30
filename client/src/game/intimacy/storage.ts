import type { CouplesLevel, IntimacyCategory } from '@shared';
import { INTIMACY_CATEGORIES } from '@shared/games/intimacy/decks';

const AGE_KEY = 'uno-party:intimacy-age-confirmed';
const TOGETHER_KEY = 'uno-party:intimacy-together';

export interface IntimacyTogetherState {
  levelA: CouplesLevel;
  levelB: CouplesLevel;
  categories: IntimacyCategory[];
  currentPartner: 0 | 1;
  usedByDeck: Record<string, string[]>;
}

const DEFAULT_TOGETHER: IntimacyTogetherState = {
  levelA: 'sweet',
  levelB: 'sweet',
  categories: [...INTIMACY_CATEGORIES],
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

export function loadTogetherState(): IntimacyTogetherState {
  const stored = read<Partial<IntimacyTogetherState>>(TOGETHER_KEY);
  const categories = stored?.categories?.filter((c) => (INTIMACY_CATEGORIES as readonly string[]).includes(c));
  return { ...DEFAULT_TOGETHER, ...stored, categories: categories?.length ? categories : DEFAULT_TOGETHER.categories };
}

export function saveTogetherState(state: IntimacyTogetherState): void {
  write(TOGETHER_KEY, state);
}

export const deckKey = (level: CouplesLevel, category: string): string => `${level}:${category}`;
