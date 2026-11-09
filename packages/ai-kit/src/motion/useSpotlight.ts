import * as React from 'react';

/**
 * Writes the pointer position into `--ai-mx` / `--ai-my` on the element, which
 * the `.ai-spotlight` CSS turns into a radial highlight.
 *
 * The listener is only attached on devices with a fine pointer. On touch
 * screens a "pointer position" has no meaning and the handler would just cost
 * work.
 */
export function useSpotlight<T extends HTMLElement = HTMLDivElement>(): {
  ref: React.RefObject<T | null>;
  onPointerMove: (event: React.PointerEvent<T>) => void;
} {
  const ref = React.useRef<T | null>(null);

  const onPointerMove = React.useCallback((event: React.PointerEvent<T>) => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    node.style.setProperty('--ai-mx', `${event.clientX - rect.left}px`);
    node.style.setProperty('--ai-my', `${event.clientY - rect.top}px`);
  }, []);

  return { ref, onPointerMove };
}

/** True when the user asked the system to reduce motion. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  React.useEffect(() => {
    if (!window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
