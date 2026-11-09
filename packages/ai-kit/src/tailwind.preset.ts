import type { Config } from 'tailwindcss';

/**
 * Tailwind preset for `@kube-ai-hub/ai-kit`.
 *
 * Colours are declared as `rgb(var(--ai-x) / <alpha-value>)`, not as hex, so
 * opacity modifiers (`bg-ai-surface-1/60`) work and so a single utility
 * resolves correctly in both themes without duplicate class names.
 *
 * Consumers add `presets: [aiKitPreset]` and include this package's source in
 * `content` if they compile the library from source.
 */
const withAlpha = (token: string) => `rgb(var(${token}) / <alpha-value>)`;

const aiKitPreset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        ai: {
          bg: withAlpha('--ai-bg'),
          'bg-elevated': withAlpha('--ai-bg-elevated'),
          'bg-overlay': withAlpha('--ai-bg-overlay'),
          'bg-deep': withAlpha('--ai-bg-deep'),

          'surface-1': withAlpha('--ai-surface-1'),
          'surface-2': withAlpha('--ai-surface-2'),
          'surface-3': withAlpha('--ai-surface-3'),

          fg: withAlpha('--ai-fg'),
          'fg-secondary': withAlpha('--ai-fg-secondary'),
          'fg-muted': withAlpha('--ai-fg-muted'),
          'fg-faint': withAlpha('--ai-fg-faint'),

          line: withAlpha('--ai-line'),
          'line-strong': withAlpha('--ai-line-strong'),

          accent: withAlpha('--ai-accent'),
          'accent-hover': withAlpha('--ai-accent-hover'),
          'accent-fg': withAlpha('--ai-accent-fg'),
          'accent-soft': withAlpha('--ai-accent-soft'),
          'accent-strong': withAlpha('--ai-accent-strong'),

          info: withAlpha('--ai-info'),
          success: withAlpha('--ai-success'),
          warning: withAlpha('--ai-warning'),
          danger: withAlpha('--ai-danger'),
          'danger-fg': withAlpha('--ai-danger-fg'),
          sub: withAlpha('--ai-sub'),
          ring: withAlpha('--ai-ring'),

          'nav-bg': withAlpha('--ai-nav-bg'),
          'th-bg': withAlpha('--ai-th-bg'),
          'row-hover': withAlpha('--ai-row-hover-bg'),

          /* Raw ramps exposed for the rare case that needs an exact step
             (charts, status dots) instead of a semantic role. */
          navy: {
            900: withAlpha('--ai-raw-navy-900'),
            800: withAlpha('--ai-raw-navy-800'),
            700: withAlpha('--ai-raw-navy-700'),
            600: withAlpha('--ai-raw-navy-600'),
            500: withAlpha('--ai-raw-navy-500'),
            400: withAlpha('--ai-raw-navy-400'),
            300: withAlpha('--ai-raw-navy-300'),
            200: withAlpha('--ai-raw-navy-200'),
          },
          ice: {
            100: withAlpha('--ai-raw-ice-100'),
            300: withAlpha('--ai-raw-ice-300'),
            500: withAlpha('--ai-raw-ice-500'),
            700: withAlpha('--ai-raw-ice-700'),
            800: withAlpha('--ai-raw-ice-800'),
          },
          violet: {
            100: withAlpha('--ai-raw-violet-100'),
            200: withAlpha('--ai-raw-violet-200'),
            300: withAlpha('--ai-raw-violet-300'),
            400: withAlpha('--ai-raw-violet-400'),
          },
          cyan: {
            100: withAlpha('--ai-raw-cyan-100'),
            300: withAlpha('--ai-raw-cyan-300'),
            500: withAlpha('--ai-raw-cyan-500'),
          },
          red: {
            200: withAlpha('--ai-raw-red-200'),
            300: withAlpha('--ai-raw-red-300'),
            400: withAlpha('--ai-raw-red-400'),
          },
          amber: {
            200: withAlpha('--ai-raw-amber-200'),
            300: withAlpha('--ai-raw-amber-300'),
          },
        },
      },
      borderRadius: {
        'ai-sm': 'var(--ai-radius-sm)',
        'ai-md': 'var(--ai-radius-md)',
        'ai-lg': 'var(--ai-radius-lg)',
        'ai-xl': 'var(--ai-radius-xl)',
        'ai-pill': 'var(--ai-radius-pill)',
      },
      fontFamily: {
        'ai-sans': 'var(--ai-font-sans)',
        'ai-mono': 'var(--ai-font-mono)',
      },
      transitionTimingFunction: {
        'ai-out': 'var(--ai-ease-out)',
        'ai-in-out': 'var(--ai-ease-in-out)',
      },
      transitionDuration: {
        'ai-fast': 'var(--ai-duration-fast)',
        'ai-base': 'var(--ai-duration-base)',
        'ai-slow': 'var(--ai-duration-slow)',
      },
      boxShadow: {
        'ai-card': '0 1px 2px rgb(var(--ai-fg) / 0.04), 0 8px 24px rgb(var(--ai-fg) / 0.06)',
        'ai-pop': '0 8px 32px rgb(var(--ai-fg) / 0.14)',
      },
      keyframes: {
        'ai-fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'ai-scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'none' },
        },
        /**
         * Entrance for elements that are centred with `translate`.
         *
         * `ai-scale-in` animates `transform` and ends at `none`, which wipes out
         * a centring transform and leaves the element anchored at its top-left
         * corner. This variant scales through a CSS variable so the element's
         * own `translate` survives, and it composes the two in one transform.
         */
        'ai-pop-in': {
          from: { opacity: '0', transform: 'translate(-50%, -50%) scale(var(--ai-pop-scale))' },
          to: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
        },
        /**
         * Bottom-sheet entrance for the modal on phones.
         *
         * The end state is written as the explicit rest position rather than
         * `transform: none`. Without `animation-fill-mode` the browser drops the
         * `to` value once the animation finishes and falls back to the element's
         * own `transform`, which left the sheet pushed a full height off-screen.
         */
        'ai-sheet-in': {
          from: { opacity: '0', transform: 'translateY(100%)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'ai-slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        'ai-fade-in': 'ai-fade-in var(--ai-duration-base) var(--ai-ease-out)',
        'ai-scale-in': 'ai-scale-in var(--ai-duration-base) var(--ai-ease-out)',
        'ai-pop-in': 'ai-pop-in var(--ai-duration-base) var(--ai-ease-out)',
        'ai-slide-up': 'ai-slide-up var(--ai-duration-base) var(--ai-ease-out)',
        // `both` keeps the final keyframe applied after the animation ends, so
        // the element does not snap back to its pre-animation transform.
        'ai-sheet-in': 'ai-sheet-in var(--ai-duration-slow) var(--ai-ease-out) both',
      },
    },
  },
};

export default aiKitPreset;
