import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '../utils/cn';
import { inputClassName } from './Input';

/**
 * Text input with a suggestion list.
 *
 * Kept separate from `Select` on purpose: a select constrains the value to the
 * options, while this allows free text and merely suggests. console uses it for
 * namespace and image pickers where the list is a convenience, not a contract.
 *
 * Keyboard handling follows the combobox pattern (Arrow / Enter / Escape) and
 * the list is announced through `aria-activedescendant`, so the active option is
 * not lost for screen-reader users.
 */

export interface AutoCompleteProps {
  value?: string;
  onChange?: (value: string) => void;
  onSelect?: (value: string) => void;
  /** Suggestion list. Filtering is done here when `filter` is not supplied. */
  options: Array<{ value: string; label?: React.ReactNode; disabled?: boolean }>;
  /** Custom filter; defaults to a case-insensitive substring match. */
  filter?: (option: { value: string }, query: string) => boolean;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  emptyText?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
}

export function AutoComplete({
  value: controlledValue,
  onChange,
  onSelect,
  options,
  filter,
  placeholder,
  disabled,
  id,
  className,
  emptyText = '无匹配项',
  ...aria
}: AutoCompleteProps): React.ReactElement {
  // Uncontrolled by default. A caller that passes `value` owns it; one that only
  // passes `onChange` still gets a working input, which is how console uses it.
  const [internalValue, setInternalValue] = React.useState('');
  const value = controlledValue ?? internalValue;
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const listId = React.useId();
  /**
   * Pending "close on blur" timer.
   *
   * Closing is deferred so a click on an option lands before the list unmounts.
   * The timer has to be cancellable: re-focusing or re-clicking the input inside
   * that window used to let the stale timeout fire and shut the list the user
   * had just reopened.
   */
  const blurTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const cancelClose = () => {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
  };

  const openList = () => {
    cancelClose();
    setOpen(true);
  };

  const scheduleClose = () => {
    cancelClose();
    blurTimer.current = setTimeout(() => {
      blurTimer.current = null;
      setOpen(false);
    }, 120);
  };

  React.useEffect(() => cancelClose, []);

  /**
   * Clicking anywhere outside the field dismisses the list.
   *
   * Radix would normally handle this, but its outside-click detection cannot
   * tell the input apart from foreign clicks once the anchor is the input
   * itself — see the note on `onOpenChange`.
   */
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && inputRef.current?.contains(target)) return;
      // The list itself lives in a portal, so a click on an option must not be
      // treated as "outside".
      if (target instanceof Element && target.closest('[data-ai-autocomplete-list]')) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown, true);
    return () => document.removeEventListener('mousedown', onPointerDown, true);
  }, [open]);

  const setValue = (next: string) => {
    if (controlledValue === undefined) setInternalValue(next);
    onChange?.(next);
  };

  const visible = React.useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return options;
    const match = filter ?? ((option: { value: string }) => option.value.toLowerCase().includes(query));
    return options.filter((option) => match(option, query));
  }, [options, value, filter]);

  // A shrinking list can leave the highlight past the end; clamp instead of
  // rendering no active row.
  React.useEffect(() => {
    setActiveIndex((current) => (current >= visible.length ? visible.length - 1 : current));
  }, [visible.length]);

  const choose = (option: { value: string; disabled?: boolean }) => {
    if (option.disabled) return;
    setValue(option.value);
    onSelect?.(option.value);
    cancelClose();
    setOpen(false);
    setActiveIndex(-1);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.min(current + 1, visible.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === 'Enter' && open && activeIndex >= 0) {
      event.preventDefault();
      const option = visible[activeIndex];
      if (option) choose(option);
      return;
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <PopoverPrimitive.Root
      open={open && !disabled}
      /*
       * Only honour an open request from Radix; never let it close the list.
       *
       * The anchor here is the input, not a `Trigger`, so a click inside the
       * input is reported as an outside click and Radix fires
       * `onOpenChange(false)` immediately after the focus handler opened the
       * list. Dismissal is owned by the input's own `blur` and `Escape` paths,
       * which know whether focus actually left the field.
       */
      onOpenChange={(next) => {
        if (!next) return;
        cancelClose();
        setOpen(true);
      }}
    >
      <PopoverPrimitive.Anchor asChild>
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          aria-label={aria['aria-label']}
          aria-invalid={aria['aria-invalid']}
          disabled={disabled}
          value={value}
          placeholder={placeholder}
          className={cn(inputClassName, className)}
          onChange={(event) => {
            setValue(event.target.value);
            openList();
            setActiveIndex(-1);
          }}
          onFocus={openList}
          /*
           * Opening on focus alone is not enough: clicking an input that already
           * has focus fires no focus event, so a second click after the list was
           * dismissed left the user with no way to reopen it but typing. React's
           * handler on `mousedown` covers that case without stealing focus.
           */
          onMouseDown={openList}
          onBlur={scheduleClose}
          onKeyDown={onKeyDown}
        />
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          /*
           * Keep focus on the input. `Popover` defaults to moving focus into the
           * content on open, which blurs the input; the input's `onBlur` then
           * closed the list a frame later. That is why the first click showed
           * the list and it vanished immediately.
           */
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          align="start"
          sideOffset={4}
          // Match the input width explicitly: `--radix-popper-anchor-width` is
          // only published when Radix owns the anchor element, and here the
          // anchor is the input itself.
          className="z-50 max-h-60 min-w-[var(--radix-popper-anchor-width,16rem)] w-[var(--radix-popper-anchor-width,16rem)] overflow-y-auto rounded-ai-md border border-ai-line bg-ai-bg-overlay p-1 shadow-ai-pop animate-ai-scale-in"
        >
          <ul id={listId} role="listbox" aria-label={aria['aria-label']} data-ai-autocomplete-list>
            {visible.length ? (
              visible.map((option, index) => (
                <li
                  key={option.value}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  aria-disabled={option.disabled}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => {
                    // Prevent the input's blur from closing the list first.
                    event.preventDefault();
                    choose(option);
                  }}
                  className={cn(
                    'cursor-pointer select-none rounded-ai-sm px-2 py-1.5 text-xs',
                    option.disabled
                      ? 'pointer-events-none opacity-50'
                      : index === activeIndex
                        ? 'bg-ai-surface-2 text-ai-fg'
                        : 'text-ai-fg-secondary',
                  )}
                >
                  {option.label ?? option.value}
                </li>
              ))
            ) : (
              <li className="px-2 py-3 text-center text-xs text-ai-fg-muted">{emptyText}</li>
            )}
          </ul>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
