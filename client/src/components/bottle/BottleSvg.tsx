import { playerAngle } from '../../game/bottle/logic';
import type { BottlePlayer } from '../../game/bottle/storage';

const CENTER = 200;
const CIRCLE_RADIUS = 155;

function point(angleDeg: number, r: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + r * Math.sin(rad), y: CENTER - r * Math.cos(rad) };
}

interface BottleSvgProps {
  players: BottlePlayer[];
  rotation: number;
  spinning: boolean;
  targetIndex: number | null;
  spinnerIndex: number;
  className?: string;
}

export function BottleSvg({ players, rotation, spinning, targetIndex, spinnerIndex, className }: BottleSvgProps) {
  const count = Math.max(players.length, 1);

  return (
    <svg viewBox="0 0 400 400" className={className} role="img" aria-label="Spin the bottle table">
      <defs>
        <radialGradient id="rug" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="var(--color-rug-1)" />
          <stop offset="100%" stopColor="var(--color-rug-2)" />
        </radialGradient>
      </defs>
      <circle cx={CENTER} cy={CENTER} r={190} fill="url(#rug)" />
      <circle cx={CENTER} cy={CENTER} r={190} fill="none" stroke="var(--color-wood-3)" strokeWidth={6} opacity={0.6} />

      {players.map((p, i) => {
        const angle = playerAngle(i, count);
        const pos = point(angle, CIRCLE_RADIUS);
        const isTarget = !spinning && targetIndex === i;
        const isSpinner = i === spinnerIndex;
        return (
          <g key={i}>
            {isTarget && <circle cx={pos.x} cy={pos.y} r={30} fill="none" stroke="var(--color-bottle-amber)" strokeWidth={4} className="animate-pulse-soft" />}
            <circle cx={pos.x} cy={pos.y} r={26} fill="var(--color-night-2)" stroke={isSpinner ? 'var(--color-bottle-glass)' : 'color-mix(in oklab, var(--color-ink) 20%, transparent)'} strokeWidth={isSpinner ? 3 : 1.5} />
            <text x={pos.x} y={pos.y - 2} textAnchor="middle" dominantBaseline="middle" fontSize={20}>
              {p.emoji}
            </text>
            <text
              x={pos.x}
              y={pos.y + 38}
              textAnchor="middle"
              fontSize={12}
              fontFamily="var(--font-sans)"
              fontWeight={700}
              fill="var(--color-ink)"
            >
              {p.name.length > 10 ? `${p.name.slice(0, 9)}…` : p.name}
            </text>
          </g>
        );
      })}

      {/* The bottle, rotating from the center */}
      <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: '200px 200px' }}>
        <ellipse cx={CENTER} cy={CENTER + 4} rx={44} ry={10} fill="#000" opacity={0.35} />
        <g transform={`translate(${CENTER} ${CENTER})`}>
          <path
            d="M-9 20 H9 V-46 c10 4 14 16 14 30 v10 a12 12 0 0 1-12 12 h-12 a12 12 0 0 1-12-12 v-10 c0-14 4-26 14-30 z"
            fill="var(--color-bottle-glass)"
          />
          <rect x={-7} y={-58} width={14} height={14} rx={2} fill="var(--color-bottle-glass-deep)" />
          <path d="M-9 -30 c8 3 11 12 11 22 v18 h-3 v-18 c0-8-2-16-10-19z" fill="#ffffff" opacity={0.3} />
        </g>
      </g>
    </svg>
  );
}
