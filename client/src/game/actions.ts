import type { BottlePartySettings, CardColor, CouplesKind, CouplesLevel, IntimacyCategory, RoomSettingsPatch } from '@shared';
import { request, type ClientErrorCode, type RequestResult } from '../socket/socket';
import { useGameStore } from '../store/gameStore';
import { toast } from '../store/toastStore';
import { clearSession } from '../utils/storage';
import { playSound } from './sounds';

const FRIENDLIER: Partial<Record<ClientErrorCode, string>> = {
  STALE_ACTION: 'Too late, the turn already moved on.',
  NOT_YOUR_TURN: "Hold on, it's not your turn.",
};

/** Sends an action, blocks double submits while it's in flight, and toasts server rejections. */
async function send(
  run: () => Promise<RequestResult>,
  options: { quiet?: ClientErrorCode[]; allowWhileBusy?: boolean } = {},
): Promise<RequestResult> {
  const store = useGameStore.getState();
  if (store.busy && !options.allowWhileBusy) return { ok: false, error: { code: 'RATE_LIMITED', message: '' } };
  store.setBusy(true);
  try {
    const res = await run();
    if (!res.ok && !options.quiet?.includes(res.error.code)) {
      playSound('error');
      toast(FRIENDLIER[res.error.code] ?? res.error.message, 'bad');
    }
    return res;
  } finally {
    useGameStore.getState().setBusy(false);
  }
}

const turnId = (): number => useGameStore.getState().state?.game?.turnId ?? -1;

export const playCard = (cardId: string, chosenColor?: CardColor, targetPlayerId?: string) =>
  send(() => request('game:play', { turnId: turnId(), cardId, chosenColor, targetPlayerId }));

export const drawCard = () => send(() => request('game:draw', { turnId: turnId() }));

export const passTurn = () => send(() => request('game:pass', { turnId: turnId() }));

export const acceptDraw = () => send(() => request('game:acceptDraw', { turnId: turnId() }));

export const challengeWild4 = () => send(() => request('game:challenge', { turnId: turnId() }));

export const jumpIn = (cardId: string, chosenColor?: CardColor, targetPlayerId?: string) =>
  send(() => request('game:jumpIn', { cardId, chosenColor, targetPlayerId }), { quiet: ['CANNOT_JUMP_IN'] });

export const callUno = () => send(() => request('game:uno', {}), { allowWhileBusy: true });

export const catchPlayer = (targetId: string) =>
  send(() => request('game:catch', { targetId }), { quiet: ['NOTHING_TO_CATCH'], allowWhileBusy: true }).then((res) => {
    if (!res.ok && res.error.code === 'NOTHING_TO_CATCH') toast('Too slow, they got away with it.', 'info', '💨');
    return res;
  });

export const startGame = () => send(() => request('game:start', {}));
export const updateBottleSettings = (patch: Partial<BottlePartySettings>) => send(() => request('bottle:settings', patch));
export const spinBottle = () =>
  send(() => request('bottle:spin', { turnId: useGameStore.getState().state?.party?.turnId ?? -1 }));

const partyTurnId = (): number => useGameStore.getState().state?.party?.turnId ?? -1;

export const couplesChoose = (kind: CouplesKind) => send(() => request('couples:choose', { kind, turnId: partyTurnId() }));
export const couplesPass = () => send(() => request('couples:pass', { turnId: partyTurnId() }));
export const couplesDone = () => send(() => request('couples:done', { turnId: partyTurnId() }));
export const couplesSetLevel = (level: CouplesLevel) => send(() => request('couples:level', { level }), { allowWhileBusy: true });
export const couplesAddCard = (level: CouplesLevel, kind: CouplesKind, text: string, photo: string | null = null) =>
  send(() => request('couples:addCard', { level, kind, text, photo }));
export const couplesSetOnlyOurs = (value: boolean) =>
  send(() => request('couples:onlyOurs', { value }), { allowWhileBusy: true });

export const intimacyDraw = () => send(() => request('intimacy:draw', { turnId: partyTurnId() }));
export const intimacyDone = () => send(() => request('intimacy:done', { turnId: partyTurnId() }));
export const intimacySetLevel = (level: CouplesLevel) => send(() => request('intimacy:level', { level }), { allowWhileBusy: true });
export const intimacySetCategories = (categories: IntimacyCategory[]) =>
  send(() => request('intimacy:categories', { categories }), { allowWhileBusy: true });
export const intimacyAddCard = (level: CouplesLevel, category: IntimacyCategory, text: string, photo: string | null = null) =>
  send(() => request('intimacy:addCard', { level, category, text, photo }));
export const intimacySetOnlyOurs = (value: boolean) =>
  send(() => request('intimacy:onlyOurs', { value }), { allowWhileBusy: true });

export const nextRound = () => send(() => request('game:nextRound', {}));
export const rematch = () => send(() => request('game:rematch', {}));
export const updateSettings = (patch: RoomSettingsPatch) => send(() => request('room:settings', patch));
export const kickPlayer = (playerId: string) => send(() => request('room:kick', { playerId }));

/** Leaves the room and forgets the seat, even if the server can't be reached. */
export async function leaveRoom(): Promise<void> {
  await request('room:leave', {}, 3000);
  clearSession();
  useGameStore.getState().reset();
}
