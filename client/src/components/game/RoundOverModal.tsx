import confetti from 'canvas-confetti';
import { motion } from 'motion/react';
import { useEffect } from 'react';
import type { ClientState } from '@shared';
import { nextRound, rematch } from '../../game/actions';
import { useGameStore } from '../../store/gameStore';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Scoreboard } from './Scoreboard';

const CONFETTI_COLORS = ['#F2474D', '#FFC53D', '#22C58B', '#3D8BFF', '#ffffff'];

function celebrate(big: boolean) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  confetti({ particleCount: big ? 160 : 70, spread: big ? 100 : 70, origin: { y: 0.35 }, colors: CONFETTI_COLORS, zIndex: 60 });
  if (!big) return;
  setTimeout(() => {
    confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: CONFETTI_COLORS, zIndex: 60 });
    confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: CONFETTI_COLORS, zIndex: 60 });
  }, 250);
}

export function RoundOverModal({ state, onLeave }: { state: ClientState; onLeave: () => void }) {
  const busy = useGameStore((s) => s.busy);
  const { room, selfId } = state;
  const result = room.lastRound;
  const open = room.status === 'roundOver' && result !== null;
  const winner = room.players.find((p) => p.id === result?.winnerId);
  const iWon = result?.winnerId === selfId;
  const isHost = room.hostId === selfId;
  const host = room.players.find((p) => p.id === room.hostId);
  const matchOver = Boolean(result?.matchWinnerId);

  useEffect(() => {
    if (open && result) celebrate(result.winnerId === selfId || matchOver);
  }, [open, result?.roundNumber, result?.winnerId]);

  if (!result) return null;
  const winnerName = iWon ? 'You' : (winner?.nickname ?? result.winnerName);
  const title = matchOver
    ? `${winnerName} ${iWon ? 'win' : 'wins'} the match!`
    : result.reason === 'forfeit'
      ? `${winnerName} ${iWon ? 'win' : 'wins'} by default`
      : `${winnerName} ${iWon ? 'win' : 'wins'} round ${result.roundNumber}!`;

  return (
    <Modal open={open} label="Round results" className="max-w-lg">
      <div className="flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}
          className="relative"
        >
          <Avatar index={winner?.avatar ?? 0} size={88} />
          <span className="absolute -right-2 -top-3 text-3xl" aria-hidden>
            🏆
          </span>
        </motion.div>
        <h2 className="mt-4 font-display text-3xl leading-tight">{title}</h2>
        <p className="mt-1 text-muted">
          {result.reason === 'forfeit'
            ? 'Everyone else left the table.'
            : `+${result.points} points from the cards left in other hands.`}
        </p>
      </div>

      <div className="mt-5 max-h-[40vh] overflow-y-auto">
        <Scoreboard state={state} showRound={result.reason !== 'forfeit'} />
      </div>
      {room.settings.targetScore > 0 && !matchOver && (
        <p className="mt-2 text-center text-sm text-muted">First to {room.settings.targetScore} points wins the match.</p>
      )}

      <div className="mt-6 flex flex-col gap-2">
        {isHost ? (
          <div className="grid grid-cols-2 gap-2">
            {!matchOver && (
              <Button size="lg" onClick={() => void nextRound()} disabled={busy}>
                Next Round
              </Button>
            )}
            <Button
              size="lg"
              variant={matchOver ? 'primary' : 'secondary'}
              className={matchOver ? 'col-span-2' : undefined}
              onClick={() => void rematch()}
              disabled={busy}
            >
              Rematch
            </Button>
          </div>
        ) : (
          <p className="rounded-2xl bg-white/5 py-3 text-center font-semibold text-muted">
            Waiting for {host?.nickname ?? 'the host'} to start the next round…
          </p>
        )}
        {isHost && room.players.filter((p) => p.connected).length < 2 && (
          <p className="text-center text-sm text-muted">You need at least 2 players to keep going. Invite someone with the room code.</p>
        )}
        <button type="button" onClick={onLeave} className="rounded-2xl py-2 text-sm font-semibold text-muted hover:bg-white/5 hover:text-ink">
          Leave room
        </button>
      </div>
    </Modal>
  );
}
