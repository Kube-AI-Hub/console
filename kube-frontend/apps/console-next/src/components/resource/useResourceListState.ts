import * as React from 'react';
import type { SortOrder } from '@kube-ai-hub/ui';
import type { ResourceListParams } from '@kube-ai-hub/api-client';

/**
 * List state for a resource page: page, search, sort and selection.
 *
 * These four decisions are identical for every resource and their interactions
 * are where the old console's list pages went wrong repeatedly — a page kept a
 * stale selection after searching, sorting reset the search but not the page,
 * and "改为第 2 页" sometimes fired two requests. They are written once here; the
 * page supplies only which columns are sortable and what to fetch.
 */
export interface ResourceListState<TSortKey extends string> {
  page: number;
  setPage: (page: number) => void;
  /** Raw text in the search box, bound to the input. */
  keyword: string;
  setKeyword: (value: string) => void;
  /** Debounced, trimmed keyword that the query uses. */
  search: string;
  sortBy: TSortKey;
  order: SortOrder;
  setSort: (next: { key: string; order: SortOrder }) => void;
  selected: string[];
  setSelected: (keys: string[]) => void;
}

export interface ResourceListStateOptions<TSortKey extends string> {
  defaultSortBy: TSortKey;
  defaultOrder?: SortOrder;
  /** Fields a search or sort resets the selection over. */
  resetOn?: readonly unknown[];
}

export function useResourceListState<TSortKey extends string>({
  defaultSortBy,
  defaultOrder = 'desc',
  resetOn = [],
}: ResourceListStateOptions<TSortKey>): ResourceListState<TSortKey> {
  const [page, setPage] = React.useState(1);
  const [keyword, setKeyword] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [sortBy, setSortBy] = React.useState<TSortKey>(defaultSortBy);
  const [order, setOrder] = React.useState<SortOrder>(defaultOrder);
  const [selected, setSelected] = React.useState<string[]>([]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(keyword.trim());
      // A new search starts at page one; otherwise the reader lands on an empty
      // page three of a two-page result.
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  // Selection is cleared whenever what the reader can see changes: acting on
  // rows that are no longer visible is the main way a bulk delete removes the
  // wrong thing.
  const resetKey = JSON.stringify([...resetOn, page, search, sortBy, order]);
  React.useEffect(() => {
    setSelected([]);
  }, [resetKey]);

  const setSort = React.useCallback((next: { key: string; order: SortOrder }) => {
    setSortBy(next.key as TSortKey);
    setOrder(next.order);
    setPage(1);
  }, []);

  return { page, setPage, keyword, setKeyword, search, sortBy, order, setSort, selected, setSelected };
}

/** The query parameters a page's list request needs, derived from the state. */
export function toListParams<TSortKey extends string>(
  state: ResourceListState<TSortKey>,
  base: { cluster: string; namespace: string },
  pageSize: number,
): Omit<ResourceListParams, 'signal'> {
  return {
    cluster: base.cluster,
    namespace: base.namespace,
    page: state.page,
    pageSize,
    sortBy: state.sortBy,
    order: state.order,
    keyword: state.search,
  };
}
