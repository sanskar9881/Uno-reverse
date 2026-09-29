import { AVATARS, NICKNAME_MAX_LENGTH, nicknameProblem } from '@shared';
import { useId } from 'react';
import { useGameStore } from '../../store/gameStore';
import { cn } from '../../utils/cn';

/** Nickname + avatar, saved to this browser as you type. */
export function ProfileFields({ showErrors, onEnter }: { showErrors: boolean; onEnter?: () => void }) {
  const profile = useGameStore((s) => s.profile);
  const updateProfile = useGameStore((s) => s.updateProfile);
  const id = useId();
  const problem = nicknameProblem(profile.nickname);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor={`${id}-name`} className="mb-1.5 block text-sm font-semibold text-muted">
          Your nickname
        </label>
        <input
          id={`${id}-name`}
          value={profile.nickname}
          maxLength={NICKNAME_MAX_LENGTH + 4}
          autoComplete="nickname"
          placeholder="e.g. Sanskar"
          onChange={(e) => updateProfile({ nickname: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
          aria-invalid={showErrors && problem ? true : undefined}
          aria-describedby={`${id}-hint`}
          className={cn(
            'h-12 w-full rounded-2xl bg-night px-4 text-lg font-semibold text-ink ring-1 ring-line placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-card-yellow',
            showErrors && problem && 'ring-2 ring-card-red',
          )}
        />
        <p id={`${id}-hint`} className={cn('mt-1.5 min-h-5 text-sm', showErrors && problem ? 'text-card-red' : 'text-muted/70')}>
          {showErrors && problem ? problem : 'Friends will see this at the table.'}
        </p>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold text-muted">Pick an avatar</legend>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12" role="radiogroup">
          {AVATARS.map((emoji, index) => (
            <button
              key={emoji}
              type="button"
              role="radio"
              aria-checked={profile.avatar === index}
              aria-label={`Avatar ${index + 1}`}
              onClick={() => updateProfile({ avatar: index })}
              className={cn(
                'grid aspect-square place-items-center rounded-xl text-2xl transition-transform',
                profile.avatar === index ? 'scale-110 bg-card-yellow/20 ring-2 ring-card-yellow' : 'bg-veil/5 hover:bg-veil/10',
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
