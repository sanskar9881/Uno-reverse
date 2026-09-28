import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { describeCard, playableCardIds, type Card, type CardColor, type ClientState } from '@shared';
import { callUno, catchPlayer, drawCard, passTurn, playCard } from '../../game/actions';
import { rememberPlayOrigin } from '../../game/domRegistry';
import { arcPositions, opponentsInSeatOrder } from '../../game/seatLayout';
import { playSound } from '../../game/sounds';
import { useElementSize } from '../../hooks/useElementSize';
import { useIsCompact } from '../../hooks/useMediaQuery';
import { useViewport } from '../../hooks/useViewport';
import { useGameStore } from '../../store/gameStore';
import { toast } from '../../store/toastStore';
import { cn } from '../../utils/cn';
import { ActionBar } from './ActionBar';
import { ColorPicker } from './ColorPicker';
import { Hand, sortHand } from './Hand';
import { OpponentSeat, SEAT_BOX } from './OpponentSeat';
import { RoundOverModal } from './RoundOverModal';
import { TableCenter } from './TableCenter';
import { TopBar } from './TopBar';

const clamp = (min: number, value: number, max: number) => Math.min(max, Math.max(min, value));

const VALUE_WORDS: Record<string, string> = { skip: 'Skip', reverse: 'Reverse', draw2: '+2', wild: 'Wild', wild4: 'Wild +4' };

function statusLine(state: ClientState, myTurn: boolean, playableCount: number): string {
  const game = state.game!;
  if (game.finished || state.room.status !== 'playing') return 'Round over';
  if (!game.turnOrder.includes(state.selfId)) return "You'll be dealt in next round.";
  if (myTurn) {
    if (game.hasDrawnThisTurn) return 'You drew a card you can play. Play it or pass.';
    if (playableCount === 0) return 'No matching cards. Draw one.';
    const top = game.topCard;
    const symbol = top.color === 'wild' ? null : (VALUE_WORDS[top.value] ?? top.value);
    return symbol ? `Your turn. Play a ${game.currentColor} card or a ${symbol}.` : `Your turn. Play a ${game.currentColor} card.`;
  }
  const current = state.room.players.find((p) => p.id === game.currentPlayerId);
  if (!current) return 'Waiting…';
  return current.connected ? `${current.nickname}'s turn` : `${current.nickname} is offline. Their turn will pass soon.`;
}

