import { setMuted } from '../../game/sounds';
import { useGameStore } from '../../store/gameStore';
import { cn } from '../../utils/cn';

export function SoundToggle({ className }: { className?: string }) {
  const muted = useGameStore((s) => s.profile.muted);
  const updateProfile = useGameStore((s) => s.updateProfile);
  const toggle = () => {
    setMuted(!muted);
    updateProfile({ muted: !muted });
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={muted}
      aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
      title={muted ? 'Unmute sounds' : 'Mute sounds'}
      className={cn('grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-white/10 hover:text-ink', className)}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none" />
        {muted ? (
          <path d="M16 9.5l5 5m0-5l-5 5" />
        ) : (
          <>
            <path d="M15.5 9a4 4 0 0 1 0 6" />
            <path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" />
          </>
        )}
      </svg>
    </button>
  );
}
