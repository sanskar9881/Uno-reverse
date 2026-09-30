import type { IntimacyCategory } from '@shared';
import { INTIMACY_CATEGORIES, INTIMACY_CATEGORY_LABEL } from '@shared/games/intimacy/decks';
import { cn } from '../../utils/cn';

/** Which categories are in play, at least one always selected. */
export function CategoryPicker({
  categories,
  onChange,
  disabled,
}: {
  categories: IntimacyCategory[];
  onChange: (categories: IntimacyCategory[]) => void;
  disabled?: boolean;
}) {
  const toggle = (category: IntimacyCategory) => {
    const has = categories.includes(category);
    if (has && categories.length === 1) return;
    onChange(has ? categories.filter((c) => c !== category) : [...categories, category]);
  };

  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-couples text-xl">Categories</h2>
      <p className="text-sm text-muted">Pick what's in play tonight. At least one stays selected.</p>
      <div className="mt-1 flex flex-col gap-2">
        {INTIMACY_CATEGORIES.map((category) => (
          <label key={category} className="flex items-center justify-between gap-3 rounded-2xl bg-veil/5 px-4 py-3">
            <span className={cn('text-sm font-semibold', categories.includes(category) ? 'text-ink' : 'text-muted')}>
              {INTIMACY_CATEGORY_LABEL[category]}
            </span>
            <input
              type="checkbox"
              checked={categories.includes(category)}
              onChange={() => toggle(category)}
              disabled={disabled}
              className="h-5 w-5 shrink-0 accent-couples-rose"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
