import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

/* ---------------- Badge / Tag ---------------- */

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-ai-pill px-2 py-0.5 text-[11px] font-medium leading-4',
  {
    variants: {
      tone: {
        neutral: 'bg-ai-surface-3 text-ai-fg-secondary',
        accent: 'bg-ai-accent/15 text-ai-accent',
        info: 'bg-ai-info/15 text-ai-info',
        success: 'bg-ai-success/15 text-ai-success',
        warning: 'bg-ai-warning/15 text-ai-warning',
        danger: 'bg-ai-danger/15 text-ai-danger',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Show a leading dot; useful when the badge encodes a state. */
  dot?: boolean;
  /**
   * Text form: a coloured dot followed by the label, for status columns
   * ("运行中" / "异常"). Rendered as plain text rather than a pill so it sits
   * quietly inside dense tables.
   */
  text?: React.ReactNode;
  /** Count form: the number is clamped to `max` and suffixed with `+`. */
  count?: number;
  /** Upper bound before the count becomes `max+`; defaults to 99. */
  max?: number;
}

const dotTone: Record<NonNullable<BadgeProps['tone']>, string> = {
  neutral: 'bg-ai-fg-faint',
  accent: 'bg-ai-accent',
  info: 'bg-ai-info',
  success: 'bg-ai-success',
  warning: 'bg-ai-warning',
  danger: 'bg-ai-danger',
};

export function Badge({
  className,
  tone,
  dot = false,
  text,
  count,
  max = 99,
  children,
  ...props
}: BadgeProps): React.ReactElement {
  // Status text is its own presentation: no pill background, just a dot in the
  // tone colour and label-weight text.
  if (text !== undefined) {
    return (
      <span
        className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium text-ai-fg-secondary', className)}
        {...props}
      >
        <span className={cn('size-1.5 shrink-0 rounded-full', dotTone[tone ?? 'neutral'])} aria-hidden="true" />
        {text}
      </span>
    );
  }

  const hasCount = typeof count === 'number';
  const displayCount = hasCount ? (count > max ? `${max}+` : String(count)) : null;

  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden="true" /> : null}
      {hasCount ? (
        // The raw number stays available to assistive tech even when the visual
        // output is truncated to "99+".
        <span title={String(count)}>{displayCount}</span>
      ) : (
        children
      )}
    </span>
  );
}

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  onRemove?: () => void;
  removeLabel?: string;
  /** Semantic colouring, mirroring Badge so the two read alike. */
  tone?: NonNullable<BadgeProps['tone']>;
  /** Arbitrary CSS colour; takes precedence over `tone`. */
  color?: string;
}

const tagTones: Record<NonNullable<TagProps['tone']>, string> = {
  neutral: 'border-ai-line bg-ai-surface-2 text-ai-fg-secondary',
  accent: 'border-ai-accent/30 bg-ai-accent/10 text-ai-accent',
  info: 'border-ai-info/30 bg-ai-info/10 text-ai-info',
  success: 'border-ai-success/30 bg-ai-success/10 text-ai-success',
  warning: 'border-ai-warning/30 bg-ai-warning/10 text-ai-warning',
  danger: 'border-ai-danger/30 bg-ai-danger/10 text-ai-danger',
};

export function Tag({
  className,
  children,
  onRemove,
  removeLabel = '移除',
  tone = 'neutral',
  color,
  style,
  ...props
}: TagProps): React.ReactElement {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-ai-sm border px-2 py-0.5 text-[11px]',
        !color && tagTones[tone],
        className,
      )}
      // A custom colour overrides the tone border too, so the tag stays legible
      // as a single unit rather than a coloured box with a mismatched outline.
      style={color ? { color, borderColor: color, backgroundColor: 'transparent', ...style } : style}
      {...props}
    >
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className={cn(
            'relative grid size-3.5 place-items-center rounded-full text-ai-fg-faint',
            'transition-colors duration-ai-fast hover:bg-ai-surface-3 hover:text-ai-fg',
            // The visual dot is deliberately small; the hit area is expanded to
            // a 44px target so it can be tapped on a phone without missing.
            'after:absolute after:left-1/2 after:top-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[""]',
          )}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" className="size-2.5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      ) : null}
    </span>
  );
}

/* ---------------- Avatar ---------------- */

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  src?: string;
  /** Fallback text, usually one or two characters. */
  fallback: string;
  size?: 'sm' | 'md' | 'lg';
}

const avatarSizes = { sm: 'size-6 text-[10px]', md: 'size-8 text-xs', lg: 'size-10 text-sm' } as const;

export function Avatar({ src, fallback, size = 'md', className, ...props }: AvatarProps): React.ReactElement {
  const [failed, setFailed] = React.useState(false);
  const showImage = Boolean(src) && !failed;
  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-ai-surface-3 font-medium text-ai-fg-secondary',
        avatarSizes[size],
        className,
      )}
      {...props}
    >
      {showImage ? (
        <img src={src} alt="" onError={() => setFailed(true)} className="size-full object-cover" />
      ) : (
        <span aria-hidden="true">{fallback}</span>
      )}
    </span>
  );
}

