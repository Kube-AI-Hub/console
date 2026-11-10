import * as React from 'react';
import { ApiError, isLoginErrorCode } from '@kube-ai-hub/api-client';
import { AiButton, AiSurface, Alert, Button, Input, InputPassword, Label, cn } from '@kube-ai-hub/ui';
import type { AiSurfaceState } from '@kube-ai-hub/ai-surface';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { useT } from '@/i18n';
import { useAuth } from '@/shell/AuthProvider';
import { safeReturnPath } from '@/routes/login';

/**
 * Sign-in screen, ported from the old console (`core/containers/Login`).
 *
 * A page rather than a modal over the console: an unauthenticated reader has no
 * navigation to fall back to, and every resource call behind it would render an
 * empty state rather than explain why.
 *
 * Three behaviours from the old page are load-bearing and easy to drop:
 *  - the return path survives the round trip, so a deep link lands where it
 *    pointed instead of the home page;
 *  - the password is sent as typed. The old page's `mix(salt, base64(pw))`
 *    obfuscation is gone — it hid nothing and rejected passwords containing `@`;
 *  - a pre-registration account (`initialized === false`) is called out, because
 *    its token authenticates but every request it then makes is refused.
 */
export function LoginPage(): React.ReactElement {
  const t = useT();
  const { signIn } = useAuth();
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<{ username?: string; password?: string }>({});

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const next: { username?: string; password?: string } = {};
    if (!username.trim()) next.username = t('login.usernameRequired');
    if (!password) next.password = t('login.passwordRequired');
    setFieldErrors(next);
    if (next.username || next.password) return;

    setSubmitting(true);
    setError(null);
    try {
      const user = await signIn(username.trim(), password);
      if (!user.initialized) {
        // Keep the form: there is no password-change route yet, and entering the
        // console would produce a screen of 403s.
        setError(t('login.passwordNotSet'));
        setSubmitting(false);
        return;
      }
      navigateAfterLogin();
    } catch (cause) {
      setError(phraseLoginError(cause, t));
      // Cleared on a credential failure: retyping is the next attempt, and
      // leaving a wrong value in place invites re-submitting it.
      setPassword('');
      setSubmitting(false);
    }
  };

  /*
   * `loading` while the exchange is in flight so an agent waits rather than
   * submitting twice; `error` once a failure is on screen.
   */
  const surfaceState: AiSurfaceState = submitting ? 'loading' : error ? 'error' : 'ready';

  return (
    /*
     * `AiSurface` even on the login page: an agent driving this console hits the
     * form before any list, and `data-ai-state` is how it knows whether to fill
     * the fields or wait.
     */
    <AiSurface as="main" aiId="login:surface" state={surfaceState} className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[360px]">
        <h1 className="mb-6 text-center text-base font-semibold text-ai-fg">{t('login.welcome')}</h1>
        <form
          onSubmit={onSubmit}
          noValidate
          className="flex flex-col gap-4 rounded-ai-lg border border-ai-line bg-ai-bg-elevated p-6 shadow-ai-sm"
          data-ai-id="login:form"
        >
          {error ? (
            <div data-ai-id="login:error" className="flex flex-col gap-2">
              <Alert tone="danger" title={error}>
                {/*
                 * A failed login is retryable by definition — the usual cause is a
                 * typo — so the failure says so rather than leaving the reader to
                 * infer that pressing the button again is allowed.
                 */}
                <AiButton aiId="login:retry" variant="ghost" disabled={submitting}>
                  {t('login.retry')}
                </AiButton>
              </Alert>
            </div>
          ) : null}

          <Field
            htmlFor="login-username"
            label={t('login.username')}
            required
            {...(fieldErrors.username === undefined ? {} : { error: fieldErrors.username })}
          >
            <Input
              id="login-username"
              name="username"
              autoComplete="username"
              autoFocus
              placeholder={t('login.usernamePlaceholder')}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              aria-invalid={fieldErrors.username ? true : undefined}
            />
          </Field>

          <Field
            htmlFor="login-password"
            label={t('login.password')}
            required
            {...(fieldErrors.password === undefined ? {} : { error: fieldErrors.password })}
          >
            <InputPassword
              id="login-password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={fieldErrors.password ? true : undefined}
            />
          </Field>

          <Button
            type="submit"
            loading={submitting}
            className="mt-1 w-full"
            {...actionProps('login:submit', { label: t('login.submit') })}
          >
            {t('login.submit')}
          </Button>
        </form>
      </div>
    </AiSurface>
  );
}

/**
 * One labelled control.
 *
 * Inlined rather than using ai-kit's `FormField` because `@kube-ai-hub/ui` does
 * not re-export it — that package deliberately exposes only the styled primitives
 * feature code should use, and adding an export to save twelve lines here would
 * widen that surface for every page.
 */
function Field({
  htmlFor,
  label,
  required,
  error,
  children,
}: {
  htmlFor: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium text-ai-fg-secondary">
        {label}
        {required ? (
          <span className="ml-0.5 text-ai-danger" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {children}
      {error ? (
        <p role="alert" className={cn('text-xs text-ai-danger')}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Where to go once the token is stored.
 *
 * The old console honoured `redirect` then `referer` (`safeReturnPath`) and used a
 * full document navigation for paths served by a different app. Everything this
 * app owns is a single-page route, so one `location.assign` is enough; the guard
 * against `//evil.com` matters because the query string is attacker-controlled.
 */
export function navigateAfterLogin(location: Location = window.location): void {
  const params = new URLSearchParams(location.search);
  const target = safeReturnPath(params.get('redirect')) ?? safeReturnPath(params.get('referer')) ?? '/';
  window.location.assign(target);
}

/**
 * Turn a login failure into a sentence.
 *
 * The BFF sends a stable `code` and ks-apiserver's English text. The code is
 * preferred because it is translated; the raw text is shown only for failures
 * this app has no phrase for, where hiding it would leave the reader with
 * "login failed" and no clue.
 */
function phraseLoginError(cause: unknown, t: ReturnType<typeof useT>): string {
  if (cause instanceof ApiError) {
    const code = isLoginErrorCode(cause.code) ? cause.code : undefined;
    if (code === 'invalid_credentials') return t('login.invalidCredentials');
    if (code === 'too_many_attempts') return t('login.tooManyAttempts');
    if (code === 'upstream_unreachable') return t('login.upstreamUnreachable');
    if (code === 'invalid_client') return t('login.invalidClient');
    return cause.message || t('login.failed');
  }
  return t('login.failed');
}
