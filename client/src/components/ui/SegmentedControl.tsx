import { cn } from '../../utils/cn';

interface SegmentedControlProps<T extends string | number> {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format: (v: T) => string;
  disabled?: boolean;
}

/** A row of exclusive options, e.g. time per turn. Used by the lobby and the new games. */
export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
  format,
  disabled,
}: SegmentedControlProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-muted">{label}</span>
      <div className="grid grid-flow-col gap-1 rounded-2xl bg-night p-1 ring-1 ring-line">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            disabled={disabled}
            onClick={() => value !== option && onChange(option)}
            className={cn(
              'h-9 rounded-xl px-2 text-sm font-bold transition-colors',
              value === option ? 'bg-card-yellow text-night' : 'text-muted enabled:hover:bg-veil/10 enabled:hover:text-ink',
              disabled && value !== option && 'opacity-50',
            )}
          >
            {format(option)}
          </button>
        ))}
      </div>
    </div>
  );
}
