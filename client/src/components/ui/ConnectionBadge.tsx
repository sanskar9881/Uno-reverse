import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { cn } from '../../utils/cn';

/** Only visible when something is wrong (or slow): free hosting sleeps and takes a while to wake. */
export function ConnectionBadge({ className }: { className?: string }) {
  const connection = useGameStore((s) => s.connection);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (connection === 'connected') {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), 2500);
    return () => clearTimeout(t);
  }, [connection]);

  if (connection === 'connected') return null;
  const text =
    connection === 'reconnecting'
      ? 'Connection lost. Reconnecting…'
      : connection === 'offline'
        ? "Can't reach the game server. Still trying…"
        : slow
          ? 'Waking up the game server. On free hosting this can take a few minutes.'
          : 'Connecting to the game server…';

  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-2 rounded-full bg-night-2/90 px-4 py-2 text-sm font-semibold text-muted ring-1 ring-line',
        className,
      )}
    >
      <span className={cn('h-2 w-2 shrink-0 rounded-full', connection === 'offline' ? 'bg-card-red' : 'animate-pulse bg-card-yellow')} />
      {text}
    </div>
  );
}