/* ---------------- Card / Panel ---------------- */

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Enable the pointer spotlight and hover lift. */
  interactive?: boolean;
}

export function Card({ className, interactive = false, ...props }: CardProps): React.ReactElement {
  return (
    <div
      className={cn(
        'rounded-ai-lg border border-ai-line bg-ai-surface-1 shadow-ai-card',
        interactive && 'ai-lift ai-spotlight cursor-pointer',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn('flex flex-col gap-1 p-4 pb-2', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>): React.ReactElement {
  return <h3 className={cn('text-sm font-semibold text-ai-fg', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>): React.ReactElement {
  return <p className={cn('text-xs leading-5 text-ai-fg-muted', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn('p-4 pt-2', className)} {...props} />;
}

export interface PanelProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Rendered at the right edge of the header. */
  actions?: React.ReactNode;
}

export function Panel({ title, description, actions, className, children, ...props }: PanelProps): React.ReactElement {
  return (
    <section className={cn('rounded-ai-lg border border-ai-line bg-ai-surface-1', className)} {...props}>
      {title || actions ? (
        <header className="flex items-start gap-3 border-b border-ai-line px-4 py-3">
          <div className="min-w-0 flex-1">
            {title ? <h3 className="truncate text-sm font-semibold text-ai-fg">{title}</h3> : null}
            {description ? <p className="mt-0.5 text-xs text-ai-fg-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

/* ---------------- Text / Divider ---------------- */

const textVariants = cva('', {
  variants: {
    tone: {
      default: 'text-ai-fg',
      secondary: 'text-ai-fg-secondary',
      muted: 'text-ai-fg-muted',
      faint: 'text-ai-fg-faint',
      accent: 'text-ai-accent',
      danger: 'text-ai-danger',
    },
    size: {
      xs: 'text-[11px] leading-4',
      sm: 'text-xs leading-5',
      md: 'text-sm leading-6',
      lg: 'text-base leading-7',
    },
    weight: {
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
    },
  },
  defaultVariants: { tone: 'default', size: 'md', weight: 'normal' },
});

export interface TextProps
  extends React.HTMLAttributes<HTMLParagraphElement>,
    VariantProps<typeof textVariants> {
  as?: 'p' | 'span' | 'div';
}

export function Text({ as: Component = 'p', className, tone, size, weight, ...props }: TextProps): React.ReactElement {
  return <Component className={cn(textVariants({ tone, size, weight }), className)} {...props} />;
}

export interface DividerProps extends React.HTMLAttributes<HTMLHRElement> {
  orientation?: 'horizontal' | 'vertical';
}

export function Divider({ orientation = 'horizontal', className, ...props }: DividerProps): React.ReactElement {
  return (
    <hr
      className={cn(
        'border-ai-line',
        orientation === 'horizontal' ? 'my-3 w-full border-t' : 'mx-3 h-full border-l',
        className,
      )}
      {...props}
    />
  );
}

/* ---------------- Skeleton / Progress / Empty ---------------- */

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-ai-sm bg-ai-surface-3', className)}
      {...props}
    />
  );
}

export type ProgressTone = 'accent' | 'success' | 'warning' | 'danger' | 'auto';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0-100. */
  value: number;
  label?: string;
  /**
   * Bar colour. `auto` recolours by how full the bar is, which is how quota and
   * capacity meters communicate urgency without a separate legend.
   */
  tone?: ProgressTone;
  /** `[warningAt, dangerAt]` for `tone="auto"`; defaults to `[80, 95]`. */
  thresholds?: [number, number];
}

const progressTone: Record<Exclude<ProgressTone, 'auto'>, string> = {
  accent: 'bg-ai-accent',
  success: 'bg-ai-success',
  warning: 'bg-ai-warning',
  danger: 'bg-ai-danger',
};

/** Resolve `auto` against the thresholds, at the boundary or above it. */
export function resolveProgressTone(
  value: number,
  thresholds: [number, number] = [80, 95],
): Exclude<ProgressTone, 'auto'> {
  const [warningAt, dangerAt] = thresholds;
  if (value >= dangerAt) return 'danger';
  if (value >= warningAt) return 'warning';
  return 'accent';
}

export function Progress({
  value,
  label,
  tone = 'accent',
  thresholds = [80, 95],
  className,
  ...props
}: ProgressProps): React.ReactElement {
  const clamped = Math.max(0, Math.min(100, value));
  const resolved = tone === 'auto' ? resolveProgressTone(clamped, thresholds) : tone;
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      data-tone={resolved}
      className={cn('h-1.5 w-full overflow-hidden rounded-ai-pill bg-ai-surface-3', className)}
      {...props}
    >
      <div
        className={cn('h-full rounded-ai-pill transition-[width] duration-ai-slow ease-ai-out', progressTone[resolved])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export interface EmptyProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function Empty({ title = '暂无数据', description, icon, action, className, ...props }: EmptyProps): React.ReactElement {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-4 py-12 text-center', className)} {...props}>
      {icon ? <div className="text-ai-fg-faint">{icon}</div> : null}
      <p className="text-sm font-medium text-ai-fg-secondary">{title}</p>
      {description ? <p className="max-w-sm text-xs leading-5 text-ai-fg-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
