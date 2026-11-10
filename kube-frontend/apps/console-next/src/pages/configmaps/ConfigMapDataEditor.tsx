import * as React from 'react';
import { Button, Icon, Input, Textarea, cn } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { useT } from '@/i18n';

/**
 * Key/value editor matching the old console's `ConfigMapSettings`.
 *
 * The old dialog is a list of pairs plus one inline sub-form: adding and editing
 * both happen in place, and the surrounding modal disables its submit button while
 * the sub-form is open. That shape is kept because it is what people have learned —
 * an inline row-editable grid would be fewer clicks but a different mental model,
 * and this page is a port, not a redesign.
 */

export interface DataPair {
  key: string;
  value: string;
}

export interface ConfigMapDataEditorProps {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  disabled?: boolean;
  /**
   * Reports whether an inline sub-form is open. The host disables submit while it
   * is, since a half-typed pair is not part of the object yet.
   */
  onEditingChange?: (editing: boolean) => void;
}

/** Which pair the sub-form is editing; `index: -1` means a new pair. */
interface Editing {
  index: number;
  originalKey: string;
  key: string;
  value: string;
  error: string | null;
}

export function ConfigMapDataEditor({
  value,
  onChange,
  disabled = false,
  onEditingChange,
}: ConfigMapDataEditorProps): React.ReactElement {
  const t = useT();
  const [editing, setEditing] = React.useState<Editing | null>(null);
  const pairs = React.useMemo(() => Object.entries(value).map(([key, val]) => ({ key, value: val })), [value]);

  React.useEffect(() => {
    onEditingChange?.(editing !== null);
  }, [editing, onEditingChange]);

  const openAdd = (): void => setEditing({ index: -1, originalKey: '', key: '', value: '', error: null });
  const openEdit = (pair: DataPair, index: number): void =>
    setEditing({ index, originalKey: pair.key, key: pair.key, value: pair.value, error: null });
  const cancel = (): void => setEditing(null);

  const commit = (): void => {
    if (!editing) return;
    const key = editing.key.trim();
    if (!key) return setEditing({ ...editing, error: t('configmaps.validate.keyRequired') });
    // ConfigMap keys may be filenames (`app.yaml`), so a dot is legal — rejecting
    // it would make existing objects uneditable. A slash is not: the API validates
    // keys as path segments and rejects anything that would form a subpath.
    if (key.includes('/')) {
      return setEditing({ ...editing, error: t('configmaps.validate.keyPattern') });
    }
    // A key renamed onto an existing one would silently drop the other pair; the
    // old console accepted it and lost data, which is worth fixing here.
    const clashes = pairs.some((pair, index) => pair.key === key && index !== editing.index);
    if (clashes) return setEditing({ ...editing, error: t('configmaps.validate.keyDuplicate', { key }) });

    const next: Record<string, string> = {};
    for (const [existingKey, existingValue] of Object.entries(value)) {
      if (editing.index >= 0 && existingKey === editing.originalKey) continue;
      next[existingKey] = existingValue;
    }
    next[key] = editing.value;
    onChange(next);
    setEditing(null);
  };

  const remove = (key: string): void => {
    const next = { ...value };
    delete next[key];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      {pairs.length === 0 ? (
        <p className="rounded-ai-md border border-dashed border-ai-line px-3 py-6 text-center text-xs text-ai-fg-muted">
          {t('configmaps.data.empty')}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-ai-line rounded-ai-md border border-ai-line">
          {pairs.map((pair, index) => (
            <li key={pair.key} className="flex items-start gap-3 px-3 py-2">
              <Icon name="meta-data" size={14} className="mt-0.5 shrink-0 text-ai-fg-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-ai-fg">{pair.key}</p>
                <p className="truncate text-[11px] text-ai-fg-muted">{pair.value || '-'}</p>
              </div>
              {disabled ? null : (
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('configmaps.data.editTitle')}
                    {...actionProps(`configmaps:data-edit:${pair.key}`)}
                    onClick={() => openEdit(pair, index)}
                  >
                    <Icon name="pen" size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('common.delete')}
                    {...actionProps(`configmaps:data-remove:${pair.key}`)}
                    onClick={() => remove(pair.key)}
                  >
                    <Icon name="trash" size={14} />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <div className="flex flex-col gap-3 rounded-ai-md border border-ai-line bg-ai-surface-1/40 p-3">
          <p className="text-xs font-medium text-ai-fg">
            {editing.index >= 0 ? t('configmaps.data.editTitle') : t('configmaps.data.addTitle')}
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ai-fg-secondary">{t('configmaps.field.dataKey')}</span>
            <Input
              value={editing.key}
              autoFocus
              aria-label={t('configmaps.field.dataKey')}
              {...actionProps('configmaps:data-key')}
              onChange={(event) => setEditing({ ...editing, key: event.target.value, error: null })}
            />
            <span className="text-[11px] text-ai-fg-muted">{t('configmaps.data.keyHint')}</span>
            {editing.error ? (
              <span role="alert" className="text-[11px] text-ai-danger">
                {editing.error}
              </span>
            ) : null}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ai-fg-secondary">{t('configmaps.field.dataValue')}</span>
            <Textarea
              value={editing.value}
              rows={4}
              aria-label={t('configmaps.field.dataValue')}
              {...actionProps('configmaps:data-value')}
              onChange={(event) => setEditing({ ...editing, value: event.target.value })}
            />
            <span className="text-[11px] text-ai-fg-muted">{t('configmaps.data.valueHint')}</span>
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={cancel}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" {...actionProps('configmaps:data-save')} onClick={commit}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className={cn('self-start')}
          disabled={disabled}
          {...actionProps('configmaps:data-add')}
          onClick={openAdd}
        >
          <Icon name="add" size={14} />
          {t('configmaps.data.add')}
        </Button>
      )}
    </div>
  );
}
