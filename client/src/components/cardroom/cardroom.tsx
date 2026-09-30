/**
 * Party Night "card room" building blocks.
 *
 * Purely presentational: no state, no stores, no sockets. Feed them data from
 * the existing game code. Styling lives in client/src/styles/cardroom/*.css.
 */
import { useId, type CSSProperties, type ReactNode } from 'react';

type Classy = string | false | null | undefined;
const cx = (...parts: Classy[]): string => parts.filter(Boolean).join(' ');

/** CSS custom properties are allowed in style objects through this helper. */
const vars = (values: Record<string, string | number>): CSSProperties => values as CSSProperties;

export type PnCardColor = 'red' | 'yellow' | 'green' | 'blue' | 'wild';
export type PnFelt = 'green' | 'teal' | 'burgundy' | 'navy';

/* ------------------------------------------------------------------ icons */

function SkipIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M6.4 17.6 17.6 6.4" />
    </svg>
  );
}

function ReverseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4.5 8.5h13" />
      <path d="M13.5 4.5l4 4-4 4" />
      <path d="M19.5 15.5h-13" />
      <path d="M10.5 11.5l-4 4 4 4" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ brand */

/** The four-square diamond mark used next to "Party Night". */
export function PnMark() {
  return (
    <span className="pn-mark" aria-hidden>
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

/* ------------------------------------------------------------------ cards */

export interface PnCardFaceProps {
  color: PnCardColor;
  /** '0'-'9', 'skip', 'reverse', 'draw2', 'wild', 'wild4' */
  value: string;
  /** Width in px. Leave out to size with CSS (a width utility or --pn-card-w). */
  width?: number;
  playable?: boolean;
  selected?: boolean;
  dim?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function PnCardFace({ color, value, width, playable, selected, dim, className, style }: PnCardFaceProps) {
  const isNumber = /^[0-9]$/.test(value);
  const text = value === 'draw2' ? '+2' : value === 'wild4' ? '+4' : isNumber ? value : '';
  const plainWild = value === 'wild';
  const underline = value === '6' || value === '9';
  const symbol =
    value === 'skip' ? <SkipIcon /> : value === 'reverse' ? <ReverseIcon /> : <span className={underline ? 'pn-card__underline' : undefined}>{text}</span>;
  const corner = plainWild ? <span className="pn-card__mini-wild" /> : symbol;
  return (
    <div
      className={cx('pn-card', playable && 'is-playable', selected && 'is-selected', dim && 'is-dim', className)}
      data-color={color}
      style={{ ...(width ? vars({ '--pn-card-w': `${width}px` }) : {}), ...style }}
      aria-hidden
    >
      <span className="pn-card__frame" />
      <span className="pn-card__diamond" />
      <span className={cx('pn-card__symbol', text.length > 1 && 'pn-card__symbol--small')}>{plainWild ? null : symbol}</span>
      <span className="pn-card__corner pn-card__corner--tl">{corner}</span>
      <span className="pn-card__corner pn-card__corner--br">{corner}</span>
      <span className="pn-card__sheen" />
    </div>
  );
}

export function PnCardBack({ width, className, style }: { width?: number; className?: string; style?: CSSProperties }) {
  return (
    <div
      className={cx('pn-card pn-card--back', className)}
      style={{ ...(width ? vars({ '--pn-card-w': `${width}px` }) : {}), ...style }}
      aria-hidden
    >
      <span className="pn-card__frame" />
      <span className="pn-card__ring" />
      <span className="pn-card__emblem">
        <span />
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ table */

export interface PnTableProps {
  felt?: PnFelt;
  size?: 'desktop' | 'tablet' | 'compact' | 'mini';
  className?: string;
  style?: CSSProperties;
  /** Rendered inside the felt. Use .pn-felt__center for the piles. */
  children?: ReactNode;
}

export function PnTable({ felt = 'green', size = 'desktop', className, style, children }: PnTableProps) {
  return (
    <div
      className={cx('pn-table', size === 'tablet' && 'pn-table--tablet', size === 'compact' && 'pn-table--compact', size === 'mini' && 'pn-table--mini', className)}
      data-felt={felt}
      style={style}
    >
      <div className="pn-felt">{children}</div>
    </div>
  );
}

/** Two faint arcs printed on the felt showing the direction of play. */
export function PnDirection({ reversed }: { reversed?: boolean }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className={cx('pn-direction', reversed && 'is-reversed')} viewBox="0 0 560 280" aria-hidden>
      <defs>
        <marker id={`pn-arrow-${id}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 10 5 0 10z" fill="currentColor" />
        </marker>
      </defs>
      <path d="M60 112 A 230 110 0 0 1 500 112" fill="none" stroke="currentColor" strokeWidth="2.5" markerEnd={`url(#pn-arrow-${id})`} />
      <path d="M500 168 A 230 110 0 0 1 60 168" fill="none" stroke="currentColor" strokeWidth="2.5" markerEnd={`url(#pn-arrow-${id})`} />
    </svg>
  );
}

/* ------------------------------------------------------------------ people */

export interface PnAvatarProps {
  name: string;
  /** The saved avatar number, 0-11. */
  tone: number;
  size?: number;
  offline?: boolean;
  className?: string;
}

export function PnAvatar({ name, tone, size = 40, offline, className }: PnAvatarProps) {
  const initial = Array.from(name.trim())[0] ?? '?';
  return (
    <span
      className={cx('pn-avatar', offline && 'is-offline', className)}
      data-tone={((tone % 12) + 12) % 12}
      style={vars({ '--pn-avatar-size': `${size}px` })}
      aria-hidden
    >
      {initial}
    </span>
  );
}

/** A timer ring around an avatar. progress: 1 = full time left, 0 = out of time. */
export function PnAvatarRing({ progress, children }: { progress: number; children: ReactNode }) {
  const p = Math.max(0, Math.min(1, progress));
  return (
    <span className={cx('pn-avatar-ring', p < 0.2 && 'is-low')} style={vars({ '--pn-progress': p })}>
      {children}
    </span>
  );
}

export interface PnSeatProps {
  name: string;
  tone: number;
  meta: string;
  current?: boolean;
  offline?: boolean;
  uno?: boolean;
  compact?: boolean;
  /** Time left for the current player, 0-1 (only used when current). */
  progress?: number;
  children?: ReactNode;
}

export function PnSeat({ name, tone, meta, current, offline, uno, compact, progress = 1, children }: PnSeatProps) {
  const avatar = <PnAvatar name={name} tone={tone} size={compact ? 34 : 40} offline={offline} />;
  return (
    <div className={cx('pn-seat', compact && 'pn-seat--compact', current && 'is-current', offline && 'is-offline')}>
      {current ? <PnAvatarRing progress={progress}>{avatar}</PnAvatarRing> : avatar}
      <span className="pn-seat__text">
        <span className="pn-seat__name" title={name}>
          {name}
        </span>
        <span className="pn-seat__meta">{meta}</span>
      </span>
      {uno && <span className="pn-badge-uno">UNO!</span>}
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ small parts */

export function PnTimerBar({ progress }: { progress: number }) {
  const p = Math.max(0, Math.min(1, progress));
  return <div className={cx('pn-timer-bar', p < 0.2 && 'is-low')} style={vars({ '--pn-progress': p })} aria-hidden />;
}

export function PnColorChip({ color, onFelt = true }: { color: Exclude<PnCardColor, 'wild'>; onFelt?: boolean }) {
  return (
    <span className={cx('pn-chip', onFelt && 'pn-chip--on-felt')}>
      <span className="pn-chip__dot" data-color={color} />
      {color.charAt(0).toUpperCase() + color.slice(1)}
    </span>
  );
}

export function PnCodeTiles({ code }: { code: string }) {
  return (
    <div className="pn-code-tiles" aria-label={`Room code ${code.split('').join(' ')}`}>
      {code.split('').map((char, i) => (
        <span key={`${char}-${i}`} className="pn-code-tile" aria-hidden>
          {char}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Spin It */

/** Glass bottle with a brass cap, pointing up. Rotate the element to spin it. */
export function PnBottle({ className, style }: { className?: string; style?: CSSProperties }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className={cx('pn-bottle', className)} style={style} viewBox="0 0 64 200" aria-hidden>
      <defs>
        <linearGradient id={`pn-glass-${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#145a52" />
          <stop offset="0.38" stopColor="#3fb8a9" />
          <stop offset="0.7" stopColor="#2a8c80" />
          <stop offset="1" stopColor="#0f4a43" />
        </linearGradient>
        <linearGradient id={`pn-cap-${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#a9772a" />
          <stop offset="0.5" stopColor="#f0c572" />
          <stop offset="1" stopColor="#a9772a" />
        </linearGradient>
      </defs>
      <path
        d="M26 14 H38 V58 C38 70 56 76 56 98 V184 C56 192 50 196 42 196 H22 C14 196 8 192 8 184 V98 C8 76 26 70 26 58 Z"
        fill={`url(#pn-glass-${id})`}
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1"
      />
      <rect x="8" y="120" width="48" height="30" fill="rgba(227,179,90,0.55)" />
      <rect x="14" y="100" width="6" height="78" rx="3" fill="#ffffff" opacity="0.35" />
      <rect x="29" y="18" width="3" height="36" rx="1.5" fill="#ffffff" opacity="0.3" />
      <rect x="24" y="0" width="16" height="16" rx="3" fill={`url(#pn-cap-${id})`} />
    </svg>
  );
}

/* ------------------------------------------------------------------ Couples and Group */

export interface PnTarotProps {
  kind?: string;
  text?: string;
  footer?: ReactNode;
  back?: boolean;
  width?: number;
  className?: string;
}

export function PnTarot({ kind, text, footer, back, width, className }: PnTarotProps) {
  const style = width ? vars({ '--pn-tarot-w': `${width}px` }) : undefined;
  if (back) {
    return (
      <div className={cx('pn-tarot pn-tarot--back', className)} style={style} aria-hidden>
        <span className="pn-tarot__seal">
          <HeartIcon />
        </span>
      </div>
    );
  }
  return (
    <div className={cx('pn-tarot', className)} style={style}>
      {kind && <span className="pn-tarot__kind">{kind}</span>}
      {text && <p className="pn-tarot__text">{text}</p>}
      {footer && <div className="pn-tarot__footer">{footer}</div>}
    </div>
  );
}

export interface PnDareCardProps {
  type: 'normal' | 'spicy' | 'revealing';
  kind: 'Truth' | 'Dare';
  text: string;
  foot?: string;
  width?: number;
  className?: string;
}

const TYPE_LABEL: Record<PnDareCardProps['type'], string> = { normal: 'Normal', spicy: 'Spicy', revealing: 'Revealing' };

export function PnDareCard({ type, kind, text, foot, width, className }: PnDareCardProps) {
  return (
    <div className={cx('pn-dare-card', className)} data-type={type} style={width ? vars({ '--pn-dare-w': `${width}px` }) : undefined}>
      <div className="pn-dare-card__band">
        <span>{kind}</span>
        <span>{TYPE_LABEL[type]}</span>
      </div>
      <p className="pn-dare-card__text">{text}</p>
      {foot && <p className="pn-dare-card__foot">{foot}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ hub tile art */

export function PnGameArt({ game }: { game: 'uno' | 'spin' | 'couples' | 'group' }) {
  if (game === 'uno') {
    return (
      <div className="pn-art pn-art--uno" aria-hidden>
        <div className="pn-felt" data-felt="green" style={vars({ '--pn-table-r': '26px', '--pn-rim': '8px', '--pn-stitch-inset': '8px' })}>
          <div className="pn-felt__center">
            <div className="pn-art__fan">
              <PnCardFace color="red" value="7" width={58} style={{ translate: '-110% 0', rotate: '-14deg' }} />
              <PnCardFace color="blue" value="reverse" width={58} style={{ translate: '-50% -8px' }} />
              <PnCardFace color="wild" value="wild4" width={58} style={{ translate: '10% 0', rotate: '14deg' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (game === 'spin') {
    return (
      <div className="pn-art pn-art--spin" aria-hidden>
        <div style={{ position: 'relative', width: 132, height: 132 }}>
          <div className="pn-wheel__rim" style={{ padding: 7 }}>
            <div
              className="pn-wheel__face"
              style={{
                background:
                  'conic-gradient(var(--pn-red) 0 25%, var(--pn-yellow) 0 50%, var(--pn-green) 0 75%, var(--pn-blue) 0 100%)',
              }}
            />
          </div>
          <PnBottle style={{ position: 'absolute', left: '50%', top: '50%', width: 28, height: 88, translate: '-50% -50%', rotate: '35deg' }} />
        </div>
      </div>
    );
  }
  if (game === 'couples') {
    return (
      <div className="pn-art pn-art--couples" aria-hidden>
        <div style={{ position: 'relative', width: 160, height: 130 }}>
          <PnTarot back width={78} className="" />
          <div style={{ position: 'absolute', left: 64, top: 8, rotate: '10deg' }}>
            <PnTarot kind="Truth" width={78} />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="pn-art pn-art--group" aria-hidden>
      <div style={{ display: 'grid', justifyItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['harsh', 'Amit', 'Zoya', 'Kabir'].map((n, i) => (
            <PnAvatar key={n} name={n} tone={i * 2} size={30} />
          ))}
        </div>
        <PnDareCard type="spicy" kind="Dare" text="Dance the hook step" width={96} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ layout helpers */

export interface PnBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Seat centers (px) on the table edge for `count` opponents, in turn order
 * clockwise from your left: up the left side, across the top, down the right.
 * Pass the table's box inside the stage; put each seat in a .pn-seat-slot at
 * --x/--y. 1-4 sit along the top; 5 = 1+3+1; 6 = 1+4+1; 7 = 2+3+2.
 */
export function pnSeatSlots(count: number, table: PnBox): Array<{ x: number; y: number }> {
  if (count <= 0) return [];
  const layout: Record<number, [number, number, number]> = {
    1: [0, 1, 0],
    2: [0, 2, 0],
    3: [0, 3, 0],
    4: [0, 4, 0],
    5: [1, 3, 1],
    6: [1, 4, 1],
    7: [2, 3, 2],
  };
  const [l, t, r] = layout[Math.min(7, count)];
  const spread = (k: number, start: number, length: number) =>
    Array.from({ length: k }, (_, i) => start + (length * (i + 1)) / (k + 1));
  const leftYs = spread(l, table.top + table.height * 0.15, table.height * 0.7).reverse();
  const topXs = spread(t, table.left + table.width * 0.08, table.width * 0.84);
  const rightYs = spread(r, table.top + table.height * 0.15, table.height * 0.7);
  return [
    ...leftYs.map((y) => ({ x: table.left, y })),
    ...topXs.map((x) => ({ x, y: table.top })),
    ...rightYs.map((y) => ({ x: table.left + table.width, y })),
  ];
}

/**
 * Positions for a fanned hand. Returns left/top (px, relative to the hand
 * container), rotation and z-order per card. Keeps 16 px free on each side,
 * including the corners of rotated cards.
 */
export function pnFan(
  count: number,
  opts: { containerWidth: number; cardWidth: number; maxStep?: number; rotStep?: number; sag?: number; topRoom?: number },
): Array<{ x: number; y: number; rotate: number; z: number }> {
  const { containerWidth, cardWidth } = opts;
  const rotStep = opts.rotStep ?? 4;
  const sag = opts.sag ?? 14;
  const topRoom = opts.topRoom ?? 30;
  if (count <= 0) return [];
  const half = (count - 1) / 2;
  const maxRot = (rotStep * half * Math.PI) / 180;
  const cardHeight = cardWidth * 1.4;
  const overhang = Math.sin(maxRot) * cardHeight * 0.5;
  const usable = Math.max(cardWidth, containerWidth - 32 - overhang * 2);
  const step = count > 1 ? Math.min(opts.maxStep ?? cardWidth * 0.66, (usable - cardWidth) / (count - 1)) : 0;
  const total = cardWidth + step * (count - 1);
  const start = (containerWidth - total) / 2;
  return Array.from({ length: count }, (_, i) => {
    const off = i - half;
    const norm = half > 0 ? off / half : 0;
    return { x: start + i * step, y: topRoom + sag * norm * norm, rotate: off * rotStep, z: i + 1 };
  });
}
