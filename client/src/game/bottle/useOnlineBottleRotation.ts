import type { BottleSpinView } from '@shared';
import { useEffect, useRef, useState } from 'react';
import { easeOutWobble, rotationToTarget } from './logic';

const FULL_SPINS = 5;

/**
 * Renders an online spin using only `startedAt` + `durationMs` and the local clock offset,
 * so every client animates the exact same motion and lands at the exact same moment — the
 * same trick the UNO turn timer uses for `turnEndsAt`.
 */
export function useOnlineBottleRotation(spin: BottleSpinView | null, now: () => number): { rotation: number; spinning: boolean } {
  const [, forceRender] = useState(0);
  const restRotation = useRef(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!spin) return;
    const targetIndex = Math.max(0, spin.seatOrder.indexOf(spin.targetId));
    const finalRotation = rotationToTarget(targetIndex, spin.seatOrder.length, FULL_SPINS);

    const loop = () => {
      const elapsed = now() - spin.startedAt;
      const t = Math.min(1, Math.max(0, elapsed / spin.durationMs));
      restRotation.current = finalRotation * easeOutWobble(t);
      forceRender((n) => n + 1);
      if (t < 1) frame.current = requestAnimationFrame(loop);
    };
    frame.current = requestAnimationFrame(loop);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spin?.id]);

  return { rotation: restRotation.current, spinning: Boolean(spin) };
}
