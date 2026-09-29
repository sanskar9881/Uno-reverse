import type { ClientState, GameEvent } from '@shared';
import { HOUSE_RULE_LABELS } from '../components/game/HouseRuleChips';
import { toast } from '../store/toastStore';
import { useFxStore } from '../store/fxStore';
import { DRAW_PILE, centerOf, seatKey } from './domRegistry';
import { playSound } from './sounds';

/** Turns the server's event batch into sounds, toasts and flying-card animations. */
export function reactToState(prev: ClientState | null, next: ClientState): void {
  const self = next.selfId;
  const nameOf = (id: string): string =>
    next.room.players.find((p) => p.id === id)?.nickname ?? prev?.room.players.find((p) => p.id === id)?.nickname ?? 'Someone';
  const who = (id: string): string => (id === self ? 'You' : nameOf(id));
  const penalized = new Set(
    next.events
      .filter((e): e is Extract<GameEvent, { type: 'cardDrawn' }> => e.type === 'cardDrawn')
      .filter((e) => e.reason === 'draw2' || e.reason === 'wild4' || e.reason === 'wild4Challenge')
      .map((e) => e.playerId),
  );

  for (const e of next.events) {
    switch (e.type) {
      case 'playerJoined':
        if (e.playerId !== self) {
          playSound('join');
          toast(`${e.nickname} joined`, 'good', '👋');
        }
        break;
      case 'playerLeft':
        playSound('leave');
        toast(
          e.reason === 'kicked'
            ? `${e.nickname} was removed by the host`
            : e.reason === 'timeout'
              ? `${e.nickname} lost connection and left`
              : `${e.nickname} left the room`,
          'info',
          '🚪',
        );
        break;
      case 'playerDisconnected':
        if (e.playerId !== self) toast(`${e.nickname} disconnected. Saving their seat for a bit.`, 'bad', '📡');
        break;
      case 'playerReconnected':
        if (e.playerId !== self) toast(`${e.nickname} is back`, 'good', '📶');
        break;
      case 'hostChanged':
        toast(e.playerId === self ? "You're the host now" : `${e.nickname} is the host now`, 'info', '👑');
        break;
      case 'settingsChanged': {
        const before = prev?.room.settings;
        if (!before || before.turnSeconds !== e.settings.turnSeconds || before.targetScore !== e.settings.targetScore) {
          toast(
            `Settings updated: ${e.settings.turnSeconds}-second turns, ${
              e.settings.targetScore ? `first to ${e.settings.targetScore} points wins` : 'no score limit'
            }`,
            'info',
            '⚙️',
          );
        }
        if (before && before.houseRules !== e.settings.houseRules) {
          const keys = Object.keys(HOUSE_RULE_LABELS) as (keyof typeof HOUSE_RULE_LABELS)[];
          const changed = keys.find((key) => before.houseRules[key] !== e.settings.houseRules[key]);
          if (changed) {
            const on = e.settings.houseRules[changed];
            toast(`${HOUSE_RULE_LABELS[changed]} turned ${on ? 'on' : 'off'}`, 'info', '📜');
          }
        }
        break;
      }
      case 'gameStarted':
        playSound('draw');
        toast(
          `Round ${e.roundNumber}. ${e.firstPlayerId === self ? 'You go first!' : `${nameOf(e.firstPlayerId)} goes first.`}`,
          'info',
          '🃏',
        );
        break;
      case 'cardPlayed':
        playSound('play');
        if (e.card.value === 'wild' && e.chosenColor) toast(`${who(e.playerId)} picked ${e.chosenColor}`, 'info', '🎨');
        if (e.card.value === 'wild4' && e.chosenColor) {
          toast(`${who(e.playerId)} played Wild +4 and picked ${e.chosenColor}`, 'info', '🎨');
        }
        if (e.card.value === 'wildCustom') {
          const rule = next.room.settings.houseRules.customRuleText.trim();
          toast(rule ? `${who(e.playerId)} played Wild Customizable: ${rule}` : `${who(e.playerId)} played Wild Customizable`, 'info', '❓');
        }
        break;
      case 'cardDrawn':
        playSound('draw');
        if (e.reason === 'draw2' || e.reason === 'wild4') {
          toast(
            e.playerId === self
              ? `You draw ${e.count} and lose your turn`
              : `${nameOf(e.playerId)} draws ${e.count} and is skipped`,
            e.playerId === self ? 'bad' : 'info',
            e.reason === 'wild4' ? '➕' : '✌️',
          );
        }
        if (e.playerId !== self && e.count > 0) {
          const from = centerOf(DRAW_PILE);
          const to = centerOf(seatKey(e.playerId));
          if (from && to) useFxStore.getState().launch({ from, to, count: Math.min(e.count, 6) });
        }
        break;
      case 'skipped':
        if (!penalized.has(e.playerId)) {
          toast(e.playerId === self ? "You're skipped" : `${nameOf(e.playerId)} is skipped`, 'info', '⏭️');
        }
        break;
      case 'reversed':
        toast('Direction reversed', 'info', '🔄');
        break;
      case 'turnTimedOut':
        toast(e.playerId === self ? "Time's up. You drew a card." : `${nameOf(e.playerId)} ran out of time`, 'info', '⏰');
        break;
      case 'unoCalled':
        playSound('uno');
        toast(`${who(e.playerId)} called UNO!`, 'uno', '📣');
        break;
      case 'unoCaught':
        playSound('catch');
        toast(
          e.catcherId === self
            ? `You caught ${nameOf(e.playerId)}! They draw 2.`
            : e.playerId === self
              ? `${nameOf(e.catcherId)} caught you without UNO. Draw 2.`
              : `${nameOf(e.catcherId)} caught ${nameOf(e.playerId)} without UNO`,
          'bad',
          '🚨',
        );
        break;
      case 'deckReshuffled':
        toast('The discard pile was shuffled into a new deck', 'info', '🔀');
        break;
      case 'turnChanged':
        if (e.playerId === self) {
          playSound('yourTurn');
          navigator.vibrate?.(40);
        } else {
          playSound('turn');
        }
        break;
      case 'wild4Challenged': {
        const amMe = e.challengerId === self || e.challengedId === self;
        // The loser is whoever ends up drawing: the challenger if the play was legal, the challenged player if not.
        const iLost = e.legal ? e.challengerId === self : e.challengedId === self;
        playSound(e.legal ? 'error' : 'catch');
        toast(
          e.legal
            ? e.challengerId === self
              ? `You guessed wrong — ${nameOf(e.challengedId)} was honest. Draw 6 and lose your turn.`
              : `${nameOf(e.challengerId)} challenged ${nameOf(e.challengedId)} and guessed wrong.`
            : e.challengedId === self
              ? `${nameOf(e.challengerId)} caught your bluff! Draw the cards.`
              : e.challengerId === self
                ? `Caught them bluffing! ${nameOf(e.challengedId)} draws instead.`
                : `${nameOf(e.challengerId)} caught ${nameOf(e.challengedId)} bluffing.`,
          iLost ? 'bad' : 'info',
          '🔎',
        );
        if (amMe) navigator.vibrate?.(60);
        break;
      }
      case 'drawStacked':
        toast(`${who(e.playerId)} stacked it — up to ${e.amount} now`, 'info', '📚');
        break;
      case 'handsSwapped':
        toast(
          e.playerId === self || e.targetPlayerId === self
            ? `${who(e.playerId)} swapped hands with ${who(e.targetPlayerId)}`
            : `${nameOf(e.playerId)} swapped hands with ${nameOf(e.targetPlayerId)}`,
          'info',
          '🔁',
        );
        break;
      case 'handsRotated':
        toast('Every hand passed around the table', 'info', '🔁');
        break;
      case 'handsShuffled':
        toast(`${who(e.playerId)} shuffled every hand together`, 'info', '🌀');
        break;
      case 'jumpedIn':
        toast(`${who(e.playerId)} jumped in!`, 'info', '⚡');
        break;
      case 'roundOver':
        playSound('victory');
        break;
      case 'matchOver':
        break;
    }
  }
}
