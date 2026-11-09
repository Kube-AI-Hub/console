import * as React from 'react';
import { cn } from '../utils/cn';
import { Button } from '../primitives/Button';
import { Input, Textarea } from '../primitives/Input';
import { Select } from '../primitives/Select';
import { Checkbox, RadioGroup, Slider, Switch } from '../primitives/Toggles';
import { InputNumber } from '../primitives/InputNumber';
import { DatePicker } from '../primitives/DatePicker';
import { FormField } from '../primitives/FormField';
import { Tag } from '../primitives/Display';
import { getByPath, getFieldRenderer, setByPath } from './registry';

/* ---------------- Types ---------------- */

export interface FieldRule {
  /** Return an error message, or `null` when the value is valid. */
  validate?: (value: unknown, values: Record<string, unknown>) => string | null;
}

export interface FormFieldSchema {
  key: string;
  label: React.ReactNode;
  /** Built-in type; registered types take precedence when not built in. */
  type:
    | 'text'
    | 'password'
    | 'textarea'
    | 'number'
    | 'select'
    | 'radio'
    | 'checkbox'
    | 'switch'
    | 'slider'
    | 'date'
    | 'tags'
    | 'key-value'
    | string;
  required?: boolean;
  placeholder?: string;
  hint?: React.ReactNode;
  disabled?: boolean;
  /** Span the full row of a multi-column layout. */
  wide?: boolean;
  /** Only render when this returns true. */
  visible?: (values: Record<string, unknown>) => boolean;
  options?: Array<{ value: string; label: string; disabled?: boolean }>;
  /** Numeric bounds for `number` / `slider`. */
  min?: number;
  max?: number;
  step?: number;
  rules?: FieldRule[];
}

/**
 * Field list plus layout.
 *
 * Not generic over the value shape: the schema is data, and every consumer
 * reads it through `Record<string, unknown>` paths. Typing it per form would
 * force casts at each `getByPath` without adding safety.
 */
export interface FormSchema {
  fields: FormFieldSchema[];
  layout?: { columns?: 1 | 2 | 3 };
  submit?: { label?: string; cancelLabel?: string };
}

export interface ResourceFormProps<TValues extends Record<string, unknown>> {
  schema: FormSchema;
  /** Controlled values; omit for uncontrolled internal state. */
  values?: TValues;
  defaultValues?: TValues;
  onChange?: (values: TValues) => void;
  onSubmit: (values: TValues) => void | Promise<void>;
  onCancel?: () => void;
  submitting?: boolean;
  className?: string;
}

/* ---------------- Validation ---------------- */

export function validateField(
  field: FormFieldSchema,
  values: Record<string, unknown>,
): string | null {
  const value = getByPath(values, field.key);

  if (field.required) {
    const empty =
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0);
    if (empty) return `${typeof field.label === 'string' ? field.label : field.key} 不能为空`;
  }

  for (const rule of field.rules ?? []) {
    const message = rule.validate?.(value, values);
    if (message) return message;
  }

  return null;
}

export function validateForm(
  schema: Pick<FormSchema, 'fields'>,
  values: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of schema.fields) {
    if (field.visible && !field.visible(values)) continue;
    const message = validateField(field, values);
    if (message) errors[field.key] = message;
  }
  return errors;
}

/* ---------------- Field control ---------------- */

interface FieldControlProps {
  field: FormFieldSchema;
  id: string;
  value: unknown;
  values: Record<string, unknown>;
  invalid: boolean;
  onChange: (next: unknown) => void;
}

function FieldControl({ field, id, value, values, invalid, onChange }: FieldControlProps): React.ReactElement {
  const custom = getFieldRenderer(field.type);
  if (custom) {
    return (custom as unknown as (context: unknown) => React.ReactElement)({
      value,
      onChange,
      id,
      invalid,
      disabled: field.disabled ?? false,
      placeholder: field.placeholder,
    });
  }

  switch (field.type) {
    case 'password':
      return (
        <Input id={id} type="password" aria-invalid={invalid} disabled={field.disabled} placeholder={field.placeholder}
          value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} />
      );
    case 'textarea':
      return (
        <Textarea id={id} aria-invalid={invalid} disabled={field.disabled} placeholder={field.placeholder}
          value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} />
      );
    case 'number':
      return (
        <InputNumber id={id} aria-invalid={invalid} disabled={field.disabled} placeholder={field.placeholder}
          value={typeof value === 'number' ? value : null} min={field.min} max={field.max} step={field.step}
          onChange={onChange} />
      );
    case 'select':
      return (
        <Select id={id} aria-invalid={invalid} disabled={field.disabled} placeholder={field.placeholder}
          options={field.options ?? []} value={value === undefined || value === null ? undefined : String(value)}
          onValueChange={onChange} />
      );
    case 'radio':
      return (
        <RadioGroup options={field.options ?? []} value={String(value ?? '')} disabled={field.disabled}
          onValueChange={onChange} />
      );
    case 'checkbox':
      return (
        <Checkbox id={id} checked={Boolean(value)} disabled={field.disabled}
          onCheckedChange={onChange} />
      );
    case 'switch':
      return (
        <Switch id={id} checked={Boolean(value)} disabled={field.disabled} onCheckedChange={onChange} />
      );
    case 'slider':
      return (
        <Slider value={[typeof value === 'number' ? value : (field.min ?? 0)]} min={field.min} max={field.max}
          step={field.step} disabled={field.disabled}
          onValueChange={(next) => onChange(next[0] ?? 0)} />
      );
    case 'date':
      return (
        <DatePicker id={id} disabled={field.disabled} placeholder={field.placeholder}
          value={value === undefined || value === null ? undefined : String(value)} onChange={onChange} />
      );
    case 'tags':
      return <TagsControl id={id} value={Array.isArray(value) ? value.map(String) : []} disabled={field.disabled} onChange={onChange} />;
    case 'key-value':
      return <KeyValueControl id={id} value={value} disabled={field.disabled} onChange={onChange} />;
    default:
      return (
        <Input id={id} aria-invalid={invalid} disabled={field.disabled} placeholder={field.placeholder}
          value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} />
      );
  }
  // `values` is part of the contract for custom renderers that need siblings.
  void values;
}

