export type * from '@shared';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';

export interface StoredSession {
  roomCode: string;
  playerId: string;
  token: string;
}

export interface Profile {
  nickname: string;
  avatar: number;
  profileId: string;
  muted: boolean;
}
