import { useEffect, useRef } from 'react';

/** Keeps the screen awake while `active` is true. Silently does nothing where the API is unsupported. */
export function useWakeLock(active: boolean): void {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let cancelled = false;

    const acquire = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) {
          await lock.release();
          return;
        }
        lockRef.current = lock;
      } catch {
        // Not available right now (e.g. the tab isn't visible yet); the visibility
        // listener below will retry once it is.
      }
    };
    void acquire();

    // A wake lock is released automatically when the tab is hidden; grab it back on return.
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !lockRef.current) void acquire();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      const lock = lockRef.current;
      lockRef.current = null;
      void lock?.release();
    };
  }, [active]);
}
