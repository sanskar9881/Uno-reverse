import {
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  type Card,
  type CardColor,
  type GameEvent,
  type JoinResult,
  type ProfilePayload,
  type RoomSettings,
  type SessionEndReason,
} from '@shared';
import { secureRng, type Rng } from '../game/deck';
import { GameEngine, type GameState } from '../game/engine';
import { GameError } from '../game/errors';
import { MemoryStatsService } from '../services/stats/MemoryStatsService';
import type { StatsService } from '../services/stats/StatsService';
import { newPlayerId, newToken, safeEqual } from '../utils/ids';
import { logger } from '../utils/logger';
import { InMemoryRoomStore, type RoomStore } from './RoomStore';
import { uniqueRoomCode } from './roomCode';
import type { PlayerRecord, Room } from './types';

/** Transport-agnostic output. The Socket.IO layer implements this; tests use a fake. */
export interface RoomNotifier {
  /** Send every connected player in the room their personalized snapshot. */
  roomUpdated(room: Room, events: GameEvent[]): void;
  sessionEnded(socketId: string, reason: SessionEndReason, message: string): void;
}

export interface RoomManagerOptions {
  stats?: StatsService;
  store?: RoomStore;
  engine?: GameEngine;
  rng?: Rng;
  /** Test hook: pre-ordered deck for a round (last element is drawn first). */
  deckFactory?: (room: Room) => Card[] | undefined;
  /** How long a disconnected player keeps their seat in the lobby. */
  lobbyGraceMs?: number;
  /** How long a disconnected player keeps their seat (and hand) during a game. */
  gameGraceMs?: number;
  /** A disconnected host hands over the crown after this long. */
  hostTransferMs?: number;
  /** Turn length for a disconnected player, so the table isn't stuck waiting. */
  disconnectedTurnMs?: number;
  /** After drawing a playable card you always get at least this long to decide. */
  minTimeAfterDrawMs?: number;
  /** Overrides settings.turnSeconds (tests). */
  turnDurationOverrideMs?: number;
  maxRooms?: number;
  roomIdleMs?: number;
  sweepIntervalMs?: number;
  now?: () => number;
}

interface Session {
  code: string;
  playerId: string;
}

export interface PlayInput {
  turnId: number;
  cardId: string;
  chosenColor?: CardColor;
}

/**
 * Owns every room: membership, sessions, turn timers, disconnect grace periods
 * and host hand-off. All methods are synchronous and run to completion on
 * Node's single thread, so two actions can never interleave inside a room.
 * Rule violations throw GameError (turned into an error ack by the socket layer).
 */
export class RoomManager {
  private readonly sessions = new Map<string, Session>();
  private readonly turnTimers = new Map<string, NodeJS.Timeout>();
  private readonly graceTimers = new Map<string, NodeJS.Timeout>();
  private readonly hostTimers = new Map<string, NodeJS.Timeout>();
  private readonly sweepTimer: NodeJS.Timeout;

  private readonly stats: StatsService;
  private readonly store: RoomStore;
  private readonly engine: GameEngine;
  private readonly rng: Rng;
  private readonly deckFactory?: (room: Room) => Card[] | undefined;
  private readonly lobbyGraceMs: number;
  private readonly gameGraceMs: number;
  private readonly hostTransferMs: number;
  private readonly disconnectedTurnMs: number;
  private readonly minTimeAfterDrawMs: number;
  private readonly turnDurationOverrideMs?: number;
  private readonly maxRooms: number;
  private readonly roomIdleMs: number;
  private readonly now: () => number;

  constructor(
    private readonly notifier: RoomNotifier,
    options: RoomManagerOptions = {},
  ) {
    this.stats = options.stats ?? new MemoryStatsService();
    this.store = options.store ?? new InMemoryRoomStore();
    this.rng = options.rng ?? secureRng;
    this.engine = options.engine ?? new GameEngine(this.rng);
    this.deckFactory = options.deckFactory;
    this.lobbyGraceMs = options.lobbyGraceMs ?? 15_000;
    this.gameGraceMs = options.gameGraceMs ?? 60_000;
    this.hostTransferMs = options.hostTransferMs ?? 10_000;
    this.disconnectedTurnMs = options.disconnectedTurnMs ?? 10_000;
    this.minTimeAfterDrawMs = options.minTimeAfterDrawMs ?? 5_000;
    this.turnDurationOverrideMs = options.turnDurationOverrideMs;
    this.maxRooms = options.maxRooms ?? 5_000;
    this.roomIdleMs = options.roomIdleMs ?? 2 * 60 * 60 * 1000;
    this.now = options.now ?? Date.now;
    this.sweepTimer = setInterval(() => this.safely(() => this.sweep()), options.sweepIntervalMs ?? 60_000);
    this.sweepTimer.unref();
  }

