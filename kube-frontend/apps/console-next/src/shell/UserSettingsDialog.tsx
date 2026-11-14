import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, passwordProblem, userDetailApi, userSettingsApi } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Button, Input, InputPassword, Modal, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { passwordProblemMessage } from '@/lib/password';
import { PasswordStrength } from '@/components/password/PasswordStrength';
import { useAuth } from '@/shell/AuthProvider';
import { errorMessage } from '@/components/resource/ResourceErrorPanel';

/**
 * 用户设置 — the signed-in account's own settings.
 *
 * The old console opened this as a modal from the account menu, with two tabs (基本信息 /
 * 密码设置) and a save bar per tab. It stays a modal: personal settings are a one-off task
 * ("change my email, get back to work"), not a place to navigate to, and the old muscle
 * memory is 头像 → 用户设置. Same reasoning as the cluster switcher — a list is a page, a
 * single action is a dialog.
 *
 * What it deliberately does **not** carry over:
 *
 * - **The language selector.** The old console wrote `spec.lang` and reloaded the page. This
 *   app keeps the language in `localStorage` and switches it from the header without a
 *   reload, so a second control here would be a second source of truth: pick 中文 here, the
 *   header still shows English until the next load.
 * - **No client-side-only "success".** A saved email is read back from the API, and a changed
 *   password ends the session — see `change`.
 */
export interface UserSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Called once a password change has succeeded, when the session must end.
   *
   * The caller owns the sign-out because it also owns the redirect: the shell already knows
   * how to leave (`signOut()` then `/login`), and a second copy of that sequence in a dialog
   * is how one of them ends up not clearing the token.
   */
  onSignedOut: () => void;
}

type Tab = 'profile' | 'password';

