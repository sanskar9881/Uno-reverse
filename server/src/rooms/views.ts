import type { ClientState, GameEvent, PublicPlayer, RoomView } from '@shared';
import { buildGameView } from '../game/views';
import { buildBottleView } from '../games/bottle/engine';
import { buildCouplesView } from '../games/couples/engine';
import { buildIntimacyView } from '../games/intimacy/engine';
import type { Room } from './types';

function buildPartyView(room: Room) {
  if (!room.party) return null;
  if (room.party.kind === 'bottle') return buildBottleView(room.party);
  if (room.party.kind === 'couples') return buildCouplesView(room.party);
  return buildIntimacyView(room.party);
}

export function buildRoomView(room: Room): RoomView {
  const players: PublicPlayer[] = room.players.map((p) => ({
    id: p.id,
    nickname: p.nickname,
    avatar: p.avatar,
    isHost: p.id === room.hostId,
    connected: p.connected,
    score: room.scores[p.id] ?? 0,
    inRound: Boolean(room.game?.hands[p.id]),
  }));
  return {
    code: room.code,
    hostId: room.hostId,
    gameType: room.gameType,
    status: room.status,
    settings: { ...room.settings },
    partySettings: { ...room.partySettings },
    players,
    roundNumber: room.roundNumber,
    lastRound: room.lastRound,
  };
}

/** The personalized snapshot for one player: public table info plus their own hand only. */
export function buildClientState(room: Room, viewerId: string, events: GameEvent[], now: number): ClientState {
  const game = room.game;
  const revealing =
    room.revealViewerId === viewerId && room.revealOwnerId && now < room.revealEndsAt
      ? game?.hands[room.revealOwnerId]
      : undefined;
  return {
    serverTime: now,
    selfId: viewerId,
    room: buildRoomView(room),
    game: game
      ? buildGameView(game, viewerId, { turnEndsAt: room.turnEndsAt, turnDurationMs: room.turnDurationMs })
      : null,
    hand: game?.hands[viewerId] ? game.hands[viewerId].map((c) => ({ ...c })) : [],
    events,
    revealedHand: revealing ? { ownerId: room.revealOwnerId!, cards: revealing.map((c) => ({ ...c })) } : null,
    party: buildPartyView(room),
  };
}
