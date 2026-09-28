export interface BottlePlayer {
  name: string;
  emoji: string;
}

export interface SavedGroup {
  name: string;
  players: BottlePlayer[];
  savedAt: number;
}

export interface BottleOptions {
  pack: 'off' | 'party' | 'flirty';
  canLandOnSelf: boolean;
  clockwiseTurns: boolean;
  sound: boolean;
  flirtyConfirmed: boolean;
}

const GROUPS_KEY = 'uno-party:bottle-groups';
const OPTIONS_KEY = 'uno-party:bottle-options';

const DEFAULT_OPTIONS: BottleOptions = {
  pack: 'party',
  canLandOnSelf: false,
  clockwiseTurns: false,
  sound: true,
  flirtyConfirmed: false,
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

export function loadSavedGroups(): SavedGroup[] {
  return read<SavedGroup[]>(GROUPS_KEY) ?? [];
}

export function saveGroup(name: string, players: BottlePlayer[]): SavedGroup[] {
  const existing = loadSavedGroups().filter((g) => g.name !== name);
  const next = [{ name, players, savedAt: Date.now() }, ...existing].slice(0, 20);
  write(GROUPS_KEY, next);
  return next;
}

export function deleteSavedGroup(name: string): SavedGroup[] {
  const next = loadSavedGroups().filter((g) => g.name !== name);
  write(GROUPS_KEY, next);
  return next;
}

export function loadBottleOptions(): BottleOptions {
  return { ...DEFAULT_OPTIONS, ...read<Partial<BottleOptions>>(OPTIONS_KEY) };
}

export function saveBottleOptions(options: BottleOptions): void {
  write(OPTIONS_KEY, options);
}
