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
  pageSize: number;
  setPageSize: (pageSize: number) => void;
  /** Raw text in the search box, bound to the input. */
  keyword: string;
  setKeyword: (value: string) => void;
  /** Debounced, trimmed keyword that the query uses. */
  search: string;
  sortBy: TSortKey;
  order: SortOrder;
  setSort: (next: { key: string; order: SortOrder }) => void;
  /**
   * The order the header cycle returns to on its third click.
   *
   * Hand this to `schema.sortFallback`. It is the hook's own default, so a page does
   * not have to restate it — and cannot restate it wrong.
   */
  sortFallback: { key: TSortKey; order: SortOrder };
  selected: string[];
  setSelected: (keys: string[]) => void;
}

export interface ResourceListStateOptions<TSortKey extends string> {
  defaultSortBy: TSortKey;
  defaultOrder?: SortOrder;
  defaultPageSize?: number;
  /** Fields a search or sort resets the selection over. */
  resetOn?: readonly unknown[];
}

export function useResourceListState<TSortKey extends string>({
  defaultSortBy,
  defaultOrder = 'desc',
  defaultPageSize = 20,
  resetOn = [],
}: ResourceListStateOptions<TSortKey>): ResourceListState<TSortKey> {
  const [page, setPage] = React.useState(1);
  const [pageSize, updatePageSize] = React.useState(defaultPageSize);
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
  const resetKey = JSON.stringify([...resetOn, page, pageSize, search, sortBy, order]);
  React.useEffect(() => {
    setSelected([]);
  }, [resetKey]);

  const setSort = React.useCallback((next: { key: string; order: SortOrder }) => {
    setSortBy(next.key as TSortKey);
    setOrder(next.order);
    setPage(1);
  }, []);

  const setPageSize = React.useCallback((next: number) => {
    if (!Number.isSafeInteger(next) || next < 1) return;
    updatePageSize(next);
    setPage(1);
    setSelected([]);
  }, []);

  return { page, setPage, pageSize, setPageSize, keyword, setKeyword, search, sortBy, order, setSort,
    sortFallback: { key: defaultSortBy, order: defaultOrder }, selected, setSelected };
}

/** The query parameters a page's list request needs, derived from the state. */
export function toListParams<TSortKey extends string>(
  state: ResourceListState<TSortKey>,
  base: { cluster: string; namespace: string },
  /**
   * Page size override. Omit it and the request follows `state.pageSize`, which is what a
   * page with a page-size picker needs: passing a constant here silently ignored the picker
   * and asked the server for 10 rows while the table claimed to show 50.
   */
  pageSize?: number,
): Omit<ResourceListParams, 'signal'> {
  return {
    cluster: base.cluster,
    namespace: base.namespace,
    page: state.page,
    pageSize: pageSize ?? state.pageSize,
    sortBy: state.sortBy,
    order: state.order,
    keyword: state.search,
  };
}
