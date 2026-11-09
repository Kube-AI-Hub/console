import * as React from 'react';
import { cn } from '../../utils/cn';
import type { IconName } from './names';

/**
 * Icon from the migrated sprite.
 *
 * The sprite is injected once into the document rather than inlined per icon:
 * 370 symbols is ~330 KB, and repeating even a few of them in a table would
 * dominate the DOM. A module-level guard keeps the injection idempotent across
 * remounts and multiple copies of the library on one page.
 *
 * It is loaded lazily. A static import would put the whole sprite into the main
 * bundle for every consumer, including pages that render no icons at all; the
 * dynamic import lets the bundler split it into its own chunk. Icons render as
 * empty `<svg>` elements for the frame before the chunk arrives, which is
 * invisible because the surrounding layout does not depend on the glyph.
 *
 * The sprite is appended to `<body>` so it participates in no layout. Symbols
 * reference `currentColor`, so an icon inherits the text colour of its context
 * and needs no per-icon theming.
 */

const SPRITE_ID = '__ai-kit-svg-sprite__';
let spritePromise: Promise<void> | null = null;

function ensureSprite(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  if (document.getElementById(SPRITE_ID)) return Promise.resolve();
  if (spritePromise) return spritePromise;

  spritePromise = import('./sprite').then(({ SVG_SPRITE }) => {
    if (document.getElementById(SPRITE_ID)) return;
    const container = document.createElement('div');
    container.innerHTML = SVG_SPRITE;
    const svg = container.querySelector('svg');
    if (!svg) return;
    svg.id = SPRITE_ID;
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    document.body.insertBefore(svg, document.body.firstChild);
  }).catch(() => {
    // A failed chunk load leaves the sprite absent; the caller sees an empty
    // icon rather than an unhandled rejection.
    spritePromise = null;
  });

  return spritePromise;
}

export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  /** Pixel size for both axes; defaults to the inherited font size. */
  size?: number | string;
  /**
   * Accessible label. Without it the icon is decorative and hidden from the
   * accessibility tree, which is correct for an icon that sits next to text.
   */
  label?: string;
  /** Rotate the glyph, e.g. a chevron pointing down when a panel is closed. */
  rotate?: number;
}

export const Icon = React.forwardRef<SVGSVGElement, IconProps>(function Icon(
  { name, size, label, rotate, className, style, ...props },
  ref,
) {
  React.useEffect(() => {
    void ensureSprite();
  }, []);

  const dimension = size ?? '1em';
  const decorative = !label;

  return (
    <svg
      ref={ref}
      className={cn('inline-block shrink-0 align-[-0.125em]', className)}
      style={{
        width: dimension,
        height: dimension,
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
        ...style,
      }}
      // The symbol carries its own viewBox, but without one here the browser
      // has no coordinate space to scale `<use>` into and paints nothing.
      viewBox="0 0 24 24"
      // Symbols fill with `currentColor`; stating it on the host svg keeps the
      // glyph visible when the icon inherits a colour set further up the tree.
      fill="currentColor"
      role={decorative ? undefined : 'img'}
      aria-label={label}
      aria-hidden={decorative ? 'true' : undefined}
      focusable="false"
      {...props}
    >
      <use href={`#icon-${name}`} />
    </svg>
  );
});
