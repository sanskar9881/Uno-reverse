export const CARD_COLORS = ['red', 'yellow', 'green', 'blue'] as const;
export type CardColor = (typeof CARD_COLORS)[number];

export const NUMBER_VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
export type NumberValue = (typeof NUMBER_VALUES)[number];
export type ActionValue = 'skip' | 'reverse' | 'draw2';
export type WildValue = 'wild' | 'wild4' | 'wildShuffle' | 'wildCustom';
export type CardValue = NumberValue | ActionValue | WildValue;

export interface Card {
  id: string;
  color: CardColor | 'wild';
  value: CardValue;
}

export type RoomStatus = 'lobby' | 'playing' | 'roundOver';

export type GameType = 'uno' | 'spin' | 'couples' | 'intimacy' | 'group';

/** Off by default. The host toggles these in the lobby, before a round starts. */
export interface HouseRules {
  /** A Draw Two answers a Draw Two, a Wild +4 answers a Wild +4; the total falls on whoever can't stack. */
  stacking: boolean;
  /** Can't play? Keep drawing until you can, instead of drawing just one. */
  drawUntilPlayable: boolean;
  /** A drawn card must be played immediately if it's playable. */
  mustPlayDrawn: boolean;
  /** Playing a 7 swaps hands with a chosen player; playing a 0 rotates every hand one seat. */
  sevenZero: boolean;
  /** Hold an exact match for the top card? Play it out of turn. */
  jumpIn: boolean;
  /** The 112-card deck: one Wild Shuffle Hands, three Wild Customizable. */
  modernDeck: boolean;
  /** Shown when a Wild Customizable card is played. */
  customRuleText: string;
}

export interface RoomSettings {
  turnSeconds: number;
  targetScore: number;
  houseRules: HouseRules;
}

export type BottlePromptPack = 'off' | 'party' | 'flirty';

/** "Spin It": Wheel or Bottle, switchable at any time without losing the shared name list. */
export type SpinMode = 'wheel' | 'bottle';

export interface BottlePartySettings {
  mode: SpinMode;
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

export type CouplesLevel = 'sweet' | 'flirty' | 'spicy';
export type CouplesKind = 'truth' | 'dare';

export interface CouplesCard {
  level: CouplesLevel;
  kind: CouplesKind;
  text: string;
  /** A data URL, when the card came from Our Deck with a photo attached. */
  photo?: string | null;
}

/** Everything both partners are allowed to know about an online Couples session. Fully public to the two of them. */
export interface CouplesView {
  /** Each partner's own chosen comfort level. The game plays at the lower of the two. */
  levels: Record<string, CouplesLevel>;
  /** When true, only Our Deck cards are drawn; the built-in deck is skipped. */
  onlyOurs: boolean;
  currentPartnerId: string;
  turnId: number;
  card: CouplesCard | null;
}

export type IntimacyCategory = 'kiss' | 'touch' | 'flirtyTalk' | 'mood' | 'romance';

export interface IntimacyCard {
  level: CouplesLevel;
  category: IntimacyCategory;
  text: string;
  /** A data URL, when the card came from Our Deck with a photo attached. */
  photo?: string | null;
}

/** Everything both partners are allowed to know about an online Intimacy Night session. Fully public to the two of them. */
export interface IntimacyView {
  /** Each partner's own chosen comfort level. The game plays at the lower of the two. */
  levels: Record<string, CouplesLevel>;
  /** Categories currently included, chosen jointly. At least one is always selected. */
  categories: IntimacyCategory[];
  /** When true, only Our Deck cards are drawn; the built-in deck is skipped. */
  onlyOurs: boolean;
  currentPartnerId: string;
  turnId: number;
  card: IntimacyCard | null;
}

export type GroupCardType = 'normal' | 'spicy' | 'revealing';

export interface GroupCard {
  cardType: GroupCardType;
  kind: CouplesKind;
  /** {left} and {right} already replaced with the real neighbor names of whoever is up. */
  text: string;
  /** Seconds for a timed dare — from the built-in deck's text, or a custom card's explicit timer. */
  timerSeconds: number | null;
}

export type GroupPickMode = 'order' | 'spin';

/** Everything every player is allowed to know about an online Truth and Dare Group session. */
export interface GroupView {
  /** Player ids in seating order. */
  turnOrder: string[];
  currentPlayerId: string;
  turnId: number;
  /** Card types currently included. At least one is always selected. */
  types: GroupCardType[];
  pickMode: GroupPickMode;
  /** Hides dares tagged as involving touch. */
  noTouch: boolean;
  /** Off by default: when off, drink dares are skipped entirely. */
  drinks: boolean;
  /** Cosmetic only: the client shows a fun penalty message on Pass; the server doesn't enforce one. */
  passPenalty: boolean;
  /** True while waiting for someone to tap Spin (pickMode 'spin' only, between Done and the next card). */
  awaitingSpin: boolean;
  card: GroupCard | null;
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
  /** A Draw Two or Wild +4 (or a stacked chain of them) waiting on toPlayerId to accept, challenge or stack. */
  pendingDraw: PendingDrawView | null;
  houseRules: HouseRules;
}

export interface PendingDrawView {
  kind: 'draw2' | 'wild4';
  amount: number;
  fromPlayerId: string;
  toPlayerId: string;
  /** Only true for a Wild +4: the next player may challenge instead of accepting. */
  canChallenge: boolean;
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

export type DrawReason = 'draw' | 'draw2' | 'wild4' | 'unoPenalty' | 'timeout' | 'wild4Challenge';

export type GameEvent =
  | { type: 'playerJoined'; playerId: string; nickname: string }
  | { type: 'playerLeft'; playerId: string; nickname: string; reason: 'left' | 'timeout' | 'kicked' }
  | { type: 'playerDisconnected'; playerId: string; nickname: string }
  | { type: 'playerReconnected'; playerId: string; nickname: string }
  | { type: 'hostChanged'; playerId: string; nickname: string }
  | { type: 'settingsChanged'; settings: RoomSettings }
  | { type: 'gameStarted'; roundNumber: number; firstPlayerId: string }
  | { type: 'cardPlayed'; playerId: string; card: Card; chosenColor: CardColor | null; targetPlayerId?: string }
  | { type: 'cardDrawn'; playerId: string; count: number; reason: DrawReason }
  | { type: 'skipped'; playerId: string }
  | { type: 'reversed'; direction: 1 | -1 }
  | { type: 'turnPassed'; playerId: string; auto: boolean }
  | { type: 'turnTimedOut'; playerId: string }
  | { type: 'unoCalled'; playerId: string }
  | { type: 'unoCaught'; playerId: string; catcherId: string }
  | { type: 'deckReshuffled' }
  | { type: 'turnChanged'; playerId: string }
  | { type: 'drawStacked'; playerId: string; amount: number }
  | { type: 'wild4Challenged'; challengerId: string; challengedId: string; legal: boolean }
  | { type: 'handsSwapped'; playerId: string; targetPlayerId: string }
  | { type: 'handsRotated' }
  | { type: 'handsShuffled'; playerId: string }
  | { type: 'jumpedIn'; playerId: string }
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
  /**
   * The one deliberate exception to hand privacy: right after you challenge a Wild +4,
   * you briefly see the challenged player's full hand, as in the physical game. Null
   * otherwise, and for everyone else.
   */
  revealedHand: { ownerId: string; cards: Card[] } | null;
  /** Non-UNO game state (Spin the Bottle, Couples, Intimacy Night), or null in a UNO room. */
  party: BottleView | CouplesView | IntimacyView | GroupView | null;
}
