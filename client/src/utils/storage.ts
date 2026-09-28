import { AVATARS, NICKNAME_MAX_LENGTH, ROOM_CODE_REGEX, UUID_REGEX } from '@shared';
import type { Profile, StoredSession } from '../types';
import { uuid } from './uuid';

const PROFILE_KEY = 'uno-party:profile';
const SESSION_KEY = 'uno-party:session';

function read<T>(storage: Storage, key: string): T | null {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(storage: Storage, key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or storage full: the game still works, it just won't remember you.
  }
}

/** Profile lives in localStorage: shared by every tab of this browser. */
export function loadProfile(): Profile {
  const stored = read<Partial<Profile>>(localStorage, PROFILE_KEY) ?? {};
  const profile: Profile = {
    nickname: typeof stored.nickname === 'string' ? stored.nickname.slice(0, NICKNAME_MAX_LENGTH) : '',
    avatar:
      typeof stored.avatar === 'number' && stored.avatar >= 0 && stored.avatar < AVATARS.length
        ? stored.avatar
        : Math.floor(Math.random() * AVATARS.length),
    profileId: typeof stored.profileId === 'string' && UUID_REGEX.test(stored.profileId) ? stored.profileId : uuid(),
    muted: stored.muted === true,
  };
  write(localStorage, PROFILE_KEY, profile);
  return profile;
}

export function saveProfile(profile: Profile): void {
  write(localStorage, PROFILE_KEY, profile);
}

/**
 * The seat token lives in sessionStorage: each tab is its own player, so you can
 * test multiplayer with several tabs, and a refresh keeps your seat.
 */
export function loadSession(): StoredSession | null {
  const s = read<StoredSession>(sessionStorage, SESSION_KEY);
  if (!s || typeof s.token !== 'string' || typeof s.roomCode !== 'string' || !ROOM_CODE_REGEX.test(s.roomCode)) {
    return null;
  }
  return s;
}

export function saveSession(session: StoredSession): void {
  write(sessionStorage, SESSION_KEY, session);
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
