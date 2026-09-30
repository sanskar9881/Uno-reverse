/** Original tile illustrations for the game hub. Each is a self-contained square SVG. */

export function UnoIllustration() {
  return (
    <svg viewBox="0 0 160 160" className="h-full w-full" aria-hidden>
      <g transform="translate(80 92)">
        {[
          { rotate: -22, x: -34, color: 'var(--color-card-red)' },
          { rotate: -7, x: -12, color: 'var(--color-card-yellow)' },
          { rotate: 8, x: 12, color: 'var(--color-card-green)' },
          { rotate: 23, x: 34, color: 'var(--color-card-blue)' },
        ].map((c, i) => (
          <g key={i} transform={`translate(${c.x} 0) rotate(${c.rotate})`}>
            <rect x={-22} y={-58} width={44} height={62} rx={9} fill={c.color} stroke="#00000022" />
            <rect x={-16} y={-52} width={32} height={50} rx={16} fill="var(--color-card-face)" opacity={0.9} />
          </g>
        ))}
      </g>
    </svg>
  );
}

export function BottleIllustration() {
  return (
    <svg viewBox="0 0 160 160" className="h-full w-full" aria-hidden>
      <ellipse cx="80" cy="132" rx="52" ry="10" fill="var(--color-wood-3)" opacity="0.5" />
      <rect x="60" y="120" width="40" height="14" rx="4" fill="var(--color-wood-2)" />
      <g transform="rotate(18 80 90)">
        <path
          d="M72 30 h16 v22 c14 6 18 20 18 34 v20 a14 14 0 0 1-14 14 H68 a14 14 0 0 1-14-14 v-20 c0-14 4-28 18-34 z"
          fill="var(--color-bottle-glass)"
          opacity="0.9"
        />
        <rect x="70" y="22" width="20" height="14" rx="3" fill="var(--color-bottle-glass-deep)" />
        <path d="M72 54 c12 4 16 16 16 28 v22 h-4 v-22 c0-11-3-21-14-25z" fill="#ffffff" opacity="0.25" />
      </g>
      <circle cx="80" cy="96" r="6" fill="var(--color-bottle-amber)" />
    </svg>
  );
}

export function WheelIllustration() {
  const colors = ['var(--color-wheel-red)', 'var(--color-wheel-gold)', 'var(--color-wheel-red)', 'var(--color-wheel-gold)', 'var(--color-wheel-red)', 'var(--color-wheel-gold)', 'var(--color-wheel-red)', 'var(--color-wheel-gold)'];
  return (
    <svg viewBox="0 0 160 160" className="h-full w-full" aria-hidden>
      <circle cx="80" cy="86" r="58" fill="var(--color-night-2)" stroke="var(--color-wheel-gold)" strokeWidth="4" />
      {colors.map((c, i) => {
        const a0 = (i / colors.length) * Math.PI * 2;
        const a1 = ((i + 1) / colors.length) * Math.PI * 2;
        const r = 54;
        const x0 = 80 + r * Math.cos(a0);
        const y0 = 86 + r * Math.sin(a0);
        const x1 = 80 + r * Math.cos(a1);
        const y1 = 86 + r * Math.sin(a1);
        return <path key={i} d={`M80 86 L${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1} Z`} fill={c} />;
      })}
      <circle cx="80" cy="86" r="14" fill="var(--color-night-2)" stroke="var(--color-wheel-gold)" strokeWidth="3" />
      <path d="M80 18 l10 16 h-20 z" fill="var(--color-wheel-gold)" />
    </svg>
  );
}

export function IntimacyIllustration() {
  return (
    <svg viewBox="0 0 160 160" className="h-full w-full" aria-hidden>
      {[-24, 24].map((x, i) => (
        <g key={i} transform={`translate(${80 + x} 110)`}>
          <rect x={-7} y={-46} width={14} height={46} rx={4} fill="var(--color-couples-candle)" opacity="0.85" />
          <path
            d={`M0 -46 c-7 -10 -11 -18 -3 -27 c1 8 5 12 8 16 c4 5 3 12 -5 11z`}
            fill="var(--color-couples-rose)"
          />
          <ellipse cx={0} cy={-52} rx={16} ry={20} fill="var(--color-couples-candle)" opacity="0.18" />
        </g>
      ))}
      <ellipse cx="80" cy="130" rx="56" ry="8" fill="var(--color-couples-wine)" opacity="0.5" />
    </svg>
  );
}

export function CouplesIllustration() {
  return (
    <svg viewBox="0 0 160 160" className="h-full w-full" aria-hidden>
      <g transform="translate(80 96) rotate(-8)">
        <rect x="-46" y="-52" width="46" height="66" rx="8" fill="var(--color-couples-wine)" stroke="var(--color-couples-candle)" strokeWidth="2" />
        <path d="M-23 -32 c-6 -8 -18 -4 -18 5 c0 8 10 14 18 20 c8 -6 18 -12 18 -20 c0 -9 -12 -13 -18 -5z" fill="var(--color-couples-rose)" />
      </g>
      <g transform="translate(80 96) rotate(8) translate(0 0)">
        <rect x="0" y="-52" width="46" height="66" rx="8" fill="var(--color-couples-wine)" stroke="var(--color-couples-candle)" strokeWidth="2" />
        <path d="M23 -14 c0 5 -4 8 -4 8 h8 s-4 -3 -4 -8z" fill="var(--color-couples-candle)" opacity="0.9" />
        <ellipse cx="23" cy="-2" rx="10" ry="14" fill="var(--color-couples-candle)" opacity="0.5" />
      </g>
    </svg>
  );
}