  // ------------------------------------------------------------------ membership

  create(socketId: string, profile: ProfilePayload): JoinResult {
    if (this.store.size >= this.maxRooms) {
      throw new GameError('SERVER_BUSY', 'The server is full right now. Please try again in a minute.');
    }
    this.detach(socketId);
    const now = this.now();
    const player = this.newPlayer(socketId, profile, now);
    const room: Room = {
      code: uniqueRoomCode((code) => this.store.has(code)),
      hostId: player.id,
      players: [player],
      settings: { ...DEFAULT_SETTINGS },
      status: 'lobby',
      game: null,
      scores: { [player.id]: 0 },
      roundNumber: 0,
      lastRound: null,
      turnEndsAt: 0,
      turnDurationMs: 0,
      starterSeed: this.rng(MAX_PLAYERS),
      createdAt: now,
      lastActivityAt: now,
    };
    this.store.save(room);
    this.sessions.set(socketId, { code: room.code, playerId: player.id });
    logger.info('Room created', { room: room.code });
    this.notifier.roomUpdated(room, [{ type: 'playerJoined', playerId: player.id, nickname: player.nickname }]);
    return { roomCode: room.code, playerId: player.id, token: player.token };
  }

  join(socketId: string, code: string, profile: ProfilePayload): JoinResult {
    const room = this.store.get(code);
    if (!room) throw new GameError('ROOM_NOT_FOUND', `There's no room with code ${code}. Check the code and try again.`);

    // Double-submitted join from the same tab: hand back the seat it already has.
    const existing = this.sessions.get(socketId);
    const current = existing?.code === code ? room.players.find((p) => p.id === existing.playerId) : undefined;
    if (current) return { roomCode: code, playerId: current.id, token: current.token };

    if (room.status === 'playing') {
      throw new GameError('GAME_IN_PROGRESS', 'A round is being played in that room. Try again when it ends.');
    }
    if (room.players.length >= MAX_PLAYERS) throw new GameError('ROOM_FULL', `That room is full (${MAX_PLAYERS} players max).`);
    const wanted = profile.nickname.toLocaleLowerCase();
    if (room.players.some((p) => p.nickname.toLocaleLowerCase() === wanted)) {
      throw new GameError('NAME_TAKEN', `Someone in that room is already called ${profile.nickname}. Pick another nickname.`);
    }

    this.detach(socketId);
    const player = this.newPlayer(socketId, profile, this.now());
    room.players.push(player);
    room.scores[player.id] = 0;
    this.sessions.set(socketId, { code, playerId: player.id });
    this.touch(room);
    this.store.save(room);
    this.notifier.roomUpdated(room, [{ type: 'playerJoined', playerId: player.id, nickname: player.nickname }]);
    return { roomCode: code, playerId: player.id, token: player.token };
  }

  /** Reclaims a seat after a refresh or network drop, using the secret token issued at join time. */
  rejoin(socketId: string, code: string, token: string): { roomCode: string; playerId: string } {
    const room = this.store.get(code);
    const player = room?.players.find((p) => safeEqual(p.token, token));
    if (!room || !player) throw new GameError('SESSION_EXPIRED', 'That seat is no longer available. The game may have ended.');

    const existing = this.sessions.get(socketId);
    if (existing && !(existing.code === code && existing.playerId === player.id)) this.detach(socketId);

    if (player.socketId && player.socketId !== socketId) {
      // The same seat was opened somewhere else (e.g. a duplicated tab): newest connection wins.
      this.sessions.delete(player.socketId);
      this.notifier.sessionEnded(player.socketId, 'replaced', 'This game was opened in another tab or window.');
    }

    const wasDisconnected = !player.connected;
    player.socketId = socketId;
    player.connected = true;
    player.disconnectedAt = null;
    this.sessions.set(socketId, { code, playerId: player.id });
    this.clearGraceTimer(code, player.id);
    if (room.hostId === player.id) this.clearHostTimer(code);
    this.touch(room);
    this.store.save(room);
    this.notifier.roomUpdated(
      room,
      wasDisconnected ? [{ type: 'playerReconnected', playerId: player.id, nickname: player.nickname }] : [],
    );
    return { roomCode: code, playerId: player.id };
  }

