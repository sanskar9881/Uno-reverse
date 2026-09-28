export const APP_NAME = 'Party Night';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const HAND_SIZE = 7;
export const TOTAL_CARDS = 108;
export const UNO_PENALTY_CARDS = 2;

export const ROOM_CODE_LENGTH = 6;
/** Unambiguous characters only (no 0/O, 1/I) so codes are easy to read aloud. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_REGEX = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 16;

export const AVATARS = ['🦊', '🐼', '🐸', '🐯', '🦄', '🐙', '🐵', '🐧', '🐨', '🦁', '🐲', '👾'] as const;

export const TURN_SECONDS_OPTIONS = [15, 30, 45, 60] as const;
/** 0 = no limit (scores just accumulate). */
export const TARGET_SCORE_OPTIONS = [0, 100, 250, 500] as const;

export const DEFAULT_SETTINGS = { turnSeconds: 30, targetScore: 0 };

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Letters (any language), digits, spaces and a little punctuation. */
export const NICKNAME_PATTERN = /^[\p{L}\p{N}\p{M} _.'!?-]+$/u;

/** Same normalization on client and server so "Ｓａｍ" and "Sam" can't both join. */
export const normalizeNickname = (raw: string): string => raw.normalize('NFKC').replace(/\s+/g, ' ').trim();

/** Returns a friendly problem description, or null when the nickname is fine. */
export function nicknameProblem(raw: string): string | null {
  const name = normalizeNickname(raw);
  if (name.length < NICKNAME_MIN_LENGTH) return `Use at least ${NICKNAME_MIN_LENGTH} characters.`;
  if (name.length > NICKNAME_MAX_LENGTH) return `Keep it to ${NICKNAME_MAX_LENGTH} characters or fewer.`;
  if (!NICKNAME_PATTERN.test(name)) return "Use letters, numbers, spaces and . _ - ' ! ? only.";
  return null;
}
