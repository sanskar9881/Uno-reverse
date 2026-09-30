import { z } from 'zod';
import {
  AVATARS,
  CARD_COLORS,
  CUSTOM_RULE_MAX_LENGTH,
  GAME_TYPES,
  LEGACY_GAME_TYPES,
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  NICKNAME_PATTERN,
  ROOM_CODE_REGEX,
  TARGET_SCORE_OPTIONS,
  TURN_SECONDS_OPTIONS,
  UUID_REGEX,
  normalizeNickname,
} from '@shared';
import { GROUP_CARD_TYPES } from '@shared/games/group/cards';
import { INTIMACY_CATEGORIES } from '@shared/games/intimacy/decks';

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
const levelSchema = z.enum(['sweet', 'flirty', 'spicy']);
// A resized data URL from Our Deck. The client downscales before sending; this just caps abuse.
const photoSchema = z
  .string()
  .max(200_000)
  .regex(/^data:image\//)
  .nullable()
  .optional();

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
  create: profileSchema.extend({
    // Older clients still send 'bottle'; normalize it to 'spin' (bottle mode) right here so
    // nothing downstream ever needs to know the old name existed.
    gameType: z
      .union([z.enum(GAME_TYPES), z.enum(LEGACY_GAME_TYPES)])
      .transform((v) => (v === 'bottle' ? 'spin' : v))
      .optional(),
  }),
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
      mode: z.enum(['wheel', 'bottle']).optional(),
      pack: z.enum(['off', 'party', 'flirty']).optional(),
      canLandOnSelf: z.boolean().optional(),
      clockwiseTurns: z.boolean().optional(),
    })
    .refine(
      (s) => s.mode !== undefined || s.pack !== undefined || s.canLandOnSelf !== undefined || s.clockwiseTurns !== undefined,
    ),
  couplesChoose: z.object({ kind: z.enum(['truth', 'dare']), turnId: turnIdSchema }),
  couplesLevel: z.object({ level: levelSchema }),
  couplesCard: z.object({
    level: levelSchema,
    kind: z.enum(['truth', 'dare']),
    text: z.string().trim().min(1).max(200),
    photo: photoSchema,
  }),
  onlyOurs: z.object({ value: z.boolean() }),
  intimacyLevel: z.object({ level: levelSchema }),
  intimacyCategories: z.object({ categories: z.array(z.enum(INTIMACY_CATEGORIES)).min(1).max(INTIMACY_CATEGORIES.length) }),
  intimacyCard: z.object({
    level: levelSchema,
    category: z.enum(INTIMACY_CATEGORIES),
    text: z.string().trim().min(1).max(200),
    photo: photoSchema,
  }),
  groupChoose: z.object({ kind: z.enum(['truth', 'dare']), turnId: turnIdSchema }),
  groupTypes: z.object({ types: z.array(z.enum(GROUP_CARD_TYPES)).min(1).max(GROUP_CARD_TYPES.length) }),
  groupOptions: z
    .object({
      noTouch: z.boolean().optional(),
      drinks: z.boolean().optional(),
      passPenalty: z.boolean().optional(),
      pickMode: z.enum(['order', 'spin']).optional(),
    })
    .refine((s) => s.noTouch !== undefined || s.drinks !== undefined || s.passPenalty !== undefined || s.pickMode !== undefined),
  groupCard: z.object({
    cardType: z.enum(GROUP_CARD_TYPES),
    kind: z.enum(['truth', 'dare']),
    text: z.string().trim().min(1).max(200),
    timerSeconds: z.number().int().min(1).max(600).nullable().optional(),
  }),
};
