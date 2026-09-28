import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Chip } from '../ui/Chip';

interface GameTileProps {
  to: string;
  title: string;
  description: string;
  badge: string;
  accent: string;
  illustration: ReactNode;
  index: number;
}

/** A hub tile: deals in on load, lifts with a tilt on hover or press. */
export function GameTile({ to, title, description, badge, accent, illustration, index }: GameTileProps) {
  return (
    <motion.div
      initial={{ y: 60, opacity: 0, rotate: index % 2 === 0 ? -6 : 6 }}
      animate={{ y: 0, opacity: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.15 + index * 0.1 }}
      whileHover={{ y: -8, rotate: index % 2 === 0 ? -1.5 : 1.5, scale: 1.02 }}
      whileTap={{ y: -3, scale: 0.99 }}
    >
      <Link
        to={to}
        className="group block rounded-[28px] bg-night-2/80 p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_16px_36px_rgb(8_4_24/0.4)] ring-1 ring-line transition-shadow duration-200 hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),0_28px_60px_rgb(8_4_24/0.55)] focus-visible:outline-none focus-visible:ring-2"
        style={{ '--tw-ring-color': accent } as React.CSSProperties}
      >
        <div
          className="grid aspect-square place-items-center overflow-hidden rounded-3xl p-4"
          style={{ background: `radial-gradient(circle at 50% 30%, ${accent}33, transparent 70%)` }}
        >
          {illustration}
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          <h2 className="font-display text-xl">{title}</h2>
          <p className="text-sm text-muted">{description}</p>
          <Chip className="mt-1 w-fit" style={{ background: `${accent}26`, boxShadow: `inset 0 0 0 1px ${accent}55` }}>
            {badge}
          </Chip>
        </div>
      </Link>
    </motion.div>
  );
}
