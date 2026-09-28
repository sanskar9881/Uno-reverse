import { useCallback, useRef, useState } from 'react';
import { playSound } from '../sounds';
import { easeOutWobble, pickTarget, randomBottleSpinDuration, rotationToTarget } from './logic';

const FULL_SPINS = 5;
const REDUCED_MOTION = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface SpinOptions {
  playerCount: number;
  spinnerIndex: number;
  canLandOnSelf: boolean;
  sound: boolean;
  onLand: (index: number) => void;
}

export function useBottleSpin() {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const rotationRef = useRef(0);
  const frame = useRef<number | null>(null);

  const spin = useCallback((opts: SpinOptions, initialSpeed?: number) => {
    if (opts.playerCount < 2) return;
    const target = pickTarget(opts.playerCount, opts.spinnerIndex, opts.canLandOnSelf);
    const start = rotationRef.current;
    const extraFromFlick = initialSpeed ? Math.min(3, Math.abs(initialSpeed) / 80) : 0;
    const end = start + rotationToTarget(target, opts.playerCount, FULL_SPINS + extraFromFlick) - (start % 360);
    const duration = REDUCED_MOTION() ? 400 : randomBottleSpinDuration();
    const startTime = performance.now();

    setSpinning(true);
    if (frame.current !== null) cancelAnimationFrame(frame.current);

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = easeOutWobble(t);
      const current = start + (end - start) * eased;
      rotationRef.current = current;
      setRotation(current);
      if (t < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        setSpinning(false);
        if (opts.sound) playSound('wheelWin');
        opts.onLand(target);
      }
    };
    frame.current = requestAnimationFrame(tick);
  }, []);

  return { rotation, spinning, spin };
}
