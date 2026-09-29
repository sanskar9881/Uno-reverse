import type { HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

/** A small rounded badge, e.g. a player count or "18+" label on a hub tile. */
export function Chip({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-veil/10 px-2.5 py-1 text-xs font-bold text-ink ring-1 ring-veil/15',
        className,
      )}
      {...rest}
    />
  );
}
