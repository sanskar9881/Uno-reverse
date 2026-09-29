import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import type { ClientState } from '@shared';
import { toast } from '../../store/toastStore';
import { copyText } from '../../utils/clipboard';
import { Logo } from '../ui/Logo';
import { SoundToggle } from '../ui/SoundToggle';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Scoreboard } from './Scoreboard';

export function TopBar({ state, onLeave }: { state: ClientState; onLeave: () => void }) {
  const [scoresOpen, setScoresOpen] = useState(false);
  const { room } = state;

  return (
    <header className="relative z-header flex items-center justify-between gap-2 px-3 pt-2 sm:px-5">
      <div className="flex min-w-0 items-center gap-2">
        <div className="hidden sm:block">
          <Logo size="sm" animate={false} />
        </div>
        <button
          type="button"
          onClick={async () => toast((await copyText(room.code)) ? 'Room code copied' : `Room code: ${room.code}`, 'good', '📋')}
          className="rounded-xl bg-veil/5 px-2 py-1.5 font-display text-sm tracking-[0.15em] ring-1 ring-line hover:bg-veil/10"
          title="Copy room code"
          aria-label={`Room code ${room.code}. Copy`}
        >
          {room.code}
        </button>
        <span className="hidden text-sm font-semibold text-muted lg:inline">Round {room.roundNumber}</span>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-0.5">
        <div className="relative">
          <button
            type="button"
            onClick={() => setScoresOpen(!scoresOpen)}
            aria-expanded={scoresOpen}
            className="h-10 rounded-xl px-2 text-sm font-bold text-muted hover:bg-veil/10 hover:text-ink"
          >
            Scores
          </button>
          <AnimatePresence>
            {scoresOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="absolute right-0 top-12 w-72 rounded-2xl bg-night-2 p-4 shadow-[0_20px_50px_rgb(0_0_0/0.5)] ring-1 ring-line"
              >
                <Scoreboard state={state} />
                <p className="mt-3 text-xs text-muted">
                  {room.settings.targetScore
                    ? `First to ${room.settings.targetScore} points wins the match.`
                    : 'No score limit. Points add up every round.'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <SoundToggle />
          <ThemeToggle />
        <button
          type="button"
          onClick={onLeave}
          className="h-10 rounded-xl px-2 text-sm font-bold text-muted hover:bg-card-red/15 hover:text-card-red"
        >
          Leave
        </button>
      </div>
    </header>
  );
}
