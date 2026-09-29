import { z } from 'zod';
import {
  AVATARS,
  CARD_COLORS,
  CUSTOM_RULE_MAX_LENGTH,
  GAME_TYPES,
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  NICKNAME_PATTERN,
  ROOM_CODE_REGEX,
  TARGET_SCORE_OPTIONS,
  TURN_SECONDS_OPTIONS,
  UUID_REGEX,
  normalizeNickname,
} from '@shared';

/**
 * Every client payload is parsed here before it reaches game logic.
 * Unknown keys are stripped; anything malformed is rejected with INVALID_PAYLOAD.
 */

export const nicknameSchema = z
  .string()
  .max(64)
  .transform(normalizeNickname)
  .pipe(z.string().min(NICKNAME_MIN_LENGTH).max(NICKNAME_MAX_LENGTH).regex(NICKNAME_PATTERN));

export const roomCodeSchema = z
  .string()
  .max(16)
  .transform((s) => s.trim().toUpperCase())
  .pipe(z.string().regex(ROOM_CODE_REGEX));

const idSchema = z.string().regex(/^[a-z0-9-]{1,32}$/i);
const turnIdSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

const profileSchema = z.object({
  nickname: nicknameSchema,
  avatar: z
    .number()
    .int()
    .min(0)
    .max(AVATARS.length - 1),
  profileId: z.string().regex(UUID_REGEX).optional(),
});

export const schemas = {
  create: profileSchema.extend({ gameType: z.enum(GAME_TYPES).optional() }),
  join: profileSchema.extend({ roomCode: roomCodeSchema }),
  rejoin: z.object({ roomCode: roomCodeSchema, token: z.string().regex(/^[a-f0-9]{48}$/) }),
  empty: z.object({}),
  settings: z
    .object({
      turnSeconds: z
        .number()
        .refine((v) => (TURN_SECONDS_OPTIONS as readonly number[]).includes(v))
        .optional(),
      targetScore: z
        .number()
        .refine((v) => (TARGET_SCORE_OPTIONS as readonly number[]).includes(v))
        .optional(),
      houseRules: z
        .object({
          stacking: z.boolean().optional(),
          drawUntilPlayable: z.boolean().optional(),
          mustPlayDrawn: z.boolean().optional(),
          sevenZero: z.boolean().optional(),
          jumpIn: z.boolean().optional(),
          modernDeck: z.boolean().optional(),
          customRuleText: z.string().trim().max(CUSTOM_RULE_MAX_LENGTH).optional(),
        })
        .optional(),
    })
    .refine((s) => s.turnSeconds !== undefined || s.targetScore !== undefined || s.houseRules !== undefined),
  kick: z.object({ playerId: idSchema }),
  play: z.object({
    turnId: turnIdSchema,
    cardId: idSchema,
    chosenColor: z.enum(CARD_COLORS).optional(),
    targetPlayerId: idSchema.optional(),
  }),
  turn: z.object({ turnId: turnIdSchema }),
  catch: z.object({ targetId: idSchema }),
  jumpIn: z.object({ cardId: idSchema, chosenColor: z.enum(CARD_COLORS).optional(), targetPlayerId: idSchema.optional() }),
  bottleSettings: z
    .object({
      pack: z.enum(['off', 'party', 'flirty']).optional(),
      canLandOnSelf: z.boolean().optional(),
      clockwiseTurns: z.boolean().optional(),
    })
    .refine((s) => s.pack !== undefined || s.canLandOnSelf !== undefined || s.clockwiseTurns !== undefined),
  couplesChoose: z.object({ kind: z.enum(['truth', 'dare']), turnId: turnIdSchema }),
  couplesLevel: z.object({ level: z.enum(['sweet', 'flirty', 'spicy']) }),
  couplesCard: z.object({
    level: z.enum(['sweet', 'flirty', 'spicy']),
    kind: z.enum(['truth', 'dare']),
    text: z.string().trim().min(1).max(200),
  }),
};
