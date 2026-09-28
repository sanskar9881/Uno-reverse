import type { ErrorCode } from '@shared';

/** An expected, user-facing rule violation. Anything else is a bug. */
export class GameError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'GameError';
    this.code = code;
  }
}
