import * as React from 'react';
import { cn } from '../utils/cn';

const fieldBase = [
  'w-full rounded-ai-md border border-ai-line bg-ai-surface-1 text-ai-fg',
  'placeholder:text-ai-fg-faint',
  'transition-colors duration-ai-fast',
  'hover:border-ai-line-strong',
  'focus-visible:outline-none focus-visible:border-ai-accent focus-visible:ring-2 focus-visible:ring-ai-accent/25',
  'disabled:cursor-not-allowed disabled:opacity-50',
  'aria-[invalid=true]:border-ai-danger aria-[invalid=true]:focus-visible:ring-ai-danger/25',
].join(' ');

// 44px on phones, denser from `sm` up. A 36px field is below the recommended
// touch target and is the control people hit most often.
export const inputClassName = cn(fieldBase, 'min-h-11 sm:min-h-9 px-3 text-sm');
export const textareaClassName = cn(fieldBase, 'min-h-20 resize-y px-3 py-2 text-sm leading-6');

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Rendered before the text; decorative, so it is hidden from the a11y tree. */
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, leading, trailing, ...props },
  ref,
) {
  if (!leading && !trailing) {
    return <input ref={ref} className={cn(inputClassName, className)} {...props} />;
  }
  return (
    <div
      data-ai-field=""
      className={cn(
        'flex h-9 items-center gap-2 rounded-ai-md border border-ai-line bg-ai-surface-1 px-3',
        'transition-colors duration-ai-fast hover:border-ai-line-strong',
        'focus-within:border-ai-accent focus-within:ring-2 focus-within:ring-ai-accent/25',
        // The wrapper draws the focus ring; the inner input is `outline-none`.
        // Without this the browser's global focus outline lands on the wrapper's
        // child and shows up offset by the 2px ring, reading as a double frame.
        'focus-within:outline-none',
        className,
      )}
    >
      {leading ? <span className="shrink-0 text-ai-fg-muted" aria-hidden="true">{leading}</span> : null}
      <input
        ref={ref}
        data-ai-field-input=""
        className="h-full min-w-0 flex-1 bg-transparent text-sm text-ai-fg outline-none placeholder:text-ai-fg-faint disabled:cursor-not-allowed"
        {...props}
      />
      {trailing ? <span className="shrink-0 text-ai-fg-muted">{trailing}</span> : null}
    </div>
  );
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(textareaClassName, className)} {...props} />;
});

/* ---------------- Password ---------------- */

export interface InputPasswordProps extends Omit<InputProps, 'type' | 'trailing'> {
  /** Start with the value masked; defaults to true. */
  defaultVisible?: boolean;
  /** Controlled visibility, for forms that remember the choice. */
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
}

/**
 * Password field with a reveal toggle.
 *
 * The toggle is a real button rather than a decorative icon: it is reachable by
 * keyboard and announced as a toggle, and its `aria-label` states what the next
 * press will do. A purely visual eye icon leaves screen-reader users unable to
 * reveal what they typed.
 */
export const InputPassword = React.forwardRef<HTMLInputElement, InputPasswordProps>(
  function InputPassword(
    { className, defaultVisible = false, visible: controlledVisible, onVisibleChange, disabled, ...props },
    ref,
  ) {
    const [internalVisible, setInternalVisible] = React.useState(defaultVisible);
    const visible = controlledVisible ?? internalVisible;

    const toggle = () => {
      const next = !visible;
      if (controlledVisible === undefined) setInternalVisible(next);
      onVisibleChange?.(next);
    };

    return (
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        disabled={disabled}
        className={className}
        trailing={
          <button
            type="button"
            onClick={toggle}
            disabled={disabled}
            aria-label={visible ? '隐藏密码' : '显示密码'}
            aria-pressed={visible}
            className="grid size-5 place-items-center rounded text-ai-fg-muted transition-colors duration-ai-fast hover:text-ai-fg disabled:cursor-not-allowed"
          >
            {visible ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
          </button>
        }
        {...props}
      />
    );
  },
);

/* ---------------- Search ---------------- */

export interface InputSearchProps extends Omit<InputProps, 'leading' | 'trailing' | 'onChange'> {
  /** Current query. */
  value?: string;
  /** Called when the user commits the query (Enter or the button). */
  onSearch?: (value: string) => void;
  /** Called on every keystroke; omit to submit only on Enter or the button. */
  onChange?: (value: string) => void;
  /** Hide the submit button and rely on Enter. */
  hideButton?: boolean;
  buttonLabel?: string;
}

/**
 * Search box with an explicit submit.
 *
 * Filtering on every keystroke is fine for local data but wrong for a server
 * query, so the value is only "committed" on Enter or the button. A search field
 * also needs `type="search"` semantics for the native clear affordance.
 */
export const InputSearch = React.forwardRef<HTMLInputElement, InputSearchProps>(function InputSearch(
  { className, value, onSearch, onChange, hideButton = false, buttonLabel = '搜索', onKeyDown, ...props },
  ref,
) {
  const submit = () => onSearch?.(value ?? '');
  return (
    <div className={cn('flex w-full items-center gap-2', className)}>
      <Input
        ref={ref}
        type="search"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            submit();
          }
          onKeyDown?.(event);
        }}
        leading={<SearchIcon className="size-3.5" />}
        {...props}
      />
      {hideButton ? null : (
        <button
          type="button"
          onClick={submit}
          className={cn(
            'h-9 shrink-0 rounded-ai-md bg-ai-accent px-3 text-sm font-medium text-ai-accent-fg',
            'transition-colors duration-ai-fast hover:bg-ai-accent-hover',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-ring',
          )}
        >
          {buttonLabel}
        </button>
      )}
    </div>
  );
});

/* ---------------- Icons ---------------- */

function EyeIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M10.6 6.2A9.9 9.9 0 0 1 12 6c6.5 0 10 7 10 7a17 17 0 0 1-3 4" />
      <path d="M6.2 6.3A17 17 0 0 0 2 13s3.5 7 10 7a10 10 0 0 0 4.3-.9" />
      <path d="m2 2 20 20" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
