import { useEffect, useMemo, useState } from 'react';
import { segmentAngle } from '../../game/wheel/logic';

const COLORS = ['#e6394a', '#f7c948'];
const CENTER = 200;
const RADIUS = 180;
const LABEL_RADIUS = 118;
const PEG_RADIUS = 176;

function point(angleDeg: number, r: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + r * Math.sin(rad), y: CENTER - r * Math.cos(rad) };
}

function wedgePath(startDeg: number, endDeg: number): string {
  const a = point(startDeg, RADIUS);
  const b = point(endDeg, RADIUS);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M${CENTER},${CENTER} L${a.x},${a.y} A${RADIUS},${RADIUS} 0 ${large} 1 ${b.x},${b.y} Z`;
}

function fitLabel(name: string, maxChars: number): string {
  if (name.length <= maxChars) return name;
  return `${name.slice(0, Math.max(1, maxChars - 1))}…`;
}

interface WheelSvgProps {
  names: string[];
  title: string;
  rotation: number;
  spinning: boolean;
  className?: string;
}

export function WheelSvg({ names, title, rotation, spinning, className }: WheelSvgProps) {
  const segments = Math.max(names.length, 1);
  const w = segmentAngle(segments);
  const fontSize = Math.max(7, Math.min(15, 190 / segments));
  const maxChars = Math.max(3, Math.round((w * 1.5) / (fontSize * 0.62)));
  const bulbCount = Math.max(12, Math.min(48, segments * 2));

  const [activeBulb, setActiveBulb] = useState(0);
  useEffect(() => {
    if (!spinning) return;
    let raf: number;
    const start = performance.now();
    const loop = (now: number) => {
      setActiveBulb(Math.floor((now - start) / 60) % bulbCount);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [spinning, bulbCount]);

  const [flick, setFlick] = useState(0);
  const lastPeg = useMemo(() => Math.floor(rotation / w), [rotation, w]);
  useEffect(() => {
    setFlick((f) => f + 1);
  }, [lastPeg]);

  return (
    <svg viewBox="0 0 400 440" className={className} role="img" aria-label={`Wheel: ${names.join(', ')}`}>
      {/* Bulbs chasing around the rim while spinning */}
      {Array.from({ length: bulbCount }, (_, i) => {
        const p = point((360 / bulbCount) * i, PEG_RADIUS + 12);
        const lit = spinning && (i === activeBulb || i === (activeBulb + bulbCount - 1) % bulbCount);
        return <circle key={i} cx={p.x} cy={p.y} r={3.4} fill={lit ? '#fff9e6' : '#4a3f6b'} opacity={lit ? 1 : 0.6} />;
      })}

      <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: '200px 200px' }}>
        {names.map((name, i) => {
          const startDeg = i * w;
          const endDeg = (i + 1) * w;
          const mid = startDeg + w / 2;
          const labelPoint = point(mid, LABEL_RADIUS);
          const flip = mid > 90 && mid < 270;
          return (
            <g key={i}>
              <path d={wedgePath(startDeg, endDeg)} fill={COLORS[i % COLORS.length]} stroke="#1c1537" strokeWidth={1.5} />
              <text
                x={labelPoint.x}
                y={labelPoint.y}
                fill="#1c1537"
                fontSize={fontSize}
                fontFamily="var(--font-sans)"
                fontWeight={700}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${mid + (flip ? 180 : 0)}, ${labelPoint.x}, ${labelPoint.y})`}
              >
                {fitLabel(name, maxChars)}
              </text>
            </g>
          );
        })}
        {/* Pegs at each segment boundary */}
        {Array.from({ length: segments }, (_, i) => {
          const p = point(i * w, PEG_RADIUS);
          return <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#fffaf2" stroke="#1c1537" strokeWidth={1} />;
        })}
        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="#f7c948" strokeWidth={5} />
      </g>

      {/* Pointer, fixed at the top, flicks each time it passes a peg */}
      <g key={flick} className="wheel-pointer">
        <path d="M200 28 L214 54 L186 54 Z" fill="#f7c948" stroke="#1c1537" strokeWidth={2} />
      </g>

      {/* Center hub cap */}
      <circle cx={CENTER} cy={CENTER} r={40} fill="#1c1537" stroke="#f7c948" strokeWidth={4} />
      <text
        x={CENTER}
        y={CENTER}
        fill="#fffaf2"
        fontSize={11}
        fontFamily="var(--font-display)"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {fitLabel(title || 'Spin!', 10)}
      </text>
    </svg>
  );
}
