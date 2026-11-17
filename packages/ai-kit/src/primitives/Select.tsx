import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import * as Popover from '@radix-ui/react-popover';
import { cn } from '../utils/cn';
import { inputClassName } from './Input';
import { Input } from './Input';
import { Button } from './Button';
import { Checkbox } from './Toggles';

/**
 * Keep wheel and touch scrolling working inside a portalled popup that lives in a
 * Radix Dialog.
 *
 * Why this exists: Radix Dialog locks page scrolling with `react-remove-scroll`,
 * which listens for `wheel`/`touchmove` on `document` in the **capture** phase and
 * calls `preventDefault` for anything it decides is "outside" the dialog. A Select
 * or Popover portal renders into `document.body`, which *is* outside — so the list
 * rendered, had `overflow: auto`, had a real `scrollHeight > clientHeight`, and
 * still could not be scrolled by the wheel: the event never reached it. Measured on
 * the add-cluster dialog (2026-11-17): `scrollTop` stayed 0 while `max` was 24, and
 * `defaultPrevented` was `true` on every wheel event.
 *
 * The fix is a capture-phase listener on the popup itself that stops the event from
 * reaching the document listener. It runs before the document's capture handler
 * (capture goes outermost-in, but the popup is inside the document's subtree, so its
 * capture handler runs first), and it only fires when the lock is actually engaged —
 * outside a modal the popup keeps normal bubbling behaviour, so a page's own wheel
 * handling is unaffected.
 *
 * Keyboard scrolling is untouched: Radix's own typeahead/arrow handling runs on the
 * content element and does not depend on this.
 */
function useScrollLockShield<T extends HTMLElement>(): (element: T | null) => void {
  /*
   * A callback ref rather than a ref object: Radix's `Content` types its `ref` as
   * `Ref<HTMLDivElement>` (non-nullable), which a `RefObject<T | null>` does not
   * satisfy. The callback also gives the effect a definite element to attach to.
   */
  const cleanup = React.useRef<(() => void) | null>(null);

  return React.useCallback((element: T | null) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!element) return;

    /*
     * `data-scroll-locked` is what `react-remove-scroll` sets on `<body>` while a
     * modal is open. Checking it per event (not once on mount) keeps the shield
     * inert in a popup opened outside any dialog, and correct if the dialog closes
     * while the list is still open.
     */
    const stop = (event: Event): void => {
      if (document.body.hasAttribute('data-scroll-locked')) event.stopPropagation();
    };
    // `passive: true` is deliberate: this listener never calls preventDefault, it
    // only stops propagation, so there is nothing to wait for.
    element.addEventListener('wheel', stop, { capture: true, passive: true });
    element.addEventListener('touchmove', stop, { capture: true, passive: true });
    cleanup.current = () => {
      element.removeEventListener('wheel', stop, { capture: true });
      element.removeEventListener('touchmove', stop, { capture: true });
    };
  }, []);
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface MultiSelectProps {
  value: string[];
  options: SelectOption[];
  onValueChange: (value: string[]) => void;
  placeholder: string;
  clearLabel: string;
  searchLabel?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  'data-ai-id'?: string;
}

