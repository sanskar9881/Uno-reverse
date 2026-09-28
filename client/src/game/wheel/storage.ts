import type { WheelShare } from './logic';

const SAVED_KEY = 'uno-party:wheels';
const HISTORY_KEY = 'uno-party:wheel-history';
const OPTIONS_KEY = 'uno-party:wheel-options';

export interface SavedWheel extends WheelShare {
  savedAt: number;
}

export interface WheelOptions {
  spinLength: 'short' | 'normal' | 'long';
  removeWinners: boolean;
  sound: boolean;
}

const DEFAULT_OPTIONS: WheelOptions = { spinLength: 'normal', removeWinners: false, sound: true };

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
    // Private mode or storage full: the wheel still works this session.
  }
}

export function loadSavedWheels(): SavedWheel[] {
  return read<SavedWheel[]>(SAVED_KEY) ?? [];
}

export function saveWheel(wheel: WheelShare): SavedWheel[] {
  const existing = loadSavedWheels().filter((w) => w.title !== wheel.title);
  const next = [{ ...wheel, savedAt: Date.now() }, ...existing].slice(0, 50);
  write(SAVED_KEY, next);
  return next;
}

export function deleteSavedWheel(title: string): SavedWheel[] {
  const next = loadSavedWheels().filter((w) => w.title !== title);
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

export function loadWheelOptions(): WheelOptions {
  return { ...DEFAULT_OPTIONS, ...read<Partial<WheelOptions>>(OPTIONS_KEY) };
}

export function saveWheelOptions(options: WheelOptions): void {
  write(OPTIONS_KEY, options);
}
