import { useEffect, useState } from 'react';
import { serverNow } from '../store/gameStore';

/** Milliseconds left until a server deadline (0 when there's no deadline). */
export function useCountdown(endsAt: number, intervalMs = 100): number {
  const [left, setLeft] = useState(() => (endsAt ? Math.max(0, endsAt - serverNow()) : 0));
  useEffect(() => {
    if (!endsAt) {
      setLeft(0);
      return;
    }
    const tick = () => setLeft(Math.max(0, endsAt - serverNow()));
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [endsAt, intervalMs]);
  return left;
}
