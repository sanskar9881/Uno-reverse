export const CARD_COLORS = ['red', 'yellow', 'green', 'blue'] as const;
export type CardColor = (typeof CARD_COLORS)[number];

export const NUMBER_VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
export type NumberValue = (typeof NUMBER_VALUES)[number];
export type ActionValue = 'skip' | 'reverse' | 'draw2';
export type WildValue = 'wild' | 'wild4';
export type CardValue = NumberValue | ActionValue | WildValue;

export interface Card {
  id: string;
  color: CardColor | 'wild';
  value: CardValue;
}

export type RoomStatus = 'lobby' | 'playing' | 'roundOver';

export type GameType = 'uno' | 'bottle' | 'couples';

export interface RoomSettings {
  turnSeconds: number;
  targetScore: number;
}

export type BottlePromptPack = 'off' | 'party' | 'flirty';

export interface BottlePartySettings {
  pack: BottlePromptPack;
  canLandOnSelf: boolean;
  clockwiseTurns: boolean;
}

export interface BottleSpinView {
  id: string;
  /** Player ids in seat order, snapshotted when the spin started. */
  seatOrder: string[];
  targetId: string;
  /** Server epoch ms when the spin animation started. */
  startedAt: number;
  durationMs: number;
}

/** Everything a player is allowed to know about an online Spin the Bottle table. Fully public. */
export interface BottleView {
  turnOrder: string[];
  spinnerId: string;
  turnId: number;
  spin: BottleSpinView | null;
  /** The prompt drawn after the most recent spin landed, or null before any spin / when the pack is off. */
  prompt: string | null;
  settings: BottlePartySettings;
}

export interface PublicPlayer {
  id: string;
  nickname: string;
  avatar: number;
  isHost: boolean;
  connected: boolean;
  score: number;
  /** Dealt into the current/last round. */
  inRound: boolean;
}

/** Everything a player is allowed to know about the table. Never contains other players' cards. */
export interface GameView {
  turnOrder: string[];
  currentPlayerId: string;
  direction: 1 | -1;
  currentColor: CardColor;
  topCard: Card;
  /** Last few discards (oldest → newest, newest is the top card). Discards are public. */
  recentDiscards: Card[];
  discardCount: number;
  drawPileCount: number;
  cardCounts: Record<string, number>;
  /** Players who have called UNO. */
  unoDeclared: string[];
  /** Player at one card who hasn't called UNO and can currently be caught. */
  unoVulnerableId: string | null;
  turnId: number;
  /** Server epoch ms when the current turn auto-ends. 0 when not running. */
  turnEndsAt: number;
  turnDurationMs: number;
  hasDrawnThisTurn: boolean;
  /** Only populated for the viewer, and only on their own turn after drawing a playable card. */
  drawnCardId: string | null;
  finished: boolean;
}

export interface RoundResult {
  roundNumber: number;
  winnerId: string;
  winnerName: string;
  points: number;
  reason: 'emptiedHand' | 'forfeit';
  cardsLeft: Record<string, number>;
  pointsByPlayer: Record<string, number>;
  matchWinnerId: string | null;
}

export interface RoomView {
  code: string;
  hostId: string;
  gameType: GameType;
  status: RoomStatus;
  settings: RoomSettings;
  /** Lobby-editable options for a non-UNO game, e.g. the bottle's prompt pack. Unused by UNO rooms. */
  partySettings: BottlePartySettings;
  players: PublicPlayer[];
  roundNumber: number;
  lastRound: RoundResult | null;
}

export type DrawReason = 'draw' | 'draw2' | 'wild4' | 'unoPenalty' | 'timeout';

export type GameEvent =
  | { type: 'playerJoined'; playerId: string; nickname: string }
  | { type: 'playerLeft'; playerId: string; nickname: string; reason: 'left' | 'timeout' | 'kicked' }
  | { type: 'playerDisconnected'; playerId: string; nickname: string }
  | { type: 'playerReconnected'; playerId: string; nickname: string }
  | { type: 'hostChanged'; playerId: string; nickname: string }
  | { type: 'settingsChanged'; settings: RoomSettings }
  | { type: 'gameStarted'; roundNumber: number; firstPlayerId: string }
  | { type: 'cardPlayed'; playerId: string; card: Card; chosenColor: CardColor | null }
  | { type: 'cardDrawn'; playerId: string; count: number; reason: DrawReason }
  | { type: 'skipped'; playerId: string }
  | { type: 'reversed'; direction: 1 | -1 }
  | { type: 'turnPassed'; playerId: string; auto: boolean }
  | { type: 'turnTimedOut'; playerId: string }
  | { type: 'unoCalled'; playerId: string }
  | { type: 'unoCaught'; playerId: string; catcherId: string }
  | { type: 'deckReshuffled' }
  | { type: 'turnChanged'; playerId: string }
  | { type: 'roundOver'; winnerId: string; points: number; reason: 'emptiedHand' | 'forfeit' }
  | { type: 'matchOver'; winnerId: string };

/** The complete, personalized snapshot a single player receives after every change. */
export interface ClientState {
  serverTime: number;
  selfId: string;
  room: RoomView;
  game: GameView | null;
  hand: Card[];
  events: GameEvent[];
  /** Non-UNO game state (Spin the Bottle, Couples), or null in a UNO room. */
  party: BottleView | null;
}
