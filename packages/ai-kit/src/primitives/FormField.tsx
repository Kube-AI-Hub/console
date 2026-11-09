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
  required?: boolean;
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
  required = false,
  className,
  children,
}: FormFieldProps): React.ReactElement {
  return (
    <div className={cn('flex flex-col gap-1.5', className)} data-invalid={error ? 'true' : undefined}>
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
        <p role="alert" className="text-xs text-ai-danger">{error}</p>
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
