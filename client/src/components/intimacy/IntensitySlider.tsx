import type { CouplesLevel } from '@shared';

const LEVELS: readonly CouplesLevel[] = ['sweet', 'flirty', 'spicy'];
const LABELS: Record<CouplesLevel, string> = { sweet: 'Sweet', flirty: 'Flirty', spicy: 'Spicy' };

/** A compact three-stop slider for comfort level, small enough to sit in a header. */
export function IntensitySlider({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: CouplesLevel;
  onChange: (level: CouplesLevel) => void;
  disabled?: boolean;
}) {
  const index = LEVELS.indexOf(value);
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <input
        type="range"
        min={0}
        max={2}
        step={1}
        value={index}
        disabled={disabled}
        onChange={(e) => onChange(LEVELS[Number(e.target.value)])}
        aria-label={label}
        aria-valuetext={LABELS[value]}
        className="h-1.5 w-16 shrink-0 accent-couples-rose disabled:opacity-50"
      />
      <span className="w-11 shrink-0 truncate text-xs font-bold text-couples-candle">{LABELS[value]}</span>
    </div>
  );
}