export function UserSettingsDialog({ open, onOpenChange, onSignedOut }: UserSettingsDialogProps): React.ReactElement {
  const t = useT();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const name = user?.name ?? '';

  const [tab, setTab] = React.useState<Tab>('profile');

  /*
   * Read the account from the API rather than from the session token.
   *
   * The token carries the account name and, sometimes, an email, but it is a snapshot from
   * sign-in time: it does not know about an edit made here a minute ago, and it has no
   * platform role at all. Filling the form from the token would show a stale address over a
   * real one — the same trap the user-edit dialog avoids.
   */
  const profile = useQuery({
    queryKey: ['user-settings', 'profile', name],
    queryFn: ({ signal }) => userDetailApi(apiClient).get({ name, signal }),
    enabled: open && name !== '',
  });

  const [email, setEmail] = React.useState('');
  const [emailTouched, setEmailTouched] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const loadedFor = React.useRef<string | null>(null);

  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [passwordDone, setPasswordDone] = React.useState(false);

  // A fresh dialog starts on 基本信息 with empty password fields. Re-opening it must not
  // show the previous attempt's typing, and it must not show a stale email either.
  React.useEffect(() => {
    if (!open) {
      loadedFor.current = null;
      return;
    }
    setTab('profile');
    setEmailTouched(false);
    setSaved(false);
    setFormError(null);
    setPasswordDone(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }, [open]);

  React.useEffect(() => {
    if (!open || !profile.data) return;
    if (loadedFor.current === name) return;
    loadedFor.current = name;
    setEmail(profile.data.email ?? '');
  }, [open, profile.data, name]);

  const saveProfile = useMutation({
    mutationFn: (next: string) => userSettingsApi(apiClient).updateProfile({ name, email: next }),
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['user-settings', 'profile', name] });
      // The platform's user list shows this address, so it is stale now too.
      void queryClient.invalidateQueries({ queryKey: ['platform', 'users'] });
      void queryClient.invalidateQueries({ queryKey: ['user-detail', name] });
    },
  });

  const change = useMutation({
    mutationFn: (input: { currentPassword: string; password: string }) =>
      userSettingsApi(apiClient).changePassword({ name, ...input }),
    onSuccess: () => {
      setPasswordDone(true);
      /*
       * The session survives a password change — verified against the cluster: the same token
       * still answers `/api/session/me` with 200 afterwards. So leaving the console is this
       * dialog's job, not the server's. Without the sign-out, "I changed my password" would
       * leave the old session usable, which is the opposite of what the reader asked for.
       */
      window.setTimeout(() => onSignedOut(), 1200);
    },
  });

  const emailProblem = (() => {
    const value = email.trim();
    if (value === '') return t('userSettings.profile.error.email');
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : t('userSettings.profile.error.email');
  })();

  const dirty = profile.data !== undefined && email.trim() !== (profile.data.email ?? '').trim();

  /*
   * The confirmation is compared **as it is typed**, not when the form is submitted.
   *
   * That is what the old console did: its `rePassword` field carried a validator rule, and
   * kube-design's `Form.Item` re-runs the field's rules on every (debounced) change. Waiting for
   * the save button means a reader only learns they mistyped after pressing it.
   *
   * Derived rather than stored, so editing the new password re-checks the confirmation too. The
   * old implementation only re-validated the field that changed, which left a stale "must match"
   * error behind after the new password was corrected.
   */
  const confirmFilled = confirmPassword !== '';
  const confirmMatches = confirmFilled && confirmPassword === newPassword;

  const submitProfile = (): void => {
    setEmailTouched(true);
    setSaved(false);
    if (emailProblem) return;
    saveProfile.mutate(email.trim());
  };

  const submitPassword = (): void => {
    setFormError(null);
    change.reset();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setFormError(t('userSettings.password.required'));
      return;
    }
    const problem = passwordProblemMessage(t, passwordProblem(newPassword));
    if (problem) {
      setFormError(problem);
      return;
    }
    if (newPassword !== confirmPassword) {
      // The hint under the confirmation field already says this, live; repeating it above the
      // buttons would show the same sentence twice.
      setFormError(null);
      return;
    }
    change.mutate({ currentPassword, password: newPassword });
  };

  const state = tab === 'profile' ? (profile.isPending ? 'loading' : profile.isError ? 'error' : 'ready') : 'ready';

  /*
   * A wrong current password is a **400 with a plain-text body** ("incorrect old password"),
   * and a password that breaks the platform rule is a 422 carrying the whole admission regex.
   * Neither belongs on screen, so both are phrased here; anything else falls back to the shared
   * error wording.
   */
  const serverError = change.error
    ? change.error instanceof ApiError && change.error.status === 400
      ? t('userSettings.password.error.current')
      : change.error instanceof ApiError && change.error.status === 422
        ? t('userSettings.password.rule')
        : errorMessage(t, change.error)
    : null;
  const passwordError = formError ?? serverError;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('userSettings.title')}
      description={t('userSettings.description')}
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} {...actionProps('user-settings:close')}>
            {t('common.close')}
          </Button>
        </div>
      }
    >
      <AiSurface aiId="user-settings:surface" state={state} className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center gap-1 border-b border-ai-line" role="tablist">
          <TabButton
            active={tab === 'profile'}
            aiId="user-settings:tab-profile"
            label={t('userSettings.tab.profile')}
            dirty={dirty}
            dirtyLabel={t('userSettings.tab.dirty')}
            onSelect={() => setTab('profile')}
          />
          <TabButton
            active={tab === 'password'}
            aiId="user-settings:tab-password"
            label={t('userSettings.tab.password')}
            onSelect={() => setTab('password')}
          />
        </div>

        {tab === 'profile' ? (
          profile.isPending ? (
            <Skeleton className="h-32 w-full" />
          ) : profile.isError ? (
            <div className="flex flex-col items-start gap-2 rounded-ai-md border border-ai-line p-4" role="alert">
              <p className="text-xs text-ai-fg-muted">{t('userSettings.profile.loadFailed')}</p>
              <p className="text-xs text-ai-danger">{errorMessage(t, profile.error)}</p>
              <Button size="sm" onClick={() => void profile.refetch()} {...actionProps('user-settings:retry')}>
                {t('common.retry')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              <ReadOnlyField aiId="user-settings:username" label={t('userSettings.username')} hint={t('userSettings.usernameHint')} value={profile.data?.username ?? name} />
              <ReadOnlyField
                aiId="user-settings:platform-role"
                label={t('userSettings.platformRole')}
                hint={t('userSettings.platformRoleHint')}
                value={profile.data?.platformRole ?? '-'}
              />
              <label className="flex flex-col gap-1" htmlFor="user-settings-email">
                <span className="text-xs text-ai-fg-muted">{t('userSettings.email')}</span>
                <Input
                  id="user-settings-email"
                  value={email}
                  placeholder="user@example.com"
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setSaved(false);
                  }}
                  {...actionProps('user-settings:email')}
                />
                <span className="text-[11px] text-ai-fg-muted">{t('userSettings.emailHint')}</span>
              </label>
              {emailTouched && emailProblem ? (
                <p className="text-xs text-ai-danger" role="alert" {...actionProps('user-settings:profile-error')}>
                  {emailProblem}
                </p>
              ) : null}
              {saveProfile.error ? (
                <p className="text-xs text-ai-danger" role="alert" {...actionProps('user-settings:profile-error')}>
                  {errorMessage(t, saveProfile.error)}
                </p>
              ) : null}
              <div className="flex items-center gap-2">
                <Button variant="primary" loading={saveProfile.isPending} onClick={submitProfile} {...actionProps('user-settings:profile-save')}>
                  {t('common.save')}
                </Button>
                {saved ? (
                  <span className="text-xs text-ai-success" role="status" {...actionProps('user-settings:profile-saved')}>
                    {t('userSettings.profile.saved')}
                  </span>
                ) : null}
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            <label className="flex flex-col gap-1" htmlFor="user-settings-current-password">
              <span className="text-xs text-ai-fg-muted">{t('userSettings.password.current')}</span>
              <InputPassword
                id="user-settings-current-password"
                autoComplete="current-password"
                value={currentPassword}
                disabled={passwordDone}
                onChange={(event) => setCurrentPassword(event.target.value)}
                {...actionProps('user-settings:current-password')}
              />
              <span className="text-[11px] text-ai-fg-muted">{t('userSettings.password.currentHint')}</span>
            </label>
            {/*
             * The rule, stated before the field rather than after a rejection — this is the old
             * console's PASSWORD_DESC, and unlike there it is now the rule the form actually
             * enforces (a special character is required here even though the apiserver does not
             * ask for one).
             */}
            <p className="rounded-ai-sm bg-ai-surface-2 px-3 py-2 text-[11px] leading-5 text-ai-fg-muted" {...actionProps('user-settings:password-rule')}>
              {t('userSettings.password.rule')}
            </p>
            <label className="flex flex-col gap-1" htmlFor="user-settings-new-password">
              <span className="text-xs text-ai-fg-muted">{t('userSettings.password.new')}</span>
              <InputPassword
                id="user-settings-new-password"
                autoComplete="new-password"
                value={newPassword}
                disabled={passwordDone}
                onChange={(event) => setNewPassword(event.target.value)}
                {...actionProps('user-settings:new-password')}
              />
            </label>
            <PasswordStrength password={newPassword} />
            <label className="flex flex-col gap-1" htmlFor="user-settings-confirm-password">
              <span className="text-xs text-ai-fg-muted">{t('userSettings.password.confirm')}</span>
              <InputPassword
                id="user-settings-confirm-password"
                autoComplete="new-password"
                value={confirmPassword}
                disabled={passwordDone}
                onChange={(event) => setConfirmPassword(event.target.value)}
                {...actionProps('user-settings:confirm-password')}
              />
              {confirmFilled ? (
                <span
                  className={confirmMatches ? 'text-[11px] text-ai-success' : 'text-[11px] text-ai-danger'}
                  role={confirmMatches ? 'status' : 'alert'}
                  data-match={confirmMatches ? 'true' : 'false'}
                  {...actionProps('user-settings:confirm-hint')}
                >
                  {confirmMatches ? t('userSettings.password.match') : t('userSettings.password.mismatch')}
                </span>
              ) : null}
            </label>
            {passwordError ? (
              <p className="text-xs text-ai-danger" role="alert" {...actionProps('user-settings:password-error')}>
                {passwordError}
              </p>
            ) : null}
            {passwordDone ? (
              <p className="text-xs text-ai-success" role="status" {...actionProps('user-settings:password-saved')}>
                {t('userSettings.password.success')}
              </p>
            ) : null}
            <div className="flex items-center gap-2">
              <Button variant="primary" loading={change.isPending} disabled={passwordDone} onClick={submitPassword} {...actionProps('user-settings:password-save')}>
                {t('userSettings.password.save')}
              </Button>
            </div>
          </div>
        )}
      </AiSurface>
    </Modal>
  );
}

