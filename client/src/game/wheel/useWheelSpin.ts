import { useCallback, useRef, useState } from 'react';
import { playSound } from '../sounds';
import { easeOutDecel, pickWinner, randomSpinDuration, segmentAngle, targetRotation, type SpinLength } from './logic';

const FULL_SPINS = 6;
const REDUCED_MOTION = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface SpinOptions {
  names: string[];
  spinLength: SpinLength;
  sound: boolean;
  onLand: (index: number) => void;
}

export function useWheelSpin() {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const frame = useRef<number | null>(null);
  const rotationRef = useRef(0);

  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);

  const spin = useCallback(
    (opts: SpinOptions, forceIndex?: number, initialSpeed?: number) => {
      if (opts.names.length < 2) return;
      const segments = opts.names.length;
      const w = segmentAngle(segments);
      const index = forceIndex ?? pickWinner(segments);
      const start = rotationRef.current;
      // A flick adds a touch more distance so a hard flick visibly spins harder.
      const extraFromFlick = initialSpeed ? Math.min(4, Math.abs(initialSpeed) / 60) : 0;
      // targetRotation assumes the wheel starts at 0; drop `start`'s own leftover angle
      // first so the pointer lands exactly on `index` instead of drifting after each spin.
      const end = start - (start % 360) + targetRotation(index, segments, FULL_SPINS + extraFromFlick);
      const duration = REDUCED_MOTION() ? 400 : randomSpinDuration(opts.spinLength);
      const startTime = performance.now();
      let lastPeg = Math.floor(start / w);

      setSpinning(true);
      stop();

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        const eased = easeOutDecel(t);
        const current = start + (end - start) * eased;
        rotationRef.current = current;
        setRotation(current);

        const peg = Math.floor(current / w);
        if (peg !== lastPeg && opts.sound) {
          const speed = 1 - t; // ticks are louder/higher-pitched early, softer as it settles
          playSound('wheelTick', speed);
          if (navigator.vibrate) navigator.vibrate(6);
          lastPeg = peg;
        }

        if (t < 1) {
          frame.current = requestAnimationFrame(tick);
        } else {
          setSpinning(false);
          if (opts.sound) playSound('wheelWin');
          opts.onLand(index);
        }
      };
      frame.current = requestAnimationFrame(tick);
    },
    [stop],
  );

  return { rotation, spinning, spin };
}
