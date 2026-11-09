import * as React from 'react';
import { cn } from '../utils/cn';
import { getByPath, setByPath } from '../schema/registry';

/**
 * Declarative form, the counterpart to console's `Form` / `Form.Item`.
 *
 * `ResourceForm` is schema-driven and owns its own layout; this component is
 * the escape hatch for pages that need JSX control over fields while still
 * wanting centralised validation and value plumbing.
 *
 * Validation accepts the `async-validator`-shaped rules console already uses
 * (`{ required, pattern, min, max, message, validator }`), so migrating a page
 * does not mean rewriting its rule objects.
 */

export interface LegacyRule {
  required?: boolean;
  pattern?: RegExp;
  min?: number;
  max?: number;
  message?: string;
  validator?: (value: unknown, values: Record<string, unknown>) => string | null | undefined;
  /** Mirrors console's `checkOnSubmit`: deferred to submit instead of on blur. */
  checkOnSubmit?: boolean;
}

type ErrorMap = Record<string, string>;

interface FormContextValue {
  values: Record<string, unknown>;
  setValue: (name: string, value: unknown) => void;
  errors: ErrorMap;
  setFieldError: (name: string, message: string | undefined) => void;
  registerRules: (name: string, rules: LegacyRule[]) => void;
}

const FormContext = React.createContext<FormContextValue | null>(null);

function useFormContext(): FormContextValue {
  const context = React.useContext(FormContext);
  if (!context) throw new Error('Form fields must be used inside <Form>');
  return context;
}

/** Run one field's rules and return the first failure, if any. */
export function runRules(
  rules: LegacyRule[],
  value: unknown,
  values: Record<string, unknown>,
): string | undefined {
  for (const rule of rules) {
    const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
    if (rule.required && empty) return rule.message ?? '此项为必填';

    // Optional fields pass until the user types something.
    if (empty) continue;

    if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
      return rule.message ?? '格式不正确';
    }
    if (typeof rule.min === 'number' && typeof value === 'string' && value.length < rule.min) {
      return rule.message ?? `至少 ${rule.min} 个字符`;
    }
    if (typeof rule.max === 'number' && typeof value === 'string' && value.length > rule.max) {
      return rule.message ?? `最多 ${rule.max} 个字符`;
    }
    if (rule.validator) {
      const custom = rule.validator(value, values);
      if (custom) return custom;
    }
  }
  return undefined;
}

export interface FormProps {
  /** Controlled values. Omit to let the form own its state. */
  data?: Record<string, unknown>;
  defaultData?: Record<string, unknown>;
  onChange?: (values: Record<string, unknown>) => void;
  onSubmit?: (values: Record<string, unknown>) => void | Promise<void>;
  /** Called with the error map on a failed submit. */
  onError?: (errors: ErrorMap) => void;
  children: React.ReactNode;
  className?: string;
}

export function Form({
  data,
  defaultData,
  onChange,
  onSubmit,
  onError,
  children,
  className,
}: FormProps): React.ReactElement {
  const [internal, setInternal] = React.useState<Record<string, unknown>>(defaultData ?? {});
  const values = data ?? internal;
  const [errors, setErrors] = React.useState<ErrorMap>({});
  const rulesRef = React.useRef(new Map<string, LegacyRule[]>());

  const setValue = React.useCallback(
    (name: string, value: unknown) => {
      const next = setByPath(values, name, value);
      if (data === undefined) setInternal(next);
      onChange?.(next);
    },
    [values, data, onChange],
  );

  const setFieldError = React.useCallback((name: string, message: string | undefined) => {
    setErrors((current) => {
      const next = { ...current };
      if (message) next[name] = message;
      else delete next[name];
      return next;
    });
  }, []);

  const registerRules = React.useCallback((name: string, rules: LegacyRule[]) => {
    rulesRef.current.set(name, rules);
  }, []);

  const context = React.useMemo<FormContextValue>(
    () => ({ values, setValue, errors, setFieldError, registerRules }),
    [values, setValue, errors, setFieldError, registerRules],
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next: ErrorMap = {};
    for (const [name, rules] of rulesRef.current) {
      const message = runRules(rules, getByPath(values, name), values);
      if (message) next[name] = message;
    }
    setErrors(next);
    if (Object.keys(next).length) {
      onError?.(next);
      return;
    }
    await onSubmit?.(values);
  };

  return (
    <FormContext.Provider value={context}>
      <form onSubmit={submit} noValidate className={cn('flex flex-col gap-3', className)}>
        {children}
      </form>
    </FormContext.Provider>
  );
}

