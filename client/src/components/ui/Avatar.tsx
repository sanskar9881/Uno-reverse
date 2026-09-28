import { AVATARS } from '@shared';
import { cn } from '../../utils/cn';

const RINGS = ['#F2474D', '#FFC53D', '#22C58B', '#3D8BFF'];

export function Avatar({ index, size = 44, className, dim }: { index: number; size?: number; className?: string; dim?: boolean }) {
  const ring = RINGS[index % RINGS.length];
  return (
    <span
      className={cn('relative inline-grid shrink-0 place-items-center rounded-full bg-night-2', dim && 'opacity-45 grayscale', className)}
      style={{ width: size, height: size, fontSize: size * 0.55, boxShadow: `inset 0 0 0 2px ${ring}55` }}
      aria-hidden
    >
      {AVATARS[index] ?? AVATARS[0]}
    </span>
  );
}
