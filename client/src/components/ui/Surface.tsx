import type { HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

/** A panel with an inner highlight and a soft shadow, used across the hub and games. */
export function Surface({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[28px] bg-night-2/80 shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_20px_50px_rgb(8_4_24/0.45)] ring-1 ring-line backdrop-blur',
        className,
      )}
      {...rest}
    />
  );
}
