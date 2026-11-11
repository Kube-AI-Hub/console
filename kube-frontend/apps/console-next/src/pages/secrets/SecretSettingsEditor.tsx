import * as React from 'react';
import { AiSurface, Button, Icon, Input, InputPassword, Select, Textarea } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { DEFAULT_REGISTRY_ANNOTATION, FORCE_INSECURE_ANNOTATION, secretKeyProblem } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import { safeAtob, safeBtoa } from '@/lib/base64';
import { buildDockerConfig, isInsecureRegistry, parseDockerConfig } from '@/lib/dockerconfig';
import { REQUIRED_KEYS, SECRET_TYPE_LABEL } from './secretTypes';

/**
 * Type-specific settings editor, matching the old console's `SecretSettings`.
 *
 * The old dialog picks an editor from `type` and swaps it wholesale when the type
 * changes, clearing `data` with it. That is kept — the four payloads are not
 * interchangeable (a TLS Secret has no free-form keys) — but the clearing is
 * explained in the UI rather than done silently, because losing a pasted
 * certificate by touching a select is exactly the sort of thing that makes people
 * distrust a form.
 *
 * Values are always edited as **text** and converted at this boundary: `data`
 * holds base64, the fields hold what the person typed.
 */

export interface SecretSettingsValue {
  type: string;
  /** Base64 values, as stored. */
  data: Record<string, string>;
  /** Extra annotations this editor owns (`force-insecure`), merged into the object. */
  annotations: Record<string, string>;
  /** `secret.kubesphere.io/is-default-class` is `true`. */
  isDefault: boolean;
}

export interface SecretSettingsEditorProps {
  value: SecretSettingsValue;
  onChange: (next: SecretSettingsValue) => void;
  /**
   * Edit mode: the type may not change. The old console disables the select for
   * `secret.edit`, because kube-apiserver validates `data` against the type and a
   * type change would usually be rejected after the reader has already typed new
   * values.
   */
  lockType?: boolean;
  /**
   * The reader is editing one key/value pair inside the generic editor. The host
   * disables its submit while true, since a half-typed pair is not in `data` yet.
   */
  onEditingChange?: (editing: boolean) => void;
  /** Prefix for agent handles, e.g. `secrets`. */
  resource: string;
  /** Shown under the type select; empty when the type is locked. */
  typeHint?: string;
}

