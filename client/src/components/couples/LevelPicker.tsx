import type { CouplesLevel } from '@shared';
import { SegmentedControl } from '../ui/SegmentedControl';

const LEVELS = ['sweet', 'flirty', 'spicy'] as const satisfies readonly CouplesLevel[];
const LABELS: Record<CouplesLevel, string> = { sweet: 'Sweet', flirty: 'Flirty', spicy: 'Spicy' };

export function LevelPicker({
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
  return <SegmentedControl label={label} options={LEVELS} value={value} onChange={onChange} format={(v) => LABELS[v]} disabled={disabled} />;
}
