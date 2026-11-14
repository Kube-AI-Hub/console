import * as React from 'react';

/**
 * Column visibility for one list page, persisted per page key.
 *
 * `ResourceList` already owns the chooser and the rendering: it hides the columns whose
 * keys are absent from `visibleColumnKeys` and calls `onVisibleColumnsChange` with the
 * next set. What it cannot own is *where* that set lives. This hook keeps it in
 * localStorage so a reader who hides "node" does not have to hide it again after a
 * refresh, and keeps the storage detail (key naming, JSON, corrupt entries) out of
 * every page.
 *
 * Contract:
 * - No stored choice (or a set that no longer matches this page's columns) means
 *   `undefined`, i.e. every column renders exactly as before column visibility
 *   existed. That keeps the default list rendering untouched.
 * - Choosing every column again is the same as the default: the entry is removed, so
 *   a column added to the page later is visible without the reader resetting.
 * - At least one column stays visible: the pages wire this with the identity column
 *   non-hideable (ResourceList always renders non-hideable columns), and an empty
 *   change is refused instead of persisted.
 */
const STORAGE_PREFIX = 'kube-frontend.columns.';

export interface ColumnVisibility {
  /** `undefined` means "no choice stored": render every column. */
  visibleColumnKeys: string[] | undefined;
  setVisibleColumnKeys: (keys: string[]) => void;
}

function readStored(storageKey: string): string[] | undefined {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    return parsed.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    // Private browsing and corrupt JSON both mean "no usable choice"; the default
    // (show everything) is the honest fallback.
    return undefined;
  }
}

function writeStored(storageKey: string, keys: string[] | undefined): void {
  try {
    if (keys === undefined) window.localStorage.removeItem(storageKey);
    else window.localStorage.setItem(storageKey, JSON.stringify(keys));
  } catch {
    // Persistence is a convenience; the current render still honours the choice.
  }
}

export function useColumnVisibility(pageKey: string, columnKeys: readonly string[]): ColumnVisibility {
  const storageKey = STORAGE_PREFIX + pageKey;
  const [stored, setStored] = React.useState<string[] | undefined>(() => readStored(storageKey));

  const visibleColumnKeys = React.useMemo(() => {
    if (stored === undefined || stored.length === 0) return undefined;
    // Keep a stored key only while the page still has that column: switching the
    // page kind reuses this hook with a different column set.
    const known = columnKeys.filter((key) => stored.includes(key));
    return known.length > 0 ? known : undefined;
  }, [columnKeys, stored]);

  const setVisibleColumnKeys = React.useCallback(
    (keys: string[]) => {
      const next = Array.from(new Set(keys.filter((key) => columnKeys.includes(key))));
      // Refuse emptying the list: at least one column must stay. The identity column
      // is not hideable, so in practice this guard is a belt to the table's braces.
      if (next.length === 0) return;
      // Selecting every column is the default, not a stored preference.
      const isDefault = next.length === columnKeys.length;
      writeStored(storageKey, isDefault ? undefined : next);
      setStored(isDefault ? undefined : next);
    },
    [columnKeys, storageKey],
  );

  return { visibleColumnKeys, setVisibleColumnKeys };
}