  leave(socketId: string): void {
    const { room, player } = this.requireSession(socketId);
    this.sessions.delete(socketId);
    this.removePlayer(room, player.id, 'left');
  }

  /** Socket dropped: keep the seat for a grace period so refreshes and flaky networks don't cost the game. */
  handleDisconnect(socketId: string): void {
    const session = this.sessions.get(socketId);
    if (!session) return;
    this.sessions.delete(socketId);
    const room = this.store.get(session.code);
    const player = room?.players.find((p) => p.id === session.playerId);
    if (!room || !player || player.socketId !== socketId) return;

    player.connected = false;
    player.socketId = null;
    player.disconnectedAt = this.now();
    this.scheduleGraceRemoval(room, player.id);
    if (room.hostId === player.id) this.scheduleHostTransfer(room);

    const game = room.game;
    if (room.status === 'playing' && game && !game.finished && this.engine.currentPlayerId(game) === player.id) {
      // Don't make the table wait a full turn for someone who just left.
      if (room.turnEndsAt - this.now() > this.disconnectedTurnMs) this.scheduleTurnTimer(room, this.disconnectedTurnMs);
    }
    this.store.save(room);
    this.notifier.roomUpdated(room, [{ type: 'playerDisconnected', playerId: player.id, nickname: player.nickname }]);
  }

  updateSettings(socketId: string, patch: Partial<RoomSettings>): void {
    const { room, player } = this.requireSession(socketId);
    this.requireHost(room, player);
    if (room.status === 'playing') throw new GameError('INVALID_STATE', "Settings can't change during a round.");
    room.settings = { ...room.settings, ...patch };
    this.touch(room);
    this.store.save(room);
    this.notifier.roomUpdated(room, [{ type: 'settingsChanged', settings: { ...room.settings } }]);
  }

  kick(socketId: string, targetId: string): void {
    const { room, player } = this.requireSession(socketId);
    this.requireHost(room, player);
    if (targetId === player.id) throw new GameError('INVALID_STATE', "You can't remove yourself. Use Leave instead.");
    const target = room.players.find((p) => p.id === targetId);
    if (!target) throw new GameError('NOT_IN_ROOM', 'That player already left.');
    const targetSocket = target.socketId;
    this.removePlayer(room, target.id, 'kicked');
    if (targetSocket) this.notifier.sessionEnded(targetSocket, 'kicked', 'The host removed you from the room.');
  }

  // ------------------------------------------------------------------ rounds

  startGame(socketId: string): void {
    const { room, player } = this.requireSession(socketId);
    this.requireHost(room, player);
    if (room.status !== 'lobby') throw new GameError('INVALID_STATE', 'The game has already started.');
    this.assertCanStart(room);
    this.beginRound(room);
  }

  nextRound(socketId: string): void {
    const { room, player } = this.requireSession(socketId);
    this.requireHost(room, player);
    if (room.status !== 'roundOver') throw new GameError('INVALID_STATE', 'The current round is not over yet.');
    if (room.lastRound?.matchWinnerId) {
      throw new GameError('INVALID_STATE', 'The match is over. Start a rematch to play again.');
    }
    this.assertCanStart(room);
    this.beginRound(room);
  }

  rematch(socketId: string): void {
    const { room, player } = this.requireSession(socketId);
    this.requireHost(room, player);
    if (room.status !== 'roundOver') throw new GameError('INVALID_STATE', 'The current round is not over yet.');
    this.assertCanStart(room);
    for (const p of room.players) room.scores[p.id] = 0;
    room.roundNumber = 0;
    room.starterSeed = this.rng(MAX_PLAYERS);
    this.beginRound(room);
  }

  // ------------------------------------------------------------------ turns

  play(socketId: string, input: PlayInput): void {
    const { room, player } = this.requireSession(socketId);
    const game = this.requirePlaying(room);
    const previousTurn = game.turnId;
    const events = this.engine.play(game, player.id, input);
    this.afterGameAction(room, events, previousTurn);
  }

  draw(socketId: string, turnId: number): { playable: boolean } {
    const { room, player } = this.requireSession(socketId);
    const game = this.requirePlaying(room);
    const previousTurn = game.turnId;
    const { events, playable } = this.engine.draw(game, player.id, turnId);
    if (playable && game.turnId === previousTurn) this.ensureTurnTime(room, this.minTimeAfterDrawMs);
    this.afterGameAction(room, events, previousTurn);
    return { playable };
  }

