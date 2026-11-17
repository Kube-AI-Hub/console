import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '../utils/cn';

export interface FormFieldProps {
  /** Id of the control this label belongs to; links label, hint and error. */
  htmlFor?: string;
  label?: React.ReactNode;
  /** Shown under the control in the muted colour. */
  hint?: React.ReactNode;
  /** Shown under the control in the danger colour; also marks the control invalid. */
  error?: string;
  /**
   * Stable automation handle, rendered as data-ai-id on the error paragraph.
   *
   * A script or E2E test needs to read the message a field is currently showing.
   * Matching the translated copy is fragile and "the alert under the field" is
   * structural; the handle belongs on the element that carries the message, and
   * stable handles are part of the design-system contract (Pagination already
   * supports aiPrefix for the same reason).
   */
  errorAiId?: string;
  required?: boolean;
  /**
   * Field key, rendered as `data-field-key` on the wrapper.
   *
   * Exists so "scroll the failed field into view" can find the wrapper from either the
   * control's id or the key, and so a field whose control has no id (a custom renderer,
   * a group of inputs) is still addressable. See `focusFirstInvalidField`.
   */
  fieldKey?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Layout wrapper for one form control.
 *
 * It does not render the control: the schema layer decides which primitive to
 * use, and keeping the wrapper dumb means custom field types get the same
 * label/hint/error treatment for free.
 */
export function FormField({
  htmlFor,
  label,
  hint,
  error,
  errorAiId,
  required = false,
  fieldKey,
  className,
  children,
}: FormFieldProps): React.ReactElement {
  return (
    <div
      className={cn('flex flex-col gap-1.5', className)}
      data-invalid={error ? 'true' : undefined}
      {...(fieldKey ? { 'data-field-key': fieldKey } : {})}
    >
      {label ? (
        <LabelPrimitive.Root
          htmlFor={htmlFor}
          className="text-xs font-medium text-ai-fg-secondary"
        >
          {label}
          {required ? <span className="ml-0.5 text-ai-danger" aria-hidden="true">*</span> : null}
        </LabelPrimitive.Root>
      ) : null}
      {children}
      {error ? (
        <p role="alert" className="text-xs text-ai-danger" data-ai-id={errorAiId}>{error}</p>
      ) : hint ? (
        <p className="text-xs text-ai-fg-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export interface LabelProps extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> {}

export function Label({ className, ...props }: LabelProps): React.ReactElement {
  return (
    <LabelPrimitive.Root
      className={cn('text-xs font-medium text-ai-fg-secondary', className)}
      {...props}
    />
  );
}
