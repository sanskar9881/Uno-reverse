import { create } from 'zustand';

export type ThemeChoice = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'uno-party:theme';
/** Must match --color-night in each theme, so the browser chrome matches the page. */
const THEME_COLOR: Record<ResolvedTheme, string> = { dark: '#151028', light: '#faf6ef' };

const darkQuery = (): MediaQueryList => window.matchMedia('(prefers-color-scheme: dark)');

export function readChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}

export const resolveTheme = (choice: ThemeChoice): ResolvedTheme =>
  choice === 'system' ? (darkQuery().matches ? 'dark' : 'light') : choice;

/** The inline script in index.html does this before the first paint; this keeps it in sync after. */
function apply(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);
  root.style.colorScheme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[resolved]);
}

interface ThemeStore {
  choice: ThemeChoice;
  resolved: ResolvedTheme;
  setChoice(choice: ThemeChoice): void;
}

const initialChoice = readChoice();

export const useThemeStore = create<ThemeStore>((set) => ({
  choice: initialChoice,
  resolved: resolveTheme(initialChoice),
  setChoice(choice) {
    try {
      if (choice === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Private mode: the choice still applies for this session.
    }
    const resolved = resolveTheme(choice);
    apply(resolved);
    set({ choice, resolved });
  },
}));

/** Follows the OS while the choice is System. Call once at startup. */
export function startThemeSync(): void {
  apply(useThemeStore.getState().resolved);
  darkQuery().addEventListener('change', () => {
    if (useThemeStore.getState().choice !== 'system') return;
    const resolved = resolveTheme('system');
    apply(resolved);
    useThemeStore.setState({ resolved });
  });
}
