import type { BottlePromptPack, SpinMode } from '@shared';
import type { SpinLength } from '../wheel/logic';

const DRAFT_KEY = 'uno-party:spin-draft';
const SAVED_KEY = 'uno-party:spin-groups';
const HISTORY_KEY = 'uno-party:spin-history';
const OPTIONS_KEY = 'uno-party:spin-options';

/** The working title and name list, shared between Wheel and Bottle so switching modes never loses them. */
export interface SpinDraft {
  title: string;
  names: string[];
}

export interface SavedSpinGroup extends SpinDraft {
  savedAt: number;
}

export interface SpinOptions {
  mode: SpinMode;
  spinLength: SpinLength;
  removeWinners: boolean;
  pack: BottlePromptPack;
  canLandOnSelf: boolean;
  clockwiseTurns: boolean;
  sound: boolean;
  flirtyConfirmed: boolean;
}

const DEFAULT_OPTIONS: SpinOptions = {
  mode: 'wheel',
  spinLength: 'normal',
  removeWinners: false,
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

export function loadDraft(): SpinDraft {
  return { title: '', names: [], ...read<Partial<SpinDraft>>(DRAFT_KEY) };
}

export function saveDraft(draft: SpinDraft): void {
  write(DRAFT_KEY, draft);
}

export function loadSpinOptions(): SpinOptions {
  return { ...DEFAULT_OPTIONS, ...read<Partial<SpinOptions>>(OPTIONS_KEY) };
}

export function saveSpinOptions(options: SpinOptions): void {
  write(OPTIONS_KEY, options);
}

export function loadSavedGroups(): SavedSpinGroup[] {
  return read<SavedSpinGroup[]>(SAVED_KEY) ?? [];
}

export function saveGroup(draft: SpinDraft): SavedSpinGroup[] {
  const existing = loadSavedGroups().filter((g) => g.title !== draft.title);
  const next = [{ ...draft, savedAt: Date.now() }, ...existing].slice(0, 50);
  write(SAVED_KEY, next);
  return next;
}

export function deleteSavedGroup(title: string): SavedSpinGroup[] {
  const next = loadSavedGroups().filter((g) => g.title !== title);
  write(SAVED_KEY, next);
  return next;
}

export function loadHistory(): string[] {
  return read<string[]>(HISTORY_KEY) ?? [];
}

export function pushHistory(winner: string): string[] {
  const next = [winner, ...loadHistory()].slice(0, 10);
  write(HISTORY_KEY, next);
  return next;
}
