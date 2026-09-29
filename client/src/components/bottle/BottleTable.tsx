import type { ReactNode } from 'react';
import { playSound } from '../../game/sounds';
import type { BottlePlayer } from '../../game/bottle/storage';
import { Surface } from '../ui/Surface';
import { cn } from '../../utils/cn';
import { BottleSvg } from './BottleSvg';
import { BottleResultSheet } from './ResultSheet';

interface BottleTableProps {
  players: BottlePlayer[];
  rotation: number;
  spinning: boolean;
  targetIndex: number | null;
  spinnerIndex: number;
  statusText: string;
  onSpin: (initialSpeed?: number) => void;
  /** Local physics support a flick gesture; the server-synced online spin is tap-only. */
  allowFlick?: boolean;
  resultOpen: boolean;
  resultTarget: BottlePlayer | null;
  nextSpinner: BottlePlayer | null;
  prompt: string | null;
  onCloseResult: () => void;
  onNextSpin: () => void;
  /** Extra buttons under the desktop players list, e.g. "Edit players" / "Take it online". */
  sidebarActions?: ReactNode;
}

/** The bottle, its status line, the players sidebar and the result sheet — shared by the one-phone and online tables so they look and feel identical. */
export function BottleTable({
  players,
  rotation,
  spinning,
  targetIndex,
  spinnerIndex,
  statusText,
  onSpin,
  allowFlick = false,
  resultOpen,
  resultTarget,
  nextSpinner,
  prompt,
  onCloseResult,
  onNextSpin,
  sidebarActions,
}: BottleTableProps) {
  return (
    <>
      <div className="mt-2 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex flex-col items-center">
          <div
            className="mx-auto w-full max-w-sm cursor-pointer touch-none select-none"
            onClick={() => {
              if (!spinning) playSound('click');
              onSpin();
            }}
            onPointerDown={
              allowFlick
                ? (e) => {
                    const startY = e.clientY;
                    const startT = performance.now();
                    const onUp = (ev: PointerEvent) => {
                      const dt = Math.max(1, performance.now() - startT);
                      const dy = startY - ev.clientY;
                      window.removeEventListener('pointerup', onUp);
                      if (Math.abs(dy) > 30) onSpin((dy / dt) * 100);
                    };
                    window.addEventListener('pointerup', onUp);
                  }
                : undefined
            }
          >
            <BottleSvg players={players} rotation={rotation} spinning={spinning} targetIndex={targetIndex} spinnerIndex={spinnerIndex} />
          </div>

          <p className="mt-2 text-center font-semibold text-muted">{statusText}</p>
        </div>

        <Surface className="hidden p-5 lg:block">
          <h2 className="font-display text-lg">Players</h2>
          <ul className="mt-3 flex flex-col gap-1.5">
            {players.map((p, i) => (
              <li key={i} className={cn('flex items-center gap-2 rounded-xl px-2 py-1.5', i === spinnerIndex && 'bg-veil/10')}>
                <span className="text-lg">{p.emoji}</span>
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">{p.name}</span>
              </li>
            ))}
          </ul>
          {sidebarActions && <div className="mt-4 flex flex-col gap-2">{sidebarActions}</div>}
        </Surface>
      </div>

      <BottleResultSheet
        open={resultOpen}
        target={resultTarget}
        nextSpinner={nextSpinner}
        prompt={prompt}
        onClose={onCloseResult}
        onNextSpin={onNextSpin}
      />
    </>
  );
}