  pass(socketId: string, turnId: number): void {
    const { room, player } = this.requireSession(socketId);
    const game = this.requirePlaying(room);
    const previousTurn = game.turnId;
    const events = this.engine.pass(game, player.id, turnId);
    this.afterGameAction(room, events, previousTurn);
  }

  callUno(socketId: string): void {
    const { room, player } = this.requireSession(socketId);
    const game = this.requirePlaying(room);
    const events = this.engine.callUno(game, player.id);
    this.afterGameAction(room, events, game.turnId);
  }

  catchUno(socketId: string, targetId: string): void {
    const { room, player } = this.requireSession(socketId);
    const game = this.requirePlaying(room);
    const events = this.engine.catchUno(game, player.id, targetId);
    this.afterGameAction(room, events, game.turnId);
  }

  // ------------------------------------------------------------------ introspection

  getRoom(code: string): Room | undefined {
    return this.store.get(code);
  }

  sessionFor(socketId: string): Session | undefined {
    return this.sessions.get(socketId);
  }

  metrics(): { rooms: number; players: number; connectedPlayers: number } {
    let players = 0;
    let connectedPlayers = 0;
    for (const room of this.store.all()) {
      players += room.players.length;
      connectedPlayers += room.players.filter((p) => p.connected).length;
    }
    return { rooms: this.store.size, players, connectedPlayers };
  }

  dispose(): void {
    clearInterval(this.sweepTimer);
    for (const timer of [...this.turnTimers.values(), ...this.graceTimers.values(), ...this.hostTimers.values()]) {
      clearTimeout(timer);
    }
    this.turnTimers.clear();
    this.graceTimers.clear();
    this.hostTimers.clear();
  }

  // ------------------------------------------------------------------ internals

  private newPlayer(socketId: string, profile: ProfilePayload, now: number): PlayerRecord {
    return {
      id: newPlayerId(),
      token: newToken(),
      nickname: profile.nickname,
      avatar: profile.avatar,
      profileId: profile.profileId ?? null,
      socketId,
      connected: true,
      joinedAt: now,
      disconnectedAt: null,
    };
  }

  /** If this socket is already seated somewhere, leave that room first. */
  private detach(socketId: string): void {
    if (!this.sessions.has(socketId)) return;
    try {
      this.leave(socketId);
    } catch {
      this.sessions.delete(socketId);
    }
  }

  private requireSession(socketId: string): { room: Room; player: PlayerRecord } {
    const session = this.sessions.get(socketId);
    if (!session) throw new GameError('NOT_IN_ROOM', "You're not in a room.");
    const room = this.store.get(session.code);
    const player = room?.players.find((p) => p.id === session.playerId);
    if (!room || !player) {
      this.sessions.delete(socketId);
      throw new GameError('NOT_IN_ROOM', "You're not in that room anymore.");
    }
    return { room, player };
  }

  private requireHost(room: Room, player: PlayerRecord): void {
    if (room.hostId !== player.id) throw new GameError('NOT_HOST', 'Only the host can do that.');
  }

  private requirePlaying(room: Room): GameState {
    if (room.status !== 'playing' || !room.game) {
      throw new GameError('INVALID_STATE', 'No round is being played right now.');
    }
    return room.game;
  }

  private assertCanStart(room: Room): void {
    const connected = room.players.filter((p) => p.connected).length;
    if (connected < MIN_PLAYERS) {
      throw new GameError('NOT_ENOUGH_PLAYERS', `You need at least ${MIN_PLAYERS} players to start.`);
    }
  }

  private beginRound(room: Room): void {
    const ids = room.players.map((p) => p.id);
    const roundNumber = room.roundNumber + 1;
    const startIndex = (room.starterSeed + roundNumber - 1) % ids.length;
    const { state, events } = this.engine.createGame(ids, { deck: this.deckFactory?.(room), startIndex });
    room.roundNumber = roundNumber;
    room.game = state;
    room.status = 'playing';
    room.lastRound = null;
    for (const id of ids) room.scores[id] ??= 0;
    this.scheduleTurnTimer(room);
    this.touch(room);
    this.store.save(room);
    logger.info('Round started', { room: room.code, round: roundNumber, players: ids.length });
    this.notifier.roomUpdated(room, [
      { type: 'gameStarted', roundNumber, firstPlayerId: this.engine.currentPlayerId(state) },
      ...events,
    ]);
  }

