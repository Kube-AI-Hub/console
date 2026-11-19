import * as React from 'react';

/**
 * Chart palette, resolved from the live theme tokens.
 *
 * The tokens are channel triples (`--ai-chart-1: 169 129 248`), which no drawing
 * library can parse; `getComputedStyle` resolves them per theme at runtime. This
 * literal copy of the dark-theme values is the last resort for an environment with
 * no computed styles (jsdom, SSR, a host that never loaded `styles.css`): drawing
 * with the wrong theme is better than drawing nothing. It mirrors `tokens.css`, it
 * is not a second palette.
 */
export const FALLBACK_CHART_COLORS: readonly string[] = [
  'rgb(169 129 248)', // --ai-chart-1 / --ai-raw-violet-300
  'rgb(50 157 206)', // --ai-chart-2 / --ai-raw-cyan-300
  'rgb(245 166 35)', // --ai-chart-3 / --ai-raw-amber-300
  'rgb(57 229 184)', // --ai-chart-4 / --ai-raw-mint-400
  'rgb(234 133 115)', // --ai-chart-5 / --ai-raw-red-400
  'rgb(169 209 234)', // --ai-chart-6 / --ai-raw-ice-100
];

/** Token names in the same order as {@link FALLBACK_CHART_COLORS}. */
export const CHART_TOKENS = [
  '--ai-chart-1',
  '--ai-chart-2',
  '--ai-chart-3',
  '--ai-chart-4',
  '--ai-chart-5',
  '--ai-chart-6',
] as const;

/** `useLayoutEffect` on the client, `useEffect` where there is no DOM (SSR). */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;

/** Turn one token value into a colour a drawing library can use; unparseable values stay on the fallback. */
export function resolveTokenValue(host: HTMLElement | null, token: string, fallback: string): string {
  if (!host) return fallback;
  if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return fallback;
  try {
    const raw = window.getComputedStyle(host).getPropertyValue(token).trim();
    if (!raw || raw.includes('var(')) return fallback;
    // The token layers are channel triples; a drawing library needs a complete colour.
    if (/^\d{1,3}(?:\s+\d{1,3}){2}$/.test(raw)) return `rgb(${raw})`;
    // A host may redefine the token with a ready-made colour; keep it as-is.
    if (/^(?:#[\da-f]{3,8}|rgba?\(|hsla?\(|oklch\(|color\()/i.test(raw)) return raw;
    return fallback;
  } catch {
    return fallback;
  }
}

/**
 * Resolve the chart palette from the live token values.
 *
 * Re-reading whenever `data-theme` / `data-accent` changes on `<html>` keeps the
 * lines in the same colours as the surrounding chrome after a theme switch; a
 * one-shot read would leave a light page drawing dark-theme colours.
 *
 * `hostRef` must point at an element inside the themed subtree: tokens are inherited,
 * so reading them from a detached node returns the fallback.
 */
export function useChartPalette(hostRef: React.RefObject<HTMLElement | null>): readonly string[] {
  const [palette, setPalette] = React.useState<readonly string[]>(FALLBACK_CHART_COLORS);
  useIsomorphicLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const sync = (): void =>
      setPalette(CHART_TOKENS.map((token, index) => resolveTokenValue(host, token, FALLBACK_CHART_COLORS[index]!)));
    sync();
    if (typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-accent'] });
    return () => observer.disconnect();
  }, [hostRef]);
  return palette;
}
