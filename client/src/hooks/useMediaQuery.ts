import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** Phone: the opponent strip, compact piles and the hand — width under 640px. */
export const useIsCompact = (): boolean => useMediaQuery('(max-width: 639px)');

/** Tablet: 640–1023px. Between the phone strip and the full desktop oval. */
export const useIsTablet = (): boolean => useMediaQuery('(min-width: 640px) and (max-width: 1023px)');

/** A phone held sideways: short enough that the hand and actions move to the side instead of the bottom. */
export const useIsShortLandscape = (): boolean => useMediaQuery('(max-height: 499px)');
