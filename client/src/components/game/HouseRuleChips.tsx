import type { HouseRules } from '@shared';
import { Chip } from '../ui/Chip';

export const HOUSE_RULE_LABELS: Record<Exclude<keyof HouseRules, 'customRuleText'>, string> = {
  stacking: 'Stacking',
  drawUntilPlayable: 'Draw till you can play',
  mustPlayDrawn: 'Must play a drawn card',
  sevenZero: '7-0',
  jumpIn: 'Jump-in',
  modernDeck: '112-card deck',
};

/** Small chips naming whichever house rules are on. Renders nothing when they're all off. */
export function HouseRuleChips({ houseRules, className }: { houseRules: HouseRules; className?: string }) {
  const active = (Object.keys(HOUSE_RULE_LABELS) as (keyof typeof HOUSE_RULE_LABELS)[]).filter((key) => houseRules[key]);
  if (active.length === 0) return null;
  return (
    <div className={className ? `flex flex-wrap gap-1.5 ${className}` : 'flex flex-wrap gap-1.5'}>
      {active.map((key) => (
        <Chip key={key}>{HOUSE_RULE_LABELS[key]}</Chip>
      ))}
    </div>
  );
}
