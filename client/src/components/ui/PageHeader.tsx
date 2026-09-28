import { useNavigate } from 'react-router';
import { cn } from '../../utils/cn';
import { SoundToggle } from './SoundToggle';

interface PageHeaderProps {
  title: string;
  backTo?: string;
  className?: string;
}

/** A back button, the page title, and the sound toggle. Used by every game route. */
export function PageHeader({ title, backTo = '/', className }: PageHeaderProps) {
  const navigate = useNavigate();
  return (
    <header className={cn('flex items-center justify-between gap-3 px-1 py-2', className)}>
      <button
        type="button"
        onClick={() => navigate(backTo)}
        aria-label="Back"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-ink hover:bg-white/10"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      <h1 className="truncate font-display text-xl">{title}</h1>
      <SoundToggle className="shrink-0" />
    </header>
  );
}
