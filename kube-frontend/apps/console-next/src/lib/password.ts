import type { Translate } from '@kube-ai-hub/locales';

/**
 * The sentence for a `passwordProblem` code.
 *
 * One mapping for every form that sets a password. The create-user dialog and the personal
 * settings dialog ask the platform the same question, and two copies of the wording is how
 * they start disagreeing about the rule — which is exactly what had happened: the create
 * dialog accepted a password with no upper-case letter while the server rejected it with a
 * 422 whose body is the admission regex.
 */
export function passwordProblemMessage(t: Translate, problem: string | null): string | null {
  if (!problem) return null;
  switch (problem) {
    case 'too-short':
      return t('platform.users.field.passwordShort');
    case 'too-long':
      return t('platform.users.field.passwordLong');
    case 'no-letter':
      return t('platform.users.field.passwordLetter');
    case 'no-lower':
      return t('platform.users.field.passwordLower');
    case 'no-upper':
      return t('platform.users.field.passwordUpper');
    case 'no-digit':
      return t('platform.users.field.passwordDigit');
    case 'no-special':
      return t('platform.users.field.passwordSpecial');
    default:
      return t('platform.users.field.passwordShort');
  }
}
