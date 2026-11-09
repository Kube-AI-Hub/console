import * as React from 'react';

/**
 * Subscribe to a CSS media query.
 *
 * Some layouts cannot be expressed with utility classes alone — a two-panel
 * calendar has to *change its content*, not just its widths — so components
 * need to know the breakpoint in JavaScript too. This keeps the JS check and
 * the Tailwind breakpoint in sync by naming the same query.
 *
 * The initial value is computed during render so the first paint already uses
 * the right branch; without it a phone would briefly render the desktop layout.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const list = window.matchMedia(query);
    const update = (event: MediaQueryListEvent | MediaQueryList) => setMatches(event.matches);
    update(list);
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);

  return matches;
}

/** Matches Tailwind's `sm` breakpoint (40rem / 640px). */
export const useIsMobile = (): boolean => useMediaQuery('(max-width: 39.9375rem)');

/** Matches Tailwind's `md` breakpoint (48rem / 768px). */
export const useIsCompact = (): boolean => useMediaQuery('(max-width: 47.9375rem)');
