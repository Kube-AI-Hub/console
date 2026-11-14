import * as React from 'react';
import { cn } from '../utils/cn';

/**
 * How strong the typed password is.
 *
 * The library does not decide this: the rule lives in the host (console derives
 * it from api-client's `passwordChecks`), and the host passes the resolved level
 * in. Keeping the judgement outside means the meter can never disagree with the
 * validation that accepts or rejects the form.
 */
export type PasswordStrengthLevel = 'weak' | 'medium' | 'strong';

export interface PasswordStrengthCheck {
  /** Stable key, used both as the React key and in the automation handle. */
  key: string;
  label: React.ReactNode;
  met: boolean;
}

export interface PasswordStrengthMeterProps {
  level: PasswordStrengthLevel;
  checks: PasswordStrengthCheck[];
  /** Caption before the bar, e.g. 密码强度. */
  title: React.ReactNode;
  /** The readable level word, e.g. 弱 / 中 / 强. */
  levelLabel: React.ReactNode;
  /** Rule reminder above the checklist, e.g. 您的密码必须：. */
  rule?: React.ReactNode;
  /** Explanatory line under the checklist. */
  hint?: React.ReactNode;
  /**
   * Accessible name for the panel.
   *
   * The visible title is a ReactNode, so it cannot be stringified into
   * `${title}: ${levelLabel}`; the caller passes the composed sentence.
   */
  ariaLabel?: string;
  /**
   * Prefix for the `data-ai-id` handles, e.g. `user-settings`.
   *
   * Omitted means no handles at all: a component rendered somewhere that
   * automation does not need to address should not litter the DOM.
   */
  aiPrefix?: string;
  className?: string;
}

const BAR: Record<PasswordStrengthLevel, string> = {
  weak: 'w-1/3 bg-ai-danger',
  medium: 'w-2/3 bg-ai-warning',
  strong: 'w-full bg-ai-success',
};

const LABEL: Record<PasswordStrengthLevel, string> = {
  weak: 'text-ai-danger',
  medium: 'text-ai-warning',
  strong: 'text-ai-success',
};

/** Compose an automation handle, or `undefined` when the caller opted out. */
function handle(aiPrefix: string | undefined, suffix: string): string | undefined {
  return aiPrefix ? `${aiPrefix}:${suffix}` : undefined;
}

/**
 * Password strength: a bar, a readable level word and the rule checklist.
 *
 * Presentational only. The host owns the rule, the level derivation and every
 * string (the library ships no i18n), so the same panel serves personal settings
 * and the create-user dialog without importing either one's dependencies.
 */
export function PasswordStrengthMeter({
  level,
  checks,
  title,
  levelLabel,
  rule,
  hint,
  ariaLabel,
  aiPrefix,
  className,
}: PasswordStrengthMeterProps): React.ReactElement {
  return (
    <div
      className={cn('flex flex-col gap-2 rounded-ai-md border border-ai-line bg-ai-surface-1 px-3 py-2', className)}
      data-strength={level}
      data-ai-id={handle(aiPrefix, 'password-strength')}
      aria-label={ariaLabel}
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-ai-fg-muted">{title}</span>
        {/* The track is decoration: the level is carried by the text label beside
            it and by data-strength, so colour is never the only signal. */}
        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-ai-surface-2" aria-hidden="true">
          <div
            className={cn('h-full rounded-full transition-all duration-ai-fast', BAR[level])}
            data-ai-id={handle(aiPrefix, 'password-strength-bar')}
          />
        </div>
        <span className={cn('text-[11px] font-medium', LABEL[level])}>{levelLabel}</span>
      </div>
      {rule ? <p className="text-[11px] text-ai-fg-muted">{rule}</p> : null}
      <ul className="grid grid-cols-1 gap-1 text-[11px] sm:grid-cols-2">
        {checks.map((check) => (
          <li
            key={check.key}
            className={cn('flex items-center gap-1.5', check.met ? 'text-ai-fg-secondary' : 'text-ai-fg-muted')}
            data-met={check.met ? 'true' : 'false'}
            data-ai-id={handle(aiPrefix, `password-check-${check.key}`)}
          >
            <span
              aria-hidden="true"
              className={cn('inline-block size-1.5 rounded-full', check.met ? 'bg-ai-success' : 'bg-ai-line-strong')}
            />
            {check.label}
          </li>
        ))}
      </ul>
      {hint ? <p className="text-[11px] text-ai-fg-faint">{hint}</p> : null}
    </div>
  );
}
