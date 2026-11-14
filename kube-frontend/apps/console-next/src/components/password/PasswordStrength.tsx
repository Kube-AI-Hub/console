import * as React from 'react';
import { passwordChecks } from '@kube-ai-hub/api-client';
import { PasswordStrengthMeter } from '@kube-ai-hub/ui';
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
 *
 * The panel itself is ai-kit's `PasswordStrengthMeter`: presentational, so the level, the four
 * checks and every string stay here where the rule and the translations live. `scope` still
 * namespaces the `data-ai-id` handles — personal settings and the create-user dialog share this
 * component, and an agent (or a test) has to be able to tell which one it is looking at.
 */
export type PasswordStrengthLevel = 'weak' | 'medium' | 'strong';

export interface PasswordStrengthProps {
  password: string;
  /**
   * Namespace for the `data-ai-id` handles.
   *
   * Two forms render this panel — personal settings and the create-user dialog — and an agent
   * (or a test) has to be able to say which one it is looking at. Ids stay stable per scope, so
   * a default of `user-settings` keeps the existing handles unchanged.
   */
  scope?: string;
}

export function PasswordStrength({ password, scope = 'user-settings' }: PasswordStrengthProps): React.ReactElement | null {
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

  return (
    <PasswordStrengthMeter
      aiPrefix={scope}
      level={level}
      checks={[
        { key: 'case', label: t('userSettings.password.check.case'), met: checks.letterCase },
        { key: 'digit', label: t('userSettings.password.check.digit'), met: checks.digit },
        { key: 'special', label: t('userSettings.password.check.special'), met: checks.special },
        { key: 'length', label: t('userSettings.password.check.length'), met: checks.length },
      ]}
      title={t('userSettings.password.strength')}
      levelLabel={label}
      rule={t('userSettings.password.must')}
      hint={t('userSettings.password.strengthHint')}
      ariaLabel={`${t('userSettings.password.strength')}: ${label}`}
    />
  );
}
