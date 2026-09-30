import type { Socket } from 'socket.io';
import type { z } from 'zod';
import type { AckResponse, ClientToServerEvents, ErrorPayload, ServerToClientEvents } from '@shared';
import { GameError } from '../game/errors';
import type { RoomManager } from '../rooms/RoomManager';
import { logger } from '../utils/logger';
import { KeyedRateLimiter, TokenBucket } from '../utils/rateLimiter';
import type { TypedServer } from './notifier';
import { schemas } from './schemas';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type EventName = keyof ClientToServerEvents;
type Reply = (response: AckResponse) => void;

export interface HandlerOptions {
  trustProxy: boolean;
}

const RATE_LIMITED: ErrorPayload = { code: 'RATE_LIMITED', message: 'Whoa, slow down a little!' };
const INVALID_PAYLOAD: ErrorPayload = { code: 'INVALID_PAYLOAD', message: "That request wasn't valid." };

function clientIp(socket: TypedSocket, trustProxy: boolean): string {
  if (trustProxy) {
    const header = socket.handshake.headers['x-forwarded-for'];
    const first = (Array.isArray(header) ? header[0] : header)?.split(',')[0]?.trim();
    if (first) return first;
  }
  return socket.handshake.address || 'unknown';
}

export function registerSocketHandlers(io: TypedServer, manager: RoomManager, options: HandlerOptions): void {
  // Per-IP limits stop one machine from spamming rooms through many sockets.
  const ipCreate = new KeyedRateLimiter({ capacity: 10, refillPerSecond: 0.2 });
  const ipJoin = new KeyedRateLimiter({ capacity: 30, refillPerSecond: 1 });

  io.on('connection', (socket) => {
    const ip = clientIp(socket, options.trustProxy);
    // Per-socket token buckets: generous for humans, tight for scripts.
    const buckets = {
      create: new TokenBucket(3, 0.2),
      join: new TokenBucket(5, 1),
      room: new TokenBucket(8, 2),
      game: new TokenBucket(12, 6),
    };

    /** Rate limit → validate → run → ack. The handler's state broadcast always goes out before the ack. */
    function on<S extends z.ZodType>(
      event: EventName,
      schema: S,
      bucket: TokenBucket,
      handler: (data: z.output<S>) => object | void,
      ipLimiter?: KeyedRateLimiter,
    ): void {
      (socket as unknown as { on(ev: string, fn: (payload: unknown, ack: unknown) => void): void }).on(
        event,
        (payload, ack) => {
          const reply: Reply = typeof ack === 'function' ? (ack as Reply) : () => {};
          if (!bucket.tryTake() || (ipLimiter && !ipLimiter.tryTake(ip))) {
            reply({ ok: false, error: RATE_LIMITED });
            return;
          }
          const parsed = schema.safeParse(payload ?? {});
          if (!parsed.success) {
            reply({ ok: false, error: INVALID_PAYLOAD });
            return;
          }
          try {
            const result = handler(parsed.data);
            reply({ ok: true, ...(result ?? {}) });
          } catch (error) {
            if (error instanceof GameError) {
              reply({ ok: false, error: { code: error.code, message: error.message, ...(error.suggestion ? { suggestion: error.suggestion } : {}) } });
            } else {
              logger.error(`Handler ${event} failed`, {
                error: error instanceof Error ? (error.stack ?? error.message) : String(error),
              });
              reply({ ok: false, error: { code: 'INTERNAL', message: 'Something went wrong on the server.' } });
            }
          }
        },
      );
    }

    on('room:create', schemas.create, buckets.create, (p) => manager.create(socket.id, p, p.gameType), ipCreate);
    on('room:join', schemas.join, buckets.join, (p) => manager.join(socket.id, p.roomCode, p), ipJoin);
    on('room:rejoin', schemas.rejoin, buckets.join, (p) => manager.rejoin(socket.id, p.roomCode, p.token), ipJoin);
    on('room:leave', schemas.empty, buckets.room, () => manager.leave(socket.id));
    on('room:settings', schemas.settings, buckets.room, (p) => manager.updateSettings(socket.id, p));
    on('room:kick', schemas.kick, buckets.room, (p) => manager.kick(socket.id, p.playerId));
    on('game:start', schemas.empty, buckets.room, () => manager.startGame(socket.id));
    on('game:nextRound', schemas.empty, buckets.room, () => manager.nextRound(socket.id));
    on('game:rematch', schemas.empty, buckets.room, () => manager.rematch(socket.id));
    on('game:play', schemas.play, buckets.game, (p) => manager.play(socket.id, p));
    on('game:draw', schemas.turn, buckets.game, (p) => manager.draw(socket.id, p.turnId));
    on('game:pass', schemas.turn, buckets.game, (p) => manager.pass(socket.id, p.turnId));
    on('game:uno', schemas.empty, buckets.game, () => manager.callUno(socket.id));
    on('game:catch', schemas.catch, buckets.game, (p) => manager.catchUno(socket.id, p.targetId));
    on('game:acceptDraw', schemas.turn, buckets.game, (p) => manager.acceptDraw(socket.id, p.turnId));
    on('game:challenge', schemas.turn, buckets.game, (p) => manager.challenge(socket.id, p.turnId));
    on('game:jumpIn', schemas.jumpIn, buckets.game, (p) => manager.jumpIn(socket.id, p));
    on('bottle:settings', schemas.bottleSettings, buckets.room, (p) => manager.updateBottleSettings(socket.id, p));
    on('bottle:spin', schemas.turn, buckets.game, (p) => manager.bottleSpin(socket.id, p.turnId));
    on('couples:choose', schemas.couplesChoose, buckets.game, (p) => ({ card: manager.couplesChoose(socket.id, p.kind, p.turnId) }));
    on('couples:pass', schemas.turn, buckets.game, (p) => ({ card: manager.couplesPass(socket.id, p.turnId) }));
    on('couples:done', schemas.turn, buckets.game, (p) => manager.couplesFinishTurn(socket.id, p.turnId));
    on('couples:level', schemas.couplesLevel, buckets.room, (p) => manager.couplesSetLevel(socket.id, p.level));
    on('couples:addCard', schemas.couplesCard, buckets.room, (p) =>
      manager.couplesAddCard(socket.id, p.level, p.kind, p.text, p.photo ?? null),
    );
    on('couples:onlyOurs', schemas.onlyOurs, buckets.room, (p) => manager.couplesSetOnlyOurs(socket.id, p.value));
    on('intimacy:draw', schemas.turn, buckets.game, (p) => ({ card: manager.intimacyDraw(socket.id, p.turnId) }));
    on('intimacy:done', schemas.turn, buckets.game, (p) => manager.intimacyFinishTurn(socket.id, p.turnId));
    on('intimacy:level', schemas.intimacyLevel, buckets.room, (p) => manager.intimacySetLevel(socket.id, p.level));
    on('intimacy:categories', schemas.intimacyCategories, buckets.room, (p) => manager.intimacySetCategories(socket.id, p.categories));
    on('intimacy:addCard', schemas.intimacyCard, buckets.room, (p) =>
      manager.intimacyAddCard(socket.id, p.level, p.category, p.text, p.photo ?? null),
    );
    on('intimacy:onlyOurs', schemas.onlyOurs, buckets.room, (p) => manager.intimacySetOnlyOurs(socket.id, p.value));
    on('group:choose', schemas.groupChoose, buckets.game, (p) => ({ card: manager.groupChoose(socket.id, p.kind, p.turnId) }));
    on('group:pass', schemas.turn, buckets.game, (p) => ({ card: manager.groupPass(socket.id, p.turnId) }));
    on('group:done', schemas.turn, buckets.game, (p) => manager.groupFinishTurn(socket.id, p.turnId));
    on('group:spin', schemas.turn, buckets.game, (p) => ({ playerId: manager.groupSpin(socket.id, p.turnId) }));
    on('group:types', schemas.groupTypes, buckets.room, (p) => manager.groupSetTypes(socket.id, p.types));
    on('group:options', schemas.groupOptions, buckets.room, (p) => manager.groupSetOptions(socket.id, p));
    on('group:addCard', schemas.groupCard, buckets.room, (p) =>
      manager.groupAddCard(socket.id, p.cardType, p.kind, p.text, p.timerSeconds ?? null),
    );

    socket.on('disconnect', () => {
      try {
        manager.handleDisconnect(socket.id);
      } catch (error) {
        logger.error('Disconnect handling failed', { error: String(error) });
      }
    });
  });
}
