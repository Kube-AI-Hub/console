import * as React from 'react';
import { cn } from '../utils/cn';

export interface RevealProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Stagger offset in ms; siblings usually increment this by ~60ms. */
  delay?: number;
  /** Only animate the first time the element becomes visible. */
  once?: boolean;
}

/**
 * Fades and lifts its children in once they scroll into view.
 *
 * The initial hidden state lives in CSS (`.ai-reveal`), not inline styles, so
 * `prefers-reduced-motion` can neutralise it without JavaScript. If the
 * observer never fires — an ancient browser, or a test environment without
 * IntersectionObserver — the content is shown immediately rather than staying
 * invisible.
 */
export function Reveal({ children, delay = 0, once = true, className, style, ...props }: RevealProps): React.ReactElement {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) observer.disconnect();
          } else if (!once) {
            setVisible(false);
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.1 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [once]);

  return (
    <div
      ref={ref}
      data-visible={visible ? 'true' : 'false'}
      className={cn('ai-reveal', className)}
      style={{ ...style, ['--ai-reveal-delay' as string]: `${delay}ms` }}
      {...props}
    >
      {children}
    </div>
  );
}
