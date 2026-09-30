import type {
  BottlePartySettings,
  CardColor,
  ClientState,
  CouplesCard,
  CouplesKind,
  CouplesLevel,
  GameType,
  HouseRules,
  IntimacyCard,
  IntimacyCategory,
  RoomSettings,
} from './types';

export type RoomSettingsPatch = Partial<Omit<RoomSettings, 'houseRules'>> & { houseRules?: Partial<HouseRules> };

export type ErrorCode =
  | 'INVALID_PAYLOAD'
  | 'RATE_LIMITED'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'NAME_TAKEN'
  | 'GAME_IN_PROGRESS'
  | 'NOT_IN_ROOM'
  | 'NOT_HOST'
  | 'NOT_ENOUGH_PLAYERS'
  | 'INVALID_STATE'
  | 'NOT_IN_GAME'
  | 'NOT_YOUR_TURN'
  | 'STALE_ACTION'
  | 'CARD_NOT_IN_HAND'
  | 'INVALID_PLAY'
  | 'COLOR_REQUIRED'
  | 'MUST_PLAY_DRAWN_CARD'
  | 'ALREADY_DRAWN'
  | 'MUST_DRAW_FIRST'
  | 'CANNOT_CALL_UNO'
  | 'NOTHING_TO_CATCH'
  | 'PENDING_DRAW'
  | 'NOTHING_TO_CHALLENGE'
  | 'TARGET_REQUIRED'
  | 'CANNOT_JUMP_IN'
  | 'SESSION_EXPIRED'
  | 'SERVER_BUSY'
  | 'INTERNAL';

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
  /** A free name the client can offer with a one-tap retry, set only for NAME_TAKEN. */
  suggestion?: string;
}

export type AckResponse<T extends object = object> = ({ ok: true } & T) | { ok: false; error: ErrorPayload };
export type Ack<T extends object = object> = (response: AckResponse<T>) => void;

export interface JoinResult {
  roomCode: string;
  playerId: string;
  token: string;
}

export interface ProfilePayload {
  nickname: string;
  avatar: number;
  profileId?: string;
}

export interface CreateRoomPayload extends ProfilePayload {
  gameType?: GameType;
}

export type EmptyPayload = Record<string, never>;

export interface ClientToServerEvents {
  'room:create': (payload: CreateRoomPayload, ack: Ack<JoinResult>) => void;
  'room:join': (payload: ProfilePayload & { roomCode: string }, ack: Ack<JoinResult>) => void;
  'room:rejoin': (payload: { roomCode: string; token: string }, ack: Ack<{ roomCode: string; playerId: string }>) => void;
  'room:leave': (payload: EmptyPayload, ack: Ack) => void;
  'room:settings': (payload: RoomSettingsPatch, ack: Ack) => void;
  'room:kick': (payload: { playerId: string }, ack: Ack) => void;
  'game:start': (payload: EmptyPayload, ack: Ack) => void;
  'game:play': (
    payload: { turnId: number; cardId: string; chosenColor?: CardColor; targetPlayerId?: string },
    ack: Ack,
  ) => void;
  'game:draw': (payload: { turnId: number }, ack: Ack<{ playable: boolean }>) => void;
  'game:pass': (payload: { turnId: number }, ack: Ack) => void;
  'game:uno': (payload: EmptyPayload, ack: Ack) => void;
  'game:catch': (payload: { targetId: string }, ack: Ack) => void;
  'game:acceptDraw': (payload: { turnId: number }, ack: Ack) => void;
  'game:challenge': (payload: { turnId: number }, ack: Ack) => void;
  'game:jumpIn': (payload: { cardId: string; chosenColor?: CardColor; targetPlayerId?: string }, ack: Ack) => void;
  'game:nextRound': (payload: EmptyPayload, ack: Ack) => void;
  'game:rematch': (payload: EmptyPayload, ack: Ack) => void;
  'bottle:settings': (payload: Partial<BottlePartySettings>, ack: Ack) => void;
  'bottle:spin': (payload: { turnId: number }, ack: Ack) => void;
  'couples:choose': (payload: { kind: CouplesKind; turnId: number }, ack: Ack<{ card: CouplesCard }>) => void;
  'couples:pass': (payload: { turnId: number }, ack: Ack<{ card: CouplesCard }>) => void;
  'couples:done': (payload: { turnId: number }, ack: Ack) => void;
  'couples:level': (payload: { level: CouplesLevel }, ack: Ack) => void;
  'couples:addCard': (payload: { level: CouplesLevel; kind: CouplesKind; text: string; photo?: string | null }, ack: Ack) => void;
  'couples:onlyOurs': (payload: { value: boolean }, ack: Ack) => void;
  'intimacy:draw': (payload: { turnId: number }, ack: Ack<{ card: IntimacyCard }>) => void;
  'intimacy:done': (payload: { turnId: number }, ack: Ack) => void;
  'intimacy:level': (payload: { level: CouplesLevel }, ack: Ack) => void;
  'intimacy:categories': (payload: { categories: IntimacyCategory[] }, ack: Ack) => void;
  'intimacy:addCard': (
    payload: { level: CouplesLevel; category: IntimacyCategory; text: string; photo?: string | null },
    ack: Ack,
  ) => void;
  'intimacy:onlyOurs': (payload: { value: boolean }, ack: Ack) => void;
}

export type SessionEndReason = 'kicked' | 'replaced' | 'roomClosed';

export interface ServerToClientEvents {
  state: (state: ClientState) => void;
  'session:ended': (payload: { reason: SessionEndReason; message: string }) => void;
}
