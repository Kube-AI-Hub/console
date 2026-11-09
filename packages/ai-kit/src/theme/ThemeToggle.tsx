import * as React from 'react';
import { useTheme, type AccentPalette } from './ThemeProvider';
import { cn } from '../utils/cn';

export interface ThemeToggleProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  /** Accessible label for the switch action. */
  label?: string;
}

/**
 * Dark/light switch.
 *
 * The two glyphs are stacked in one grid cell and cross-faded, which avoids the
 * layout jump a swapped icon would cause.
 */
export function ThemeToggle({ label = '切换深浅色主题', className, ...props }: ThemeToggleProps): React.ReactElement {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      aria-pressed={isDark}
      title={label}
      className={cn(
        'ai-pressable relative grid size-9 place-items-center rounded-ai-md border',
        'border-ai-line bg-transparent text-ai-fg-muted',
        'transition-colors duration-ai-base hover:border-ai-line-strong hover:bg-ai-surface-2 hover:text-ai-fg',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ai-bg',
        className,
      )}
      {...props}
    >
      <SunIcon className={cn('col-start-1 row-start-1 size-4 transition-opacity duration-ai-base', isDark ? 'opacity-100' : 'opacity-0')} />
      <MoonIcon className={cn('col-start-1 row-start-1 size-4 transition-opacity duration-ai-base', isDark ? 'opacity-0' : 'opacity-100')} />
    </button>
  );
}

export interface AccentToggleProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  label?: string;
}

const ACCENT_ORDER: AccentPalette[] = ['violet', 'green'];
const ACCENT_LABEL: Record<AccentPalette, string> = { violet: '紫罗兰', green: '品牌绿' };

/**
 * Cycles the accent palette.
 *
 * A segmented control would be clearer, but the host often only has room for a
 * single icon button in the top bar, so this cycles and announces the current
 * palette through the accessible name.
 */
export function AccentToggle({ label, className, ...props }: AccentToggleProps): React.ReactElement {
  const { accent, setAccent } = useTheme();
  const next = ACCENT_ORDER[(ACCENT_ORDER.indexOf(accent) + 1) % ACCENT_ORDER.length] as AccentPalette;
  const text = label ?? `切换配色（当前${ACCENT_LABEL[accent]}）`;

  return (
    <button
      type="button"
      onClick={() => setAccent(next)}
      aria-label={text}
      title={text}
      data-accent-current={accent}
      className={cn(
        'ai-pressable grid size-9 place-items-center rounded-ai-md border',
        'border-ai-line bg-transparent text-ai-fg-muted',
        'transition-colors duration-ai-base hover:border-ai-line-strong hover:bg-ai-surface-2 hover:text-ai-fg',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ai-bg',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="size-3.5 rounded-full ring-1 ring-inset ring-ai-line-strong transition-colors duration-ai-base"
        style={{ backgroundColor: 'rgb(var(--ai-accent))' }}
      />
    </button>
  );
}

function SunIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />
    </svg>
  );
}
