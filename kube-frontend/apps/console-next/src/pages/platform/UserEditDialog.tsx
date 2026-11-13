import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { userDetailApi } from '@kube-ai-hub/api-client';
import { Input, Modal, Skeleton, Textarea } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';

/**
 * 编辑用户信息.
 *
 * Only the two fields the console owns: email (a spec field) and description (an annotation).
 * The dialog reads the user first because the list row carries neither the description nor an
 * authoritative email — filling the form from the row would show blanks over real values.
 */
export interface UserEditDialogProps {
  name: string;
  pending: boolean;
  error?: unknown;
  onCancel: () => void;
  onSubmit: (values: { email: string; description: string }) => void;
}

export function UserEditDialog({ name, pending, error, onCancel, onSubmit }: UserEditDialogProps): React.ReactElement {
  const t = useT();
  const query = useQuery({
    queryKey: ['user-detail', name],
    queryFn: ({ signal }) => userDetailApi(apiClient).get({ name, signal }),
  });

  const [email, setEmail] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [touched, setTouched] = React.useState(false);
  const loaded = React.useRef(false);

  React.useEffect(() => {
    if (!query.data || loaded.current) return;
    loaded.current = true;
    setEmail(query.data.email ?? '');
    setDescription(query.data.description ?? '');
  }, [query.data]);

  const emailProblem = email.trim() === '' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <Modal
      open
      onOpenChange={(next) => !next && onCancel()}
      title={t('platform.user.editTitle')}
      description={t('platform.user.editDescription')}
      footer={
        <React.Fragment>
          <button
            type="button"
            className="rounded-ai-md border border-ai-line px-3 py-1.5 text-sm hover:bg-ai-surface-2"
            data-ai-id="users:edit-cancel"
            onClick={onCancel}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="rounded-ai-md bg-ai-accent px-3 py-1.5 text-sm text-white disabled:opacity-50"
            data-ai-id="users:edit-submit"
            disabled={pending || !query.data}
            onClick={() => {
              setTouched(true);
              if (emailProblem) return;
              onSubmit({ email: email.trim(), description: description.trim() });
            }}
          >
            {t('common.save')}
          </button>
        </React.Fragment>
      }
    >
      {query.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ai-fg-muted">{t('platform.user.email')}</span>
            <Input id="users:edit-email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ai-fg-muted">{t('platform.user.description')}</span>
            <Textarea id="users:edit-description" value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          {touched && emailProblem ? (
            <p className="text-xs text-ai-danger" data-ai-id="users:edit-error">
              {t('platform.user.error.email')}
            </p>
          ) : null}
          {error ? (
            <p className="text-xs text-ai-danger">{String((error as Error)?.message ?? error)}</p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}