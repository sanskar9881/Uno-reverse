import type { CouplesKind, GroupCardType, GroupPickMode } from '@shared';

const OPTIONS_KEY = 'uno-party:group-options';
const CUSTOM_KEY = 'uno-party:group-custom-cards';

export interface GroupOptions {
  types: GroupCardType[];
  pickMode: GroupPickMode;
  noTouch: boolean;
  drinks: boolean;
  passPenalty: boolean;
  spicyConfirmed: boolean;
}

const DEFAULT_OPTIONS: GroupOptions = {
  types: ['normal'],
  pickMode: 'order',
  noTouch: false,
  drinks: false,
  passPenalty: false,
  spicyConfirmed: false,
};

export interface GroupCustomCard {
  id: string;
  createdAt: number;
  cardType: GroupCardType;
  kind: CouplesKind;
  text: string;
  timerSeconds: number | null;
}

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

export function loadGroupOptions(): GroupOptions {
  return { ...DEFAULT_OPTIONS, ...read<Partial<GroupOptions>>(OPTIONS_KEY) };
}

export function saveGroupOptions(options: GroupOptions): void {
  write(OPTIONS_KEY, options);
}

export function loadGroupCustomCards(): GroupCustomCard[] {
  return read<GroupCustomCard[]>(CUSTOM_KEY) ?? [];
}

export function saveGroupCustomCard(input: { cardType: GroupCardType; kind: CouplesKind; text: string; timerSeconds: number | null }): GroupCustomCard[] {
  const entry: GroupCustomCard = { id: crypto.randomUUID(), createdAt: Date.now(), ...input };
  const next = [entry, ...loadGroupCustomCards()].slice(0, 500);
  write(CUSTOM_KEY, next);
  return next;
}

/** Adds many cards at once (one per pasted line), all the same type and kind. */
export function saveGroupCustomCardsBulk(cardType: GroupCardType, kind: CouplesKind, texts: string[]): GroupCustomCard[] {
  const entries: GroupCustomCard[] = texts.map((text) => ({
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    cardType,
    kind,
    text,
    timerSeconds: null,
  }));
  const next = [...entries, ...loadGroupCustomCards()].slice(0, 500);
  write(CUSTOM_KEY, next);
  return next;
}

export function removeGroupCustomCard(id: string): GroupCustomCard[] {
  const next = loadGroupCustomCards().filter((c) => c.id !== id);
  write(CUSTOM_KEY, next);
  return next;
}

export function groupCustomCardsFor(cardType: GroupCardType, kind: CouplesKind): GroupCustomCard[] {
  return loadGroupCustomCards().filter((c) => c.cardType === cardType && c.kind === kind);
}