/** A text field bound to one base64 entry of `data`. */
function DataTextField({
  label,
  hint,
  value,
  onChange,
  textareaRows,
  password,
  aiId,
  required,
  error,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (text: string) => void;
  textareaRows?: number;
  password?: boolean;
  aiId: string;
  required?: boolean;
  error?: string;
}): React.ReactElement {
  const text = safeAtob(value);
  const set = (next: string): void => onChange(next ? safeBtoa(next) : '');
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-ai-fg-secondary">
        {label}
        {required ? <span className="ml-0.5 text-ai-danger">*</span> : null}
      </span>
      {hint ? <span className="text-[11px] text-ai-fg-muted">{hint}</span> : null}
      {password ? (
        <InputPassword value={text} autoComplete="new-password" {...actionProps(aiId)} onChange={(event) => set(event.target.value)} />
      ) : textareaRows ? (
        <Textarea value={text} rows={textareaRows} {...actionProps(aiId)} onChange={(event) => set(event.target.value)} />
      ) : (
        <Input value={text} autoComplete="off" {...actionProps(aiId)} onChange={(event) => set(event.target.value)} />
      )}
      {error ? (
        <span role="alert" className="text-[11px] text-ai-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function SecretSettingsEditor({
  value,
  onChange,
  lockType = false,
  onEditingChange,
  resource,
  typeHint,
}: SecretSettingsEditorProps): React.ReactElement {
  const t = useT();
  const { type, data, annotations, isDefault } = value;

  const setData = (next: Record<string, string>): void => onChange({ ...value, data: next });
  const setOne = (key: string, next: string): void => setData({ ...data, [key]: next });

  /**
   * Changing type starts `data` over.
   *
   * Only for the four known types: an unknown type read from an existing object
   * keeps its payload, since this dialog cannot author a new one for it.
   */
  const changeType = (next: string): void => {
    const known = REQUIRED_KEYS[next] !== undefined;
    onChange({ ...value, type: next, data: known ? {} : data });
  };

  /** Required-field errors, shown under each field and blocking submit. */
  const missing = (key: string): boolean => {
    const required = (REQUIRED_KEYS[type] ?? []).includes(key);
    return required && !data[key];
  };

  const typeOptions = Object.entries(SECRET_TYPE_LABEL)
    .filter(([stored]) => stored !== 'kubernetes.io/service-account-token')
    .map(([stored, labelKey]) => ({ value: stored, label: t(labelKey as Parameters<typeof t>[0]) }));

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-ai-fg-secondary">{t('secrets.field.type')}</span>
        {typeHint && !lockType ? <span className="text-[11px] text-ai-fg-muted">{typeHint}</span> : null}
        <AiSurface as="div" aiId={`${resource}:field-type`} state="ready" className="contents">
          <Select
            value={type}
            options={typeOptions}
            disabled={lockType}
            aria-label={t('secrets.field.type')}
            onValueChange={changeType}
          />
        </AiSurface>
        {/* An object whose type is outside the four keeps its payload visible. */}
        {!Object.keys(REQUIRED_KEYS).includes(type) ? (
          <span className="text-[11px] text-ai-fg-muted">{t('secrets.edit.unknownType', { type })}</span>
        ) : null}
      </label>

      {type === 'kubernetes.io/tls' ? (
        <div className="flex flex-col gap-3">
          <DataTextField
            label={t('secrets.field.certificate')}
            hint={t('secrets.field.certificateHint')}
            required
            textareaRows={6}
            value={data['tls.crt'] ?? ''}
            onChange={(next) => setOne('tls.crt', next)}
            aiId={`${resource}:field-tls-crt`}
            {...(missing('tls.crt') ? { error: t('secrets.validate.requiredField') } : {})}
          />
          <DataTextField
            label={t('secrets.field.privateKey')}
            hint={t('secrets.field.privateKeyHint')}
            required
            textareaRows={6}
            value={data['tls.key'] ?? ''}
            onChange={(next) => setOne('tls.key', next)}
            aiId={`${resource}:field-tls-key`}
            {...(missing('tls.key') ? { error: t('secrets.validate.requiredField') } : {})}
          />
        </div>
      ) : type === 'kubernetes.io/basic-auth' ? (
        <div className="flex flex-col gap-3">
          <DataTextField
            label={t('secrets.field.username')}
            required
            value={data['username'] ?? ''}
            onChange={(next) => setOne('username', next)}
            aiId={`${resource}:field-username`}
            {...(missing('username') ? { error: t('secrets.validate.requiredField') } : {})}
          />
          <DataTextField
            label={t('secrets.field.password')}
            required
            password
            value={data['password'] ?? ''}
            onChange={(next) => setOne('password', next)}
            aiId={`${resource}:field-password`}
            {...(missing('password') ? { error: t('secrets.validate.requiredField') } : {})}
          />
        </div>
      ) : type === 'kubernetes.io/dockerconfigjson' ? (
        <ImageRegistryEditor
          resource={resource}
          value={data['.dockerconfigjson'] ?? ''}
          onChange={(next) => {
            const nextAnnotations = { ...annotations };
            // Address and annotation must agree; the old console derives one from
            // the other on every change (`handleAnnotationsByUrl`).
            const parsed = parseDockerConfig(safeAtob(next));
            const url = Object.keys(parsed.auths ?? {})[0] ?? '';
            if (isInsecureRegistry(url)) nextAnnotations[FORCE_INSECURE_ANNOTATION] = 'true';
            else delete nextAnnotations[FORCE_INSECURE_ANNOTATION];
            onChange({ ...value, data: { ...data, '.dockerconfigjson': next }, annotations: nextAnnotations });
          }}
          isDefault={isDefault}
          onDefaultChange={(next) => {
            const nextAnnotations = { ...annotations };
            nextAnnotations[DEFAULT_REGISTRY_ANNOTATION] = next ? 'true' : 'false';
            onChange({ ...value, isDefault: next, annotations: nextAnnotations });
          }}
        />
      ) : (
        <KeyValueEditor
          value={data}
          onChange={setData}
          resource={resource}
          {...(onEditingChange ? { onEditingChange } : {})}
        />
      )}
    </div>
  );
}