export function GameBoard({ state, onLeave }: { state: ClientState; onLeave: () => void }) {
  const compact = useIsCompact();
  const viewport = useViewport();
  const tableRef = useRef<HTMLDivElement>(null);
  const table = useElementSize(tableRef);
  const busy = useGameStore((s) => s.busy);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingWild, setPendingWild] = useState<Card | null>(null);

  const game = state.game!;
  const self = state.selfId;
  const byId = useMemo(() => new Map(state.room.players.map((p) => [p.id, p])), [state.room.players]);
  const me = byId.get(self);
  const inRound = game.turnOrder.includes(self);
  const active = state.room.status === 'playing' && !game.finished;
  const myTurn = active && inRound && game.currentPlayerId === self;
  const playable = useMemo(
    () => (myTurn ? playableCardIds(state.hand, game.topCard, game.currentColor, game.drawnCardId) : new Set<string>()),
    [myTurn, state.hand, game.topCard, game.currentColor, game.drawnCardId],
  );
  const declared = game.unoDeclared.includes(self);
  const canDraw = myTurn && !game.hasDrawnThisTurn;
  const canPass = myTurn && game.hasDrawnThisTurn;
  const canUno =
    active && inRound && !declared && (state.hand.length === 1 || (state.hand.length === 2 && myTurn && playable.size > 0));
  const opponents = opponentsInSeatOrder(game.turnOrder, self)
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const vulnerable = game.unoVulnerableId && game.unoVulnerableId !== self ? byId.get(game.unoVulnerableId) : undefined;

  // Drop a stale selection when the hand or turn changes.
  useEffect(() => {
    if (selectedId && !state.hand.some((c) => c.id === selectedId)) setSelectedId(null);
  }, [state.hand, selectedId]);
  useEffect(() => {
    if (!myTurn) setPendingWild(null);
  }, [myTurn]);

  const commitPlay = useCallback(
    (card: Card, element: HTMLElement | null, color?: CardColor) => {
      if (element) {
        const r = element.getBoundingClientRect();
        rememberPlayOrigin(card.id, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }
      setSelectedId(null);
      void playCard(card.id, color);
    },
    [],
  );

  const tryPlay = useCallback(
    (card: Card, element: HTMLElement | null) => {
      if (!myTurn) {
        playSound('error');
        toast("It's not your turn yet.", 'info');
        return;
      }
      if (!playable.has(card.id)) {
        playSound('error');
        toast(
          game.hasDrawnThisTurn
            ? 'After drawing you can only play the card you drew.'
            : card.value === 'wild4' && card.color === 'wild'
              ? `Wild +4 only works when you have no ${game.currentColor} cards.`
              : `${describeCard(card)} doesn't match. Play a ${game.currentColor} card or the same symbol.`,
          'bad',
        );
        return;
      }
      if (card.color === 'wild') {
        if (element) {
          const r = element.getBoundingClientRect();
          rememberPlayOrigin(card.id, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
        }
        setPendingWild(card);
        return;
      }
      commitPlay(card, element);
    },
    [myTurn, playable, game.hasDrawnThisTurn, game.currentColor, commitPlay],
  );

  const onCardClick = (card: Card, element: HTMLElement) => {
    if (selectedId === card.id) tryPlay(card, element);
    else {
      playSound('click');
      setSelectedId(card.id);
    }
  };

  const onDraw = useCallback(() => {
    if (canDraw && !busy) void drawCard();
  }, [canDraw, busy]);
  const onPass = useCallback(() => {
    if (canPass && !busy) void passTurn();
  }, [canPass, busy]);
  const onUno = useCallback(() => {
    if (canUno) void callUno();
  }, [canUno]);

  // Keyboard: D draw, P pass, U UNO, ←/→ choose a card, Enter plays it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (pendingWild || e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'd') onDraw();
      else if (key === 'p') onPass();
      else if (key === 'u') onUno();
      else if (key === 'arrowleft' || key === 'arrowright') {
        const sorted = sortHand(state.hand);
        if (sorted.length === 0) return;
        const index = sorted.findIndex((c) => c.id === selectedId);
        const next = key === 'arrowright' ? index + 1 : index <= 0 ? sorted.length - 1 : index - 1;
        setSelectedId(sorted[(next + sorted.length) % sorted.length].id);
        e.preventDefault();
      } else if (key === 'enter' && selectedId && !(e.target instanceof HTMLButtonElement)) {
        const card = state.hand.find((c) => c.id === selectedId);
        const el = document.querySelector<HTMLElement>(`[data-card-id="${selectedId}"]`);
        if (card) tryPlay(card, el);
      } else if (key === 'escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDraw, onPass, onUno, pendingWild, selectedId, state.hand, tryPlay]);

  // Cards scale with the screen: height-bound on desktop, width-bound on phones.
  const handCardWidth = compact ? clamp(56, (viewport.width - 24) / 5.2, 86) : clamp(70, viewport.height * 0.12, 108);
  const pileCardWidth = compact ? clamp(62, viewport.width * 0.24, 96) : clamp(78, viewport.height * 0.13, 118);
  const seats = arcPositions(opponents.length, table, SEAT_BOX);
  const seatFor = (p: (typeof opponents)[number]) => (
    <OpponentSeat
      key={p.id}
      player={p}
      cardCount={game.cardCounts[p.id] ?? 0}
      isCurrent={active && game.currentPlayerId === p.id}
      declaredUno={game.unoDeclared.includes(p.id)}
      catchable={inRound && active && game.unoVulnerableId === p.id}
      onCatch={() => void catchPlayer(p.id)}
      turnEndsAt={game.turnEndsAt}
      turnDurationMs={game.turnDurationMs}
      compact={compact}
    />
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TopBar state={state} onLeave={onLeave} />

      {compact && (
        <div className="scrollbar-none flex shrink-0 justify-start gap-1 overflow-x-auto px-2 pb-1 pt-3 [&>*]:shrink-0 sm:justify-center">
          {opponents.map(seatFor)}
        </div>
      )}

      <div ref={tableRef} className="relative mx-auto w-full max-w-[1200px] min-h-0 flex-1">
        <div
          className={cn('felt absolute', compact ? 'inset-x-3 inset-y-2 rounded-[40px]' : 'inset-x-[11%] bottom-[6%] top-[16%] rounded-[50%]')}
          aria-hidden
        />
        <div className="absolute inset-x-0 top-[52%] flex -translate-y-1/2 justify-center">
          <TableCenter state={state} canDraw={canDraw && !busy} onDraw={onDraw} cardWidth={pileCardWidth} />
        </div>
        {!compact &&
          table.width > 0 &&
          opponents.map((p, i) => (
            <div
              key={p.id}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: seats[i].x, top: seats[i].y }}
            >
              {seatFor(p)}
            </div>
          ))}
        {vulnerable && inRound && active && (
          <div className="absolute inset-x-0 bottom-2 z-20 flex justify-center px-3">
            <button
              type="button"
              onClick={() => void catchPlayer(vulnerable.id)}
              className="animate-pulse rounded-2xl bg-card-red px-4 py-2 font-extrabold text-white shadow-[0_5px_0_#a52a30]"
            >
              {vulnerable.nickname} forgot to call UNO! Catch them
            </button>
          </div>
        )}
      </div>

      {inRound && me ? (
        <div className={cn('safe-bottom relative z-10 flex shrink-0 flex-col', compact ? 'gap-1 pt-1' : 'gap-2 pt-2')}>
          <ActionBar
            me={{ avatar: me.avatar, nickname: me.nickname, score: me.score, cards: state.hand.length }}
            myTurn={myTurn}
            canDraw={canDraw}
            canPass={canPass}
            canUno={canUno}
            declared={declared}
            busy={busy}
            status={statusLine(state, myTurn, playable.size)}
            turnEndsAt={game.turnEndsAt}
            turnDurationMs={game.turnDurationMs}
            onDraw={onDraw}
            onPass={onPass}
            onUno={onUno}
            compact={compact}
          />
          <div className="mx-auto w-full max-w-5xl px-2">
            <Hand
              cards={state.hand}
              playable={playable}
              myTurn={myTurn}
              selectedId={selectedId}
              onCardClick={onCardClick}
              onCardDoubleClick={(card, el) => tryPlay(card, el)}
              cardWidth={handCardWidth}
              compact={compact}
            />
          </div>
        </div>
      ) : (
        <p className="safe-bottom py-6 text-center font-semibold text-muted">You're watching. You'll be dealt in next round.</p>
      )}

      <ColorPicker
        open={pendingWild !== null}
        onPick={(color) => {
          const card = pendingWild;
          setPendingWild(null);
          if (card) commitPlay(card, null, color);
        }}
        onCancel={() => setPendingWild(null)}
      />
      <RoundOverModal state={state} onLeave={onLeave} />
    </div>
  );
}
