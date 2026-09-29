import { useThemeStore, type ThemeChoice } from '../../store/themeStore';
import { cn } from '../../utils/cn';

const NEXT: Record<ThemeChoice, ThemeChoice> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<ThemeChoice, string> = {
  system: 'Theme: follows your device. Switch to light',
  light: 'Theme: light. Switch to dark',
  dark: 'Theme: dark. Switch to follow your device',
};

function SunIcon() {
  return (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  );
}

function MoonIcon() {
  return <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />;
}

function SystemIcon() {
  return (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8m-4-4v4" />
    </>
  );
}

/** Cycles System → Light → Dark. The choice is saved per device. */
export function ThemeToggle({ className }: { className?: string }) {
  const choice = useThemeStore((s) => s.choice);
  const setChoice = useThemeStore((s) => s.setChoice);

  return (
    <button
      type="button"
      onClick={() => setChoice(NEXT[choice])}
      aria-label={LABEL[choice]}
      title={LABEL[choice]}
      className={cn('grid h-11 w-11 place-items-center rounded-xl text-muted hover:bg-veil/10 hover:text-ink', className)}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {choice === 'light' ? <SunIcon /> : choice === 'dark' ? <MoonIcon /> : <SystemIcon />}
      </svg>
    </button>
  );
}
