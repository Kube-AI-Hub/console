import * as React from 'react';
import { passwordChecks } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { cn } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';

/**
 * 密码强度 — the checklist and the meter the old console showed while a password was typed.
 *
 * The old console put this in a dropdown that opened on focus and closed on blur, which meant
 * it covered the field being typed into and vanished the moment the reader clicked elsewhere.
 * Here it sits under the field for as long as there is something to say about it: the four
 * requirements tick off as they are met, and the meter says how strong the result is.
 *
 * The rule it reports is **stricter than the apiserver** — see `passwordProblem`. The meter and
 * the rejection therefore always agree: anything that reaches 强 passes, anything that reaches
 * 弱 would be refused.
 */
export type PasswordStrengthLevel = 'weak' | 'medium' | 'strong';

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

export interface PasswordStrengthProps {
  password: string;
}

export function PasswordStrength({ password }: PasswordStrengthProps): React.ReactElement | null {
  const t = useT();

  // Nothing typed, nothing to report: an empty meter reads as "your password is weak" when the
  // reader has not chosen one yet.
  if (password === '') return null;

  const checks = passwordChecks(password);
  const complete = checks.length && checks.letterCase && checks.digit && checks.special;
  /*
   * 弱 is "does not satisfy the rule", not "short". Every character class is required, so once
   * they are all present the only thing left to reward is length — hence 12 characters for 强.
   * Without that, a rule-passing password could never be anything but 强, and a three-level
   * meter with one reachable level is decoration.
   */
  const level: PasswordStrengthLevel = !complete ? 'weak' : password.length >= 12 ? 'strong' : 'medium';
  const label = t(`userSettings.password.strength${level === 'weak' ? 'Weak' : level === 'medium' ? 'Medium' : 'Strong'}`);

  const items = [
    { aiId: 'user-settings:password-check-case', met: checks.letterCase, text: t('userSettings.password.check.case') },
    { aiId: 'user-settings:password-check-digit', met: checks.digit, text: t('userSettings.password.check.digit') },
    { aiId: 'user-settings:password-check-special', met: checks.special, text: t('userSettings.password.check.special') },
    { aiId: 'user-settings:password-check-length', met: checks.length, text: t('userSettings.password.check.length') },
  ];

  return (
    <div
      className="flex flex-col gap-2 rounded-ai-md border border-ai-line bg-ai-surface-1 px-3 py-2"
      data-strength={level}
      aria-label={`${t('userSettings.password.strength')}: ${label}`}
      {...actionProps('user-settings:password-strength')}
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-ai-fg-muted">{t('userSettings.password.strength')}</span>
        {/* The track is decoration; the level is carried by the text label beside it and by
            `data-strength`, so colour is never the only signal. */}
        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-ai-surface-2" aria-hidden="true">
          <div
            className={cn('h-full rounded-full transition-all duration-ai-fast', BAR[level])}
            {...actionProps('user-settings:password-strength-bar')}
          />
        </div>
        <span className={cn('text-[11px] font-medium', LABEL[level])}>{label}</span>
      </div>
      <p className="text-[11px] text-ai-fg-muted">{t('userSettings.password.must')}</p>
      <ul className="grid grid-cols-1 gap-1 text-[11px] sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.aiId} className={cn('flex items-center gap-1.5', item.met ? 'text-ai-fg-secondary' : 'text-ai-fg-muted')} data-met={item.met ? 'true' : 'false'} {...actionProps(item.aiId)}>
            <span aria-hidden="true" className={cn('inline-block size-1.5 rounded-full', item.met ? 'bg-ai-success' : 'bg-ai-line-strong')} />
            {item.text}
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-ai-fg-faint">{t('userSettings.password.strengthHint')}</p>
    </div>
  );
}
