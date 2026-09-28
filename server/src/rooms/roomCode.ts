import { randomInt } from 'node:crypto';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@shared';
import { GameError } from '../game/errors';

export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  return code;
}

/** 32^6 ≈ 1 billion codes, so collisions are rare; retry a few times anyway. */
export function uniqueRoomCode(exists: (code: string) => boolean, attempts = 50): string {
  for (let i = 0; i < attempts; i++) {
    const code = generateRoomCode();
    if (!exists(code)) return code;
  }
  throw new GameError('SERVER_BUSY', 'Could not create a room right now. Please try again.');
}
