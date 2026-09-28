import { useCountdown } from '../../hooks/useCountdown';

/** Circular countdown drawn around an avatar. */
export function TurnRing({ endsAt, durationMs, size }: { endsAt: number; durationMs: number; size: number }) {
  const left = useCountdown(endsAt);
  const stroke = 4;
  const r = size / 2 - stroke / 2;
  const circumference = 2 * Math.PI * r;
  const fraction = durationMs > 0 ? Math.min(1, left / durationMs) : 0;
  const color = fraction > 0.5 ? '#22C58B' : fraction > 0.2 ? '#FFC53D' : '#F2474D';
  return (
    <svg width={size} height={size} className="pointer-events-none absolute inset-0 -rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - fraction)}
        style={{ transition: 'stroke-dashoffset 100ms linear, stroke 300ms' }}
      />
    </svg>
  );
}