export interface FormItemProps {
  /** Dot path into the form values, e.g. `metadata.labels.app`. */
  name: string;
  label?: React.ReactNode;
  rules?: LegacyRule[];
  /** Shown under the control when there is no error. */
  hint?: React.ReactNode;
  /** Validate when the field loses focus instead of only on submit. */
  validateOnBlur?: boolean;
  className?: string;
  /** Receives the bound props a control should spread onto itself. */
  children: React.ReactElement<{ value?: unknown; onChange?: (...args: unknown[]) => void; onBlur?: () => void; id?: string; 'aria-invalid'?: boolean }>;
}

export function FormItem({
  name,
  label,
  rules,
  hint,
  validateOnBlur = false,
  className,
  children,
}: FormItemProps): React.ReactElement {
  const { values, setValue, errors, setFieldError, registerRules } = useFormContext();
  const id = `ai-form-${name.replace(/\./g, '-')}`;
  const value = getByPath(values, name);
  const error = errors[name];

  React.useEffect(() => {
    if (rules?.length) registerRules(name, rules);
  }, [name, rules, registerRules]);

  const blur = () => {
    if (!validateOnBlur || !rules?.length) return;
    setFieldError(name, runRules(rules, value, values));
  };

  const handleChange = (...args: unknown[]) => {
    // React inputs pass the event first; Radix-style controls pass the value.
    const first = args[0];
    const next =
      first && typeof first === 'object' && 'target' in (first as object)
        ? (first as React.ChangeEvent<HTMLInputElement>).target.value
        : first;
    setValue(name, next);
    // Clear the error as soon as the user edits, otherwise a stale message
    // argues with the value they just typed.
    if (error) setFieldError(name, undefined);
  };

  const child = React.cloneElement(children, {
    id,
    value,
    onChange: handleChange,
    onBlur: blur,
    'aria-invalid': error ? true : undefined,
  });

  return (
    <div className={cn('flex flex-col gap-1.5', className)} data-invalid={error ? 'true' : undefined}>
      {label ? (
        <label htmlFor={id} className="text-xs font-medium text-ai-fg-secondary">
          {label}
          {rules?.some((rule) => rule.required) ? (
            <span className="ml-0.5 text-ai-danger" aria-hidden="true">*</span>
          ) : null}
        </label>
      ) : null}
      {child}
      {error ? (
        <p role="alert" className="text-xs text-ai-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ai-fg-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export interface FormGroupProps {
  /** Section title rendered above the fields. */
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Visual grouping; carries no validation state of its own. */
export function FormGroup({ title, description, children, className }: FormGroupProps): React.ReactElement {
  return (
    <fieldset className={cn('flex flex-col gap-3 rounded-ai-lg border border-ai-line p-4', className)}>
      {title ? <legend className="px-1 text-xs font-semibold text-ai-fg">{title}</legend> : null}
      {description ? <p className="text-xs text-ai-fg-muted">{description}</p> : null}
      {children}
    </fieldset>
  );
}

/** Namespaced access matching console's `Form.Item` / `Form.Group` shape. */
export const FormNamespace = Object.assign(Form, { Item: FormItem, Group: FormGroup, Context: FormContext });