/** Free-form string list, edited as removable tags plus an add input. */
function TagsControl({ id, value, disabled, onChange }: { id: string; value: string[]; disabled?: boolean; onChange: (next: string[]) => void }): React.ReactElement {
  const [draft, setDraft] = React.useState('');
  const add = () => {
    const text = draft.trim();
    if (!text || value.includes(text)) return;
    onChange([...value, text]);
    setDraft('');
  };
  return (
    <div className="flex flex-col gap-2">
      {value.length ? (
        <div className="flex flex-wrap gap-1">
          {value.map((item) => (
            <Tag key={item} onRemove={disabled ? undefined : () => onChange(value.filter((entry) => entry !== item))}>
              {item}
            </Tag>
          ))}
        </div>
      ) : null}
      <Input
        id={id}
        disabled={disabled}
        value={draft}
        placeholder="输入后回车添加"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            add();
          }
        }}
      />
    </div>
  );
}

/** Editable key/value pairs, used for labels and annotations. */
function KeyValueControl({ id, value, disabled, onChange }: { id: string; value: unknown; disabled?: boolean; onChange: (next: Record<string, string>) => void }): React.ReactElement {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, string>) : {};
  const entries = Object.entries(record);
  const [draftKey, setDraftKey] = React.useState('');
  const [draftValue, setDraftValue] = React.useState('');

  const add = () => {
    const key = draftKey.trim();
    if (!key) return;
    onChange({ ...record, [key]: draftValue });
    setDraftKey('');
    setDraftValue('');
  };

  return (
    <div className="flex flex-col gap-2">
      {entries.map(([key, entryValue]) => (
        <div key={key} className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate rounded-ai-sm bg-ai-surface-2 px-2 py-1 font-ai-mono text-[11px] text-ai-fg-secondary">
            {key}
          </span>
          <span className="min-w-0 flex-1 truncate rounded-ai-sm bg-ai-surface-2 px-2 py-1 font-ai-mono text-[11px] text-ai-fg-muted">
            {entryValue}
          </span>
          <Button variant="ghost" size="icon" aria-label={`删除 ${key}`} disabled={disabled}
            onClick={() => {
              const next = { ...record };
              delete next[key];
              onChange(next);
            }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="size-3.5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Input id={id} className="flex-1" disabled={disabled} value={draftKey} placeholder="键"
          onChange={(event) => setDraftKey(event.target.value)} />
        <Input className="flex-1" disabled={disabled} value={draftValue} placeholder="值"
          onChange={(event) => setDraftValue(event.target.value)} />
        <Button variant="secondary" size="sm" disabled={disabled || !draftKey.trim()} onClick={add}>添加</Button>
      </div>
    </div>
  );
}

/* ---------------- Component ---------------- */

const columnClass: Record<1 | 2 | 3, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
};

export function ResourceForm<TValues extends Record<string, unknown>>({
  schema,
  values,
  defaultValues,
  onChange,
  onSubmit,
  onCancel,
  submitting = false,
  className,
}: ResourceFormProps<TValues>): React.ReactElement {
  const [internal, setInternal] = React.useState<TValues>((defaultValues ?? {}) as TValues);
  const current = (values ?? internal) as Record<string, unknown>;
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});

  const update = (key: string, next: unknown) => {
    const updated = setByPath(current, key, next);
    if (values === undefined) setInternal(updated as TValues);
    onChange?.(updated as TValues);
  };

  const commit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validateForm(schema, current);
    setErrors(nextErrors);
    setTouched(Object.fromEntries(schema.fields.map((field) => [field.key, true])));
    if (Object.keys(nextErrors).length) return;
    await onSubmit(current as TValues);
  };

  const columns = schema.layout?.columns ?? 2;

  return (
    <form onSubmit={commit} noValidate className={cn('flex flex-col gap-4', className)}>
      <div className={cn('grid gap-4', columnClass[columns])}>
        {schema.fields.map((field) => {
          if (field.visible && !field.visible(current)) return null;
          const id = `ai-field-${field.key.replace(/\./g, '-')}`;
          const error = touched[field.key] ? errors[field.key] : undefined;
          return (
            <FormField
              key={field.key}
              htmlFor={id}
              label={field.label}
              required={field.required}
              hint={field.hint}
              error={error}
              className={cn(field.wide && columns > 1 && 'sm:col-span-2 lg:col-span-3')}
            >
              <FieldControl
                field={field}
                id={id}
                value={getByPath(current, field.key)}
                values={current}
                invalid={Boolean(error)}
                onChange={(next) => update(field.key, next)}
              />
            </FormField>
          );
        })}
      </div>

      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            {schema.submit?.cancelLabel ?? '取消'}
          </Button>
        ) : null}
        <Button type="submit" variant="primary" loading={submitting}>
          {schema.submit?.label ?? '提交'}
        </Button>
      </div>
    </form>
  );
}