/**
 * One read-only value, shown as text rather than a disabled input.
 *
 * A disabled input invites a click that can never work; plain text with a hint says the same
 * thing without promising an interaction.
 */
function ReadOnlyField({ aiId, label, hint, value }: { aiId: string; label: string; hint: string; value: string }): React.ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-ai-fg-muted">{label}</span>
      <span className="text-sm text-ai-fg" {...actionProps(aiId)}>
        {value}
      </span>
      <span className="text-[11px] text-ai-fg-muted">{hint}</span>
    </div>
  );
}

/**
 * One tab.
 *
 * The dot marks unsaved edits, as the old console did with a tooltip on the tab: a reader who
 * typed an email and switched to 密码设置 must be able to see that the address is still unsaved.
 */
function TabButton({
  active,
  aiId,
  label,
  dirty = false,
  dirtyLabel,
  onSelect,
}: {
  active: boolean;
  aiId: string;
  label: string;
  dirty?: boolean;
  dirtyLabel?: string;
  onSelect: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={[
        'relative inline-flex items-center gap-1.5 rounded-t-ai-sm px-3 py-2 text-xs transition-colors duration-ai-fast',
        active ? 'border-b-2 border-ai-accent text-ai-fg' : 'border-b-2 border-transparent text-ai-fg-muted hover:text-ai-fg',
      ].join(' ')}
      onClick={onSelect}
      {...actionProps(aiId)}
    >
      {label}
      {dirty ? <span className="size-1.5 rounded-full bg-ai-warning" title={dirtyLabel} aria-label={dirtyLabel} /> : null}
    </button>
  );
}