  private afterGameAction(room: Room, events: GameEvent[], previousTurn: number): void {
    const game = room.game;
    if (game?.finished) this.finishRound(room, events);
    else if (game && game.turnId !== previousTurn) this.scheduleTurnTimer(room);
    this.touch(room);
    this.store.save(room);
    this.notifier.roomUpdated(room, events);
  }

  /** Scores the round, updates the match and records stats. Mutates `events`. */
  private finishRound(room: Room, events: GameEvent[]): void {
    const game = room.game;
    this.clearTurnTimer(room.code);
    room.turnEndsAt = 0;
    room.status = 'roundOver';
    if (!game?.winnerId) return;

    const winnerId = game.winnerId;
    const tally = this.engine.scoreRound(game);
    const points = game.forfeit ? 0 : tally.points;
    room.scores[winnerId] = (room.scores[winnerId] ?? 0) + points;
    const target = room.settings.targetScore;
    const matchWinnerId = target > 0 && room.scores[winnerId] >= target ? winnerId : null;
    const reason = game.forfeit ? 'forfeit' : 'emptiedHand';
    const winner = room.players.find((p) => p.id === winnerId);

    room.lastRound = {
      roundNumber: room.roundNumber,
      winnerId,
      winnerName: winner?.nickname ?? 'Someone',
      points,
      reason,
      cardsLeft: tally.cardsLeft,
      pointsByPlayer: game.forfeit ? {} : tally.pointsByPlayer,
      matchWinnerId,
    };
    events.push({ type: 'roundOver', winnerId, points, reason });
    if (matchWinnerId) events.push({ type: 'matchOver', winnerId: matchWinnerId });
    logger.info('Round finished', { room: room.code, round: room.roundNumber, points, reason });

    if (!game.forfeit) {
      const participants = game.players
        .map((id) => room.players.find((p) => p.id === id))
        .filter((p): p is PlayerRecord => Boolean(p?.profileId))
        .map((p) => ({ profileId: p.profileId!, nickname: p.nickname }));
      this.stats
        .recordRound({ participants, winnerProfileId: winner?.profileId ?? null, points })
        .catch((error: unknown) => logger.warn('Failed to record stats', { error: String(error) }));
    }
  }

  private removePlayer(room: Room, playerId: string, reason: 'left' | 'timeout' | 'kicked'): void {
    const index = room.players.findIndex((p) => p.id === playerId);
    if (index === -1) return;
    const [player] = room.players.splice(index, 1);
    this.clearGraceTimer(room.code, playerId);
    if (player.socketId) this.sessions.delete(player.socketId);
    delete room.scores[playerId];
    const events: GameEvent[] = [{ type: 'playerLeft', playerId, nickname: player.nickname, reason }];

    if (room.players.length === 0) {
      this.deleteRoom(room.code);
      return;
    }

    if (room.hostId === playerId) {
      const next = room.players.find((p) => p.connected) ?? room.players[0];
      room.hostId = next.id;
      this.clearHostTimer(room.code);
      events.push({ type: 'hostChanged', playerId: next.id, nickname: next.nickname });
    }

    const game = room.game;
    if (game?.hands[playerId]) {
      const wasActive = room.status === 'playing' && !game.finished;
      const previousTurn = game.turnId;
      events.push(...this.engine.removePlayer(game, playerId));
      if (wasActive && game.finished) this.finishRound(room, events);
      else if (wasActive && game.turnId !== previousTurn) this.scheduleTurnTimer(room);
    }

    this.touch(room);
    this.store.save(room);
    this.notifier.roomUpdated(room, events);
  }

  private deleteRoom(code: string): void {
    const room = this.store.get(code);
    this.clearTurnTimer(code);
    this.clearHostTimer(code);
    for (const [key, timer] of this.graceTimers) {
      if (key.startsWith(`${code}:`)) {
        clearTimeout(timer);
        this.graceTimers.delete(key);
      }
    }
    if (room) for (const p of room.players) if (p.socketId) this.sessions.delete(p.socketId);
    this.store.delete(code);
    logger.info('Room closed', { room: code });
  }

  private closeRoom(room: Room, message: string): void {
    for (const p of room.players) {
      if (p.socketId) this.notifier.sessionEnded(p.socketId, 'roomClosed', message);
    }
    this.deleteRoom(room.code);
  }