/* ---------------- Generic key/value editor (Opaque) ---------------- */

function KeyValueEditor({
  value,
  onChange,
  onEditingChange,
  resource,
}: {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  onEditingChange?: (editing: boolean) => void;
  resource: string;
}): React.ReactElement {
  const t = useT();
  const [editing, setEditing] = React.useState<{ originalKey: string; key: string; value: string; error: string | null } | null>(
    null,
  );
  const entries = React.useMemo(() => Object.entries(value), [value]);

  React.useEffect(() => {
    onEditingChange?.(editing !== null);
  }, [editing, onEditingChange]);

  const commit = (): void => {
    if (!editing) return;
    const key = editing.key.trim();
    const problem = secretKeyProblem(key);
    if (problem === 'required') return setEditing({ ...editing, error: t('secrets.validate.keyRequired') });
    if (problem === 'pattern') return setEditing({ ...editing, error: t('secrets.validate.keyPattern') });
    // A key renamed onto an existing one would silently drop the other entry;
    // the old console accepted it and lost data.
    if (entries.some(([existing]) => existing === key && existing !== editing.originalKey)) {
      return setEditing({ ...editing, error: t('secrets.validate.keyDuplicate', { key }) });
    }
    const next = { ...value };
    if (editing.originalKey) delete next[editing.originalKey];
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
      {entries.length === 0 ? (
        <p className="rounded-ai-md border border-dashed border-ai-line px-3 py-6 text-center text-xs text-ai-fg-muted">
          {t('secrets.data.empty')}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-ai-line rounded-ai-md border border-ai-line">
          {entries.map(([key, stored]) => (
            <li key={key} className="flex items-start gap-3 px-3 py-2" data-ai-row={key}>
              <Icon name="key" size={14} className="mt-0.5 shrink-0 text-ai-fg-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-ai-fg">{key}</p>
                {/* Masks by default, like the old `DataList` renders real values —
                    but this is a dialog opened deliberately to edit, so showing
                    "••••" would make editing impossible; the detail page owns the
                    masking toggle. */}
                <p className="truncate text-[11px] text-ai-fg-muted">{safeAtob(stored) || '-'}</p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('secrets.data.editTitle')}
                  {...actionProps(`${resource}:data-edit:${key}`)}
                  onClick={() => setEditing({ originalKey: key, key, value: stored, error: null })}
                >
                  <Icon name="pen" size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('common.delete')}
                  {...actionProps(`${resource}:data-remove:${key}`)}
                  onClick={() => remove(key)}
                >
                  <Icon name="trash" size={14} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <div className="flex flex-col gap-3 rounded-ai-md border border-ai-line bg-ai-surface-1/40 p-3">
          <p className="text-xs font-medium text-ai-fg">
            {editing.originalKey ? t('secrets.data.editTitle') : t('secrets.data.addTitle')}
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ai-fg-secondary">{t('secrets.field.dataKey')}</span>
            <Input
              value={editing.key}
              autoFocus
              aria-label={t('secrets.field.dataKey')}
              {...actionProps(`${resource}:data-key`)}
              onChange={(event) => setEditing({ ...editing, key: event.target.value, error: null })}
            />
            <span className="text-[11px] text-ai-fg-muted">{t('secrets.data.keyHint')}</span>
            {editing.error ? (
              <span role="alert" className="text-[11px] text-ai-danger">
                {editing.error}
              </span>
            ) : null}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ai-fg-secondary">{t('secrets.field.dataValue')}</span>
            <Textarea
              value={safeAtob(editing.value)}
              rows={4}
              aria-label={t('secrets.field.dataValue')}
              {...actionProps(`${resource}:data-value`)}
              onChange={(event) =>
                setEditing({
                  ...editing,
                  value: event.target.value ? safeBtoa(event.target.value) : '',
                  error: null,
                })
              }
            />
            <span className="text-[11px] text-ai-fg-muted">{t('secrets.data.valueHint')}</span>
            {/* The old console refuses Chinese in a value (`dataValidator`); a Secret
                is binary-safe, so this only informs: the value is UTF-8 encoded. */}
            {/\p{Script=Han}/u.test(safeAtob(editing.value)) ? (
              <span className="text-[11px] text-ai-fg-muted">{t('secrets.data.chineseHint')}</span>
            ) : null}
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" {...actionProps(`${resource}:data-save`)} onClick={commit}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          {...actionProps(`${resource}:data-add`)}
          onClick={() => setEditing({ originalKey: '', key: '', value: '', error: null })}
        >
          <Icon name="add" size={14} />
          {t('secrets.data.add')}
        </Button>
      )}
    </div>
  );
}

/* ---------------- Image registry editor ---------------- */

function ImageRegistryEditor({
  value,
  onChange,
  isDefault,
  onDefaultChange,
  resource,
}: {
  value: string;
  onChange: (next: string) => void;
  isDefault: boolean;
  onDefaultChange: (next: boolean) => void;
  resource: string;
}): React.ReactElement {
  const t = useT();
  const parsed = React.useMemo(() => parseDockerConfig(safeAtob(value)), [value]);
  const [url = '', entry = {}] = Object.entries(parsed.auths ?? {})[0] ?? [];

  const update = (patch: Partial<{ url: string; username: string; password: string; email: string }>): void => {
    const next = {
      url: patch.url ?? url,
      username: patch.username ?? entry.username ?? '',
      password: patch.password ?? entry.password ?? '',
      email: patch.email ?? entry.email ?? '',
    };
    // Every keystroke rewrites a single-entry document, like the old console.
    // Writing `{}` for a blank address keeps `data['.dockerconfigjson']` present
    // but empty, which the required check below reports.
    if (!next.url && !next.username && !next.password && !next.email) {
      onChange('');
      return;
    }
    onChange(safeBtoa(buildDockerConfig({ ...next, url: next.url || '-' }, safeBtoa)));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ai-fg-secondary">
            {t('secrets.field.registryAddress')}
            <span className="ml-0.5 text-ai-danger">*</span>
          </span>
          <span className="text-[11px] text-ai-fg-muted">{t('secrets.field.registryAddressHint')}</span>
          <Input
            value={url}
            placeholder="https://hub.docker.com"
            autoComplete="off"
            {...actionProps(`${resource}:field-registry-url`)}
            onChange={(event) => update({ url: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ai-fg-secondary">
            {t('secrets.field.username')}
            <span className="ml-0.5 text-ai-danger">*</span>
          </span>
          <Input
            value={entry.username ?? ''}
            autoComplete="off"
            {...actionProps(`${resource}:field-registry-username`)}
            onChange={(event) => update({ username: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ai-fg-secondary">{t('secrets.field.email')}</span>
          <Input
            value={entry.email ?? ''}
            autoComplete="off"
            {...actionProps(`${resource}:field-registry-email`)}
            onChange={(event) => update({ email: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ai-fg-secondary">
            {t('secrets.field.password')}
            <span className="ml-0.5 text-ai-danger">*</span>
          </span>
          <InputPassword
            value={entry.password ?? ''}
            autoComplete="new-password"
            {...actionProps(`${resource}:field-registry-password`)}
            onChange={(event) => update({ password: event.target.value })}
          />
        </label>
      </div>

      {!value ? (
        <p role="alert" className="text-[11px] text-ai-danger">
          {t('secrets.validate.registryRequired')}
        </p>
      ) : null}

      {/*
       * A checkbox in a label rather than a switch: `@kube-ai-hub/ui` deliberately
       * does not re-export a bare toggle, and "make this the default" is a setting
       * whose state the reader should be able to read as text (`aria-pressed`),
       * not infer from a thumb position.
       */}
      <label className="flex items-start gap-2 rounded-ai-md border border-ai-line px-3 py-2">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-ai-accent"
          checked={isDefault}
          {...actionProps(`${resource}:field-default-registry`)}
          onChange={(event) => onDefaultChange(event.target.checked)}
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-xs text-ai-fg-secondary">{t('secrets.field.defaultRegistry')}</span>
          <span className="text-[11px] text-ai-fg-muted">{t('secrets.field.defaultRegistryHint')}</span>
        </span>
      </label>

      <p className="rounded-ai-md border border-ai-line px-3 py-2 text-[11px] text-ai-fg-muted">
        {t('secrets.registry.tip')}
      </p>
    </div>
  );
}
