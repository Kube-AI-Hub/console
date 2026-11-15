import * as React from 'react';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { Button, Input, Modal, Textarea } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';

/**
 * 创建 / 编辑仪表板信息.
 *
 * The old console creates a dashboard from its base-info form and later edits the same two
 * fields through 「编辑信息」. Both write `spec.title` and `spec.description` — not the alias
 * annotations the shared EditInfoDialog handles — so this dialog exists separately rather than
 * bending that one.
 *
 * Panels are deliberately absent: the panel editor is not migrated, and a dialog that offered
 * half of it would suggest the other half exists. A new dashboard starts with no panels and is
 * filled through the YAML editor, which is stated in the dialog.
 */
export interface DashboardInfoValues {
  name: string;
  title: string;
  description: string;
  editable: boolean;
}

export interface DashboardInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `create` asks for a name; `edit` locks it. */
  mode: 'create' | 'edit';
  initial?: Partial<DashboardInfoValues>;
  pending?: boolean;
  onSubmit: (values: DashboardInfoValues) => void | Promise<void>;
}

/** Dashboard names become object names, so they follow the DNS-1123 label rules. */
const NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
const NAME_MAX = 63;

function slugOf(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, NAME_MAX);
}

export function DashboardInfoDialog({
  open,
  onOpenChange,
  mode,
  initial,
  pending = false,
  onSubmit,
}: DashboardInfoDialogProps): React.ReactElement {
  const t = useT();
  const [name, setName] = React.useState(initial?.name ?? '');
  const [title, setTitle] = React.useState(initial?.title ?? '');
  const [description, setDescription] = React.useState(initial?.description ?? '');
  const [editable, setEditable] = React.useState(initial?.editable ?? true);
  const [touched, setTouched] = React.useState(false);
  const [errors, setErrors] = React.useState<{ name?: string; title?: string }>({});

  React.useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setTitle(initial?.title ?? '');
    setDescription(initial?.description ?? '');
    setEditable(initial?.editable ?? true);
    setTouched(false);
    setErrors({});
  }, [open, initial?.name, initial?.title, initial?.description, initial?.editable]);

  /*
   * The name follows the title until the reader types one. Deriving it lazily keeps the common
   * case one field shorter without ever overwriting a deliberate name.
   */
  const effectiveName = mode === 'edit' ? (initial?.name ?? '') : touched ? name : name || slugOf(title);

  const submit = (): void => {
    const next: typeof errors = {};
    const trimmedTitle = title.trim();
    const candidate = effectiveName.trim();
    if (!trimmedTitle) next.title = t('customMonitoring.error.titleRequired');
    if (mode === 'create') {
      if (!candidate) next.name = t('customMonitoring.error.nameRequired');
      else if (!NAME_PATTERN.test(candidate) || candidate.length > NAME_MAX) {
        next.name = t('customMonitoring.error.nameFormat');
      }
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    void onSubmit({ name: candidate, title: trimmedTitle, description: description.trim(), editable });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={mode === 'create' ? t('customMonitoring.createTitle') : t('customMonitoring.editTitle')}
      footer={
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" {...actionProps('dashboard-info:cancel')} onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" disabled={pending} {...actionProps('dashboard-info:submit')} onClick={submit}>
            {t('common.confirm')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3" data-ai-id="dashboard-info:surface">
        <label className="flex flex-col gap-1 text-xs text-ai-fg-muted">
          <span>{t('customMonitoring.field.title')}</span>
          <Input
            id="dashboard-info:title"
            {...actionProps('dashboard-info:title')}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          {errors.title ? <span className="text-ai-danger">{errors.title}</span> : null}
        </label>

        <label className="flex flex-col gap-1 text-xs text-ai-fg-muted">
          <span>{t('customMonitoring.field.name')}</span>
          <Input
            id="dashboard-info:name"
            {...actionProps('dashboard-info:name')}
            value={effectiveName}
            disabled={mode === 'edit'}
            onChange={(event) => {
              setTouched(true);
              setName(event.target.value);
            }}
          />
          <span className="text-[11px] text-ai-fg-muted">{t('customMonitoring.field.nameHint')}</span>
          {errors.name ? <span className="text-ai-danger">{errors.name}</span> : null}
        </label>

        <label className="flex flex-col gap-1 text-xs text-ai-fg-muted">
          <span>{t('customMonitoring.field.description')}</span>
          <Textarea
            id="dashboard-info:description"
            {...actionProps('dashboard-info:description')}
            value={description}
            rows={3}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <label className="flex items-center gap-2 text-xs text-ai-fg-muted">
          <input
            type="checkbox"
            className="size-4 rounded border-ai-line"
            {...actionProps('dashboard-info:editable')}
            checked={editable}
            onChange={(event) => setEditable(event.target.checked)}
          />
          <span>{t('customMonitoring.field.editable')}</span>
        </label>

        <p className="text-[11px] text-ai-fg-muted" data-ai-id="dashboard-info:panels-note">
          {t('customMonitoring.createPanelsNote')}
        </p>
      </div>
    </Modal>
  );
}