/** Multi-selection is a separate contract; a single Select still owns one string. */
export function MultiSelect({ value, options, onValueChange, placeholder, clearLabel, searchLabel,
  emptyText, disabled, className, ...attributes }: MultiSelectProps): React.ReactElement {
  const [query, setQuery] = React.useState('');
  const selected = new Set(value);
  const matches = options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));
  return <Popover.Root>
    <Popover.Trigger asChild>
      <Button variant="secondary" disabled={disabled} aria-label={placeholder} className={cn('min-w-40 justify-start', className)} {...attributes}>
        <span className="max-w-48 truncate">{value.length ? options.filter((option) => selected.has(option.value)).map((option) => option.label).join(', ') : placeholder}</span>
      </Button>
    </Popover.Trigger>
    <Popover.Portal><Popover.Content align="start" sideOffset={6}
      className="z-50 w-64 rounded-ai-md border border-ai-line bg-ai-bg-overlay p-2 shadow-ai-pop">
      {searchLabel ? <Input value={query} aria-label={searchLabel} placeholder={searchLabel} onChange={(event) => setQuery(event.target.value)} /> : null}
      <div className="my-2 flex max-h-60 flex-col gap-1 overflow-y-auto" role="group" aria-label={placeholder}
        onKeyDown={(event) => {
          if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="checkbox"]:not(:disabled)'));
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
          buttons[next]?.focus();
          event.preventDefault();
        }}>
        {matches.map((option) => <label key={option.value} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-ai-sm px-2 text-sm text-ai-fg hover:bg-ai-surface-2">
          <Checkbox checked={selected.has(option.value)} disabled={option.disabled} aria-label={option.label}
            onCheckedChange={(checked) => onValueChange(checked ? [...value, option.value] : value.filter((entry) => entry !== option.value))} />
          {option.label}
        </label>)}
        {matches.length === 0 ? <p className="p-2 text-xs text-ai-fg-muted">{emptyText}</p> : null}
      </div>
      <Button size="sm" variant="ghost" disabled={value.length === 0} onClick={() => onValueChange([])}>{clearLabel}</Button>
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
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
  /** Extra classes for the popup; the trigger already has `className`. */
  contentClassName?: string;
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
  /** Stable automation handle, rendered on whichever element acts as the trigger. */
  'data-ai-id'?: string;
  /**
   * Called when the popup opens.
   *
   * Long option lists are better fetched on demand than with the page: a project page
   * that renders a cluster picker does not need every cluster until the reader asks for
   * them, and the extra request delays the page it sits on.
   */
  onOpenChange?: (open: boolean) => void;
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
  contentClassName,
  searchable = false,
  emptyText = '无匹配项',
  onOpenChange,
  ...aria
}: SelectProps): React.ReactElement {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? '');
  const value = controlledValue ?? internalValue;
  const [open, setOpenState] = React.useState(false);

  /** Every open/close goes through here so a caller that lazy-loads hears about all of them. */
  const setOpen = React.useCallback(
    (next: boolean) => {
      setOpenState(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );
  const [query, setQuery] = React.useState('');
  const listId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const anchorRef = React.useRef<HTMLButtonElement>(null);
  /** Scroll shield for the searchable popup; see `useScrollLockShield`. */
  const popupRef = useScrollLockShield<HTMLDivElement>();
  /** Scroll shield for the Radix-Select popup. */
  const nativePopupRef = useScrollLockShield<HTMLDivElement>();

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
    /*
     * `pointerdown`, not `mousedown`.
     *
     * A Radix `Select` trigger calls `preventDefault()` on its own `pointerdown`
     * (to keep focus where Radix wants it), and that suppresses the compatibility
     * `mousedown` a browser would otherwise synthesise afterwards. Listening for
     * `mousedown` therefore never fired when the reader moved from this popup to a
     * Select — measured on the add-cluster dialog (2026-11-17): clicking 标签 while
     * 供应商 was open left both lists on screen.
     */
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('[data-ai-select-list], [data-radix-popper-content-wrapper]')) return;
      setQuery('');
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
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
              {...(aria['data-ai-id'] ? { 'data-ai-id': aria['data-ai-id'] } : {})}
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
              {...(aria['data-ai-id'] ? { 'data-ai-id': aria['data-ai-id'] } : {})}
              disabled={disabled}
              className={cn(
                inputClassName,
                className,
                'flex items-center justify-between gap-2 text-left',
                selectedLabel ? 'text-ai-fg' : 'text-ai-fg-faint',
              )}
              // The full name is in the title so a hover reveals what the ellipsis hides.
              title={selectedLabel || placeholder}
              /*
               * Open on `pointerdown`, not `click`.
               *
               * When another popup (a Radix Select, a Dropdown) is open, it installs a
               * dismissable layer that calls `preventDefault()` on pointerdown; the
               * browser then never synthesises the `click` this button listened for, so
               * moving straight from that popup to this field did nothing. Radix's own
               * Select trigger opens on pointerdown for the same reason. Measured on the
               * add-cluster dialog (2026-11-17): with 标签 open, clicking 供应商 left the
               * label list open and the provider list closed.
               */
              onPointerDown={(event) => {
                // Left button only: a right-click opens the context menu, not this list.
                if (event.button !== 0) return;
                event.preventDefault();
                setOpen(true);
              }}
            >
              <span className="min-w-0 flex-1 truncate">{selectedLabel || placeholder}</span>
              <ChevronDown className="size-4 shrink-0 text-ai-fg-muted" />
            </button>
          )}
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            ref={popupRef}
            align="start"
            sideOffset={4}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            className={cn(
              /*
               * `overscroll-contain` keeps a wheel that reaches the end of the list
               * from chaining to the page behind the modal; the scroll itself is
               * enabled here (not on the `<ul>`) because this is the element with
               * the max height, and the shield above is attached to it.
               *
               * The height is `min(16rem, available)` rather than a flat `max-h-64`:
               * on a short viewport (a laptop with a small window, or a phone in
               * landscape) 256px ran past the bottom edge and the last option could
               * not be reached at all. Radix publishes the space it actually has as
               * `--radix-popover-content-available-height`.
               */
              'z-50 max-h-[min(16rem,var(--radix-popover-content-available-height))] w-[var(--radix-popper-anchor-width)] overflow-y-auto overscroll-contain rounded-ai-md border border-ai-line bg-ai-bg-overlay p-1 shadow-ai-pop animate-ai-scale-in',
              contentClassName,
            )}
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
        {...(aria['data-ai-id'] ? { 'data-ai-id': aria['data-ai-id'] } : {})}
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
          ref={nativePopupRef}
          position="popper"
          sideOffset={6}
          className={cn(
            /*
             * `overflow-hidden` on the content and `overflow-y-auto` on the viewport is
             * Radix's own shape (the viewport is what scrolls), so the shield goes on
             * this wrapper — the element whose subtree the wheel has to be kept inside.
             *
             * Height is capped by the space Radix measured, not a flat 256px: on a short
             * viewport the popup otherwise ran past the bottom edge and the last option
             * could not be reached.
             */
            'z-50 max-h-[min(16rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden overscroll-contain rounded-ai-md',
            'border border-ai-line bg-ai-bg-overlay shadow-ai-pop',
            'animate-ai-scale-in',
            contentClassName,
          )}
        >
          <SelectPrimitive.Viewport className="max-h-[min(16rem,var(--radix-select-content-available-height))] overflow-y-auto p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={cn(
                  'relative flex cursor-pointer select-none items-center rounded-ai-sm px-2 py-1.5 text-sm text-ai-fg-secondary',
                  'outline-none data-[state=checked]:bg-ai-accent/10 data-[state=checked]:text-ai-accent',
                  'data-[highlighted]:bg-ai-surface-2 data-[highlighted]:text-ai-fg',
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
