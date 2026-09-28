import { motion } from 'motion/react';
import { cn } from '../../utils/cn';

const LETTERS = [
  { char: 'U', color: 'bg-card-red', rotate: -14, x: 18 },
  { char: 'N', color: 'bg-card-yellow', rotate: -1, x: 0 },
  { char: 'O', color: 'bg-card-blue', rotate: 13, x: -18 },
];

/** The wordmark: three fanned cards spelling UNO, dealt in once on page load. */
export function Logo({ size = 'lg', animate = true }: { size?: 'sm' | 'lg'; animate?: boolean }) {
  const big = size === 'lg';
  const card = big ? 'w-[88px] sm:w-[112px] text-[64px] sm:text-[82px] rounded-[18px]' : 'w-[26px] text-[18px] rounded-[6px]';
  return (
    <div className={cn('flex flex-col items-center', big ? 'gap-1' : 'flex-row gap-2')}>
      <div className={cn('flex items-end', big ? '-space-x-3 sm:-space-x-4' : '-space-x-1.5')}>
        {LETTERS.map((l, i) => (
          <motion.span
            key={l.char}
            className={cn(
              'relative grid aspect-[5/7] place-items-center font-display leading-none text-white',
              'shadow-[inset_0_1px_0_rgb(255_255_255/0.4),0_10px_24px_rgb(8_4_24/0.5)]',
              card,
              l.color,
            )}
            style={{ textShadow: '0 3px 0 rgb(0 0 0 / 0.22)' }}
            initial={animate ? { y: 160, rotate: 0, opacity: 0 } : false}
            animate={{ y: i === 1 ? -6 : 0, rotate: l.rotate, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18, delay: animate ? 0.1 + i * 0.12 : 0 }}
          >
            <span
              className={cn(
                'absolute rounded-[inherit] border-white/55',
                big ? 'inset-[6px] border-2' : 'inset-[2px] border',
              )}
            />
            {l.char}
          </motion.span>
        ))}
      </div>
      <motion.span
        className={cn('font-display text-ink', big ? 'mt-2 text-[40px] tracking-[0.18em] sm:text-[52px]' : 'text-lg tracking-wide')}
        style={{ textShadow: '0 4px 0 rgb(0 0 0 / 0.3)' }}
        initial={animate ? { opacity: 0, y: 12 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: animate ? 0.5 : 0, duration: 0.35 }}
      >
        PARTY
      </motion.span>
    </div>
  );
}
