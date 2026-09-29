import { motion } from 'motion/react';
import { useFxStore } from '../../store/fxStore';
import { CardBack } from '../cards/Card';

const W = 44;
const H = (W * 7) / 5;

/** Face-down cards flying from the draw pile to opponents. Purely decorative. */
export function FlyingCards() {
  const flights = useFxStore((s) => s.flights);
  const land = useFxStore((s) => s.land);
  return (
    <div className="pointer-events-none fixed inset-0 z-flying-card" aria-hidden>
      {flights.map((f) =>
        Array.from({ length: f.count }, (_, i) => (
          <motion.div
            key={`${f.id}-${i}`}
            className="absolute left-0 top-0"
            style={{ width: W, height: H }}
            initial={{ x: f.from.x - W / 2, y: f.from.y - H / 2, rotate: 0, opacity: 1, scale: 1 }}
            animate={{ x: f.to.x - W / 2, y: f.to.y - H / 2, rotate: 18 - i * 6, opacity: [1, 1, 0], scale: 0.75 }}
            transition={{ duration: 0.5, delay: i * 0.08, ease: [0.3, 0.7, 0.4, 1] }}
            onAnimationComplete={() => i === f.count - 1 && land(f.id)}
          >
            <CardBack className="w-full" />
          </motion.div>
        )),
      )}
    </div>
  );
}
