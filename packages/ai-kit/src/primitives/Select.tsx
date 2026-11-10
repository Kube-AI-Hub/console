import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import * as Popover from '@radix-ui/react-popover';
import { cn } from '../utils/cn';
import { inputClassName } from './Input';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  /**
   * Let the user filter the list by typing.
   *
   * Radix's Select has no built-in search, so this renders a combobox instead:
   * the trigger becomes an input and the list is filtered client-side. Use it
   * for long option lists; a native select-style popup is better for short ones
   * because the typed text would just be a filter nobody needs.
   */
  searchable?: boolean;
  /** Text shown when the filter matches nothing. */
  emptyText?: string;
  'aria-invalid'?: boolean;
  'aria-label'?: string;
}

/**
 * Select built on Radix.
 *
 * Options are passed as data rather than children because the schema layer
 * derives them from field definitions; a compound API would force schema
 * consumers to build JSX for what is really a list.
 */
export function Select({
  value: controlledValue,
  defaultValue,
  onValueChange,
  options,
  placeholder = '请选择',
  disabled,
  id,
  className,
  searchable = false,
  emptyText = '无匹配项',
  ...aria
}: SelectProps): React.ReactElement {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? '');
  const value = controlledValue ?? internalValue;
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const listId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const anchorRef = React.useRef<HTMLButtonElement>(null);

  const commit = (next: string) => {
    if (controlledValue === undefined) setInternalValue(next);
    onValueChange?.(next);
  };

  const filtered = React.useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return options;
    return options.filter((option) => option.label.toLowerCase().includes(keyword));
  }, [options, query]);

  const selectedLabel = options.find((option) => option.value === value)?.label ?? '';

  // Outside-click dismissal has to be handled here because Radix's own
  // detection cannot tell the anchor input apart from foreign clicks.
  const rootRef = React.useRef<HTMLDivElement>(null);

  // The closed state is a button and the open state is an input; moving focus on
  // open is what lets the reader start typing immediately after clicking.
  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('[data-ai-select-list], [data-radix-popper-content-wrapper]')) return;
      setQuery('');
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown, true);
    return () => document.removeEventListener('mousedown', onPointerDown, true);
  }, [open]);

  // The search mode owns its own popup: Radix Select's trigger is a button, and
  // making that button accept typing would fight its keyboard handling.
  if (searchable) {
    const choose = (option: SelectOption) => {
      if (option.disabled) return;
      commit(option.value);
      setQuery('');
      setOpen(false);
    };

    return (
      <div ref={rootRef} className="contents">
      <Popover.Root
        open={open && !disabled}
        onOpenChange={(next) => {
          /*
           * Ignore Radix's close requests.
           *
           * The anchor is the input, not a `Trigger`, so a click inside the
           * field is reported as an outside click and Radix fires
           * `onOpenChange(false)` immediately after focus opened the list — the
           * same trap AutoComplete hit. Dismissal is owned by the input's own
           * blur and Escape handling below.
           */
          if (!next) return;
          setOpen(true);
        }}
      >
        <Popover.Anchor asChild>
          {/*
           * The closed state is a plain div, not the input.
           *
           * An `<input>` cannot ellipsise its value: a long project name scrolls
           * to its end and looks truncated at the start. Rendering the selection
           * as text when the list is closed keeps the familiar "name…" shape and
           * one click still swaps in the input for typing.
           */}
          {open ? (
            <input
              ref={inputRef}
              id={id}
              role="combobox"
              autoComplete="off"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-label={aria['aria-label']}
              aria-invalid={aria['aria-invalid']}
              disabled={disabled}
              className={cn(inputClassName, className)}
              value={query}
              placeholder={selectedLabel || placeholder}
              onBlur={(event) => {
                // Only reset when focus truly left the combobox. Clearing on any
                // blur wiped the filter in the same tick as an option click, and
                // the list re-rendered under the pointer.
                const next = event.relatedTarget as Node | null;
                if (next && event.currentTarget.parentElement?.contains(next)) return;
                setQuery('');
              }}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setQuery('');
                  setOpen(false);
                  return;
                }
                if (event.key === 'Enter') {
                  event.preventDefault();
                  const first = filtered.find((option) => !option.disabled);
                  if (first) choose(first);
                }
              }}
            />
          ) : (
            <button
              ref={anchorRef}
              type="button"
              id={id}
              role="combobox"
              aria-expanded={false}
              aria-controls={listId}
              aria-label={aria['aria-label']}
              aria-invalid={aria['aria-invalid']}
              disabled={disabled}
              className={cn(
                inputClassName,
                className,
                'flex items-center justify-between gap-2 text-left',
                selectedLabel ? 'text-ai-fg' : 'text-ai-fg-faint',
              )}
              // The full name is in the title so a hover reveals what the ellipsis hides.
              title={selectedLabel || placeholder}
              onClick={() => setOpen(true)}
            >
              <span className="min-w-0 flex-1 truncate">{selectedLabel || placeholder}</span>
              <ChevronDown className="size-4 shrink-0 text-ai-fg-muted" />
            </button>
          )}
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            className="z-50 max-h-64 w-[var(--radix-popper-anchor-width)] overflow-y-auto rounded-ai-md border border-ai-line bg-ai-bg-overlay p-1 shadow-ai-pop animate-ai-scale-in"
          >
            <ul id={listId} role="listbox" aria-label={aria['aria-label']} data-ai-select-list className="flex flex-col gap-0.5">
              {filtered.length ? (
                filtered.map((option) => (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={option.value === value}
                    aria-disabled={option.disabled}
                    // `mousedown` keeps focus in the input, so the list is not
                    // torn down by the blur that a click would cause.
                    onMouseDown={(event) => {
                      event.preventDefault();
                      choose(option);
                    }}
                    className={cn(
                      'cursor-pointer select-none rounded-ai-sm px-2 py-1.5 text-sm',
                      option.disabled
                        ? 'pointer-events-none opacity-50'
                        : option.value === value
                          ? 'bg-ai-accent/10 text-ai-accent'
                          : 'text-ai-fg-secondary hover:bg-ai-surface-2 hover:text-ai-fg',
                    )}
                  >
                    {option.label}
                  </li>
                ))
              ) : (
                <li className="px-2 py-3 text-center text-xs text-ai-fg-muted">{emptyText}</li>
              )}
            </ul>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      </div>
    );
  }

  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-label={aria['aria-label']}
        aria-invalid={aria['aria-invalid']}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-ai-md border border-ai-line',
          'bg-ai-surface-1 px-3 text-sm text-ai-fg',
          'transition-colors duration-ai-fast hover:border-ai-line-strong',
          'focus-visible:outline-none focus-visible:border-ai-accent focus-visible:ring-2 focus-visible:ring-ai-accent/25',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'data-[placeholder]:text-ai-fg-faint',
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="size-4 shrink-0 text-ai-fg-muted" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className={cn(
            'z-50 max-h-64 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-ai-md',
            'border border-ai-line bg-ai-bg-overlay shadow-ai-pop',
            'animate-ai-scale-in',
          )}
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={cn(
                  'relative flex cursor-pointer select-none items-center rounded-ai-sm px-2 py-1.5 text-sm text-ai-fg-secondary',
                  'outline-none data-[highlighted]:bg-ai-surface-2 data-[highlighted]:text-ai-fg',
                  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                )}
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

function ChevronDown({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