  private sweep(): void {
    const now = this.now();
    for (const room of this.store.all()) {
      if (now - room.lastActivityAt > this.roomIdleMs) {
        this.closeRoom(room, 'This room was closed because nobody played for a while.');
      }
    }
  }

  private touch(room: Room): void {
    room.lastActivityAt = this.now();
  }

  // ------------------------------------------------------------------ timers

  private turnLengthMs(room: Room): number {
    return this.turnDurationOverrideMs ?? room.settings.turnSeconds * 1000;
  }

  private scheduleTurnTimer(room: Room, overrideMs?: number): void {
    this.clearTurnTimer(room.code);
    const game = room.game;
    if (room.status !== 'playing' || !game || game.finished) {
      room.turnEndsAt = 0;
      return;
    }
    const current = room.players.find((p) => p.id === this.engine.currentPlayerId(game));
    let ms = overrideMs ?? this.turnLengthMs(room);
    if (current && !current.connected) ms = Math.min(ms, this.disconnectedTurnMs);
    room.turnDurationMs = ms;
    room.turnEndsAt = this.now() + ms;
    this.setTurnTimeout(room.code, game.turnId, ms);
  }

  private ensureTurnTime(room: Room, minMs: number): void {
    const game = room.game;
    if (!game || room.turnEndsAt - this.now() >= minMs) return;
    this.clearTurnTimer(room.code);
    room.turnEndsAt = this.now() + minMs;
    this.setTurnTimeout(room.code, game.turnId, minMs);
  }

  private setTurnTimeout(code: string, turnId: number, ms: number): void {
    const timer = setTimeout(() => this.safely(() => this.onTurnTimeout(code, turnId)), ms);
    timer.unref();
    this.turnTimers.set(code, timer);
  }

  private onTurnTimeout(code: string, turnId: number): void {
    this.turnTimers.delete(code);
    const room = this.store.get(code);
    const game = room?.game;
    if (!room || !game || room.status !== 'playing' || game.finished || game.turnId !== turnId) return;
    const events = this.engine.timeoutTurn(game);
    this.afterGameAction(room, events, turnId);
  }

  private clearTurnTimer(code: string): void {
    const timer = this.turnTimers.get(code);
    if (timer) clearTimeout(timer);
    this.turnTimers.delete(code);
  }

  private scheduleGraceRemoval(room: Room, playerId: string): void {
    this.clearGraceTimer(room.code, playerId);
    const code = room.code;
    const ms = room.status === 'lobby' ? this.lobbyGraceMs : this.gameGraceMs;
    const timer = setTimeout(
      () =>
        this.safely(() => {
          this.graceTimers.delete(`${code}:${playerId}`);
          const current = this.store.get(code);
          const player = current?.players.find((p) => p.id === playerId);
          if (current && player && !player.connected) this.removePlayer(current, playerId, 'timeout');
        }),
      ms,
    );
    timer.unref();
    this.graceTimers.set(`${code}:${playerId}`, timer);
  }

  private clearGraceTimer(code: string, playerId: string): void {
    const key = `${code}:${playerId}`;
    const timer = this.graceTimers.get(key);
    if (timer) clearTimeout(timer);
    this.graceTimers.delete(key);
  }

  private scheduleHostTransfer(room: Room): void {
    this.clearHostTimer(room.code);
    const code = room.code;
    const timer = setTimeout(
      () =>
        this.safely(() => {
          this.hostTimers.delete(code);
          const current = this.store.get(code);
          const host = current?.players.find((p) => p.id === current.hostId);
          if (!current || !host || host.connected) return;
          const next = current.players.find((p) => p.connected);
          if (!next) return;
          current.hostId = next.id;
          this.store.save(current);
          this.notifier.roomUpdated(current, [{ type: 'hostChanged', playerId: next.id, nickname: next.nickname }]);
        }),
      this.hostTransferMs,
    );
    timer.unref();
    this.hostTimers.set(code, timer);
  }

  private clearHostTimer(code: string): void {
    const timer = this.hostTimers.get(code);
    if (timer) clearTimeout(timer);
    this.hostTimers.delete(code);
  }

  /** Timer callbacks must never crash the process. */
  private safely(fn: () => void): void {
    try {
      fn();
    } catch (error) {
      logger.error('Room timer failed', { error: error instanceof Error ? (error.stack ?? error.message) : String(error) });
    }
  }
}
