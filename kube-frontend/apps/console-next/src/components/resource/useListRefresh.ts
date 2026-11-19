import { useT } from '@/i18n';

/**
 * The refresh affordance every list carries.
 *
 * The old console puts a refresh control on every list, and a migrated list without one leaves the
 * reader with no way to re-read after a change made elsewhere (another tab, kubectl, a controller).
 * Both the schema entry and the callback come from here so a page cannot wire one without the
 * other: `ResourceList` renders the button only when it has both.
 *
 * The busy flag is the query's own `isFetching`, so the button reflects a background refetch
 * (polling, window focus) rather than only the click it started.
 */
export interface ListRefresh {
  refresh: { label: string; aiId: string; busy: boolean };
  onRefresh: () => void;
  /**
   * A refetch is in flight while rows are still on screen.
   *
   * Pass it to `ResourceList`'s `refreshing` prop. Without it a refetch is
   * invisible: `loading` only covers the first load, so the reader clicks 刷新 and
   * the table sits there unchanged until the new rows replace the old ones in one
   * frame — which reads as "the button did nothing" when the response is slow
   * (guide pitfall: 等待必须可见). The condition matches the one `ResourceList`
   * expects: fetching, but not the very first load.
   */
  refreshing: boolean;
  /** Empty-state escapes: the same refresh plus "clear search and filters". */
  emptyLabels: { emptyClear: string; emptyRefresh: string };
  /**
   * Labels the toolbar and the column filters need to be usable.
   *
   * `clearFilters` is what makes the "clear all conditions" button appear: `ResourceList`
   * renders it only when the host supplies the label, and it sits at the end of the
   * view-shaping cluster (after search, the column chooser and refresh) so a reader who
   * narrowed three columns has one control that undoes all of it. Before this existed
   * only three pages wired it, so on the other forty a column filter could be cleared
   * only by reopening that one column's popover.
   *
   * `clearFilter` is the per-column version, used as the accessible name of a column
   * filter's reset control and of its search box's clear button.
   */
  filterLabels: { clearFilters: string; clearFilter: (title: string) => string };
}

/**
 * What a list needs to know about its reader: whether a fetch is in flight, and how to start one.
 *
 * Deliberately narrower than `UseQueryResult`: a page that refreshes several lists at once supplies
 * its own aggregate, and demanding a full query result would only force a cast.
 */
export interface ListRefreshSource {
  isFetching?: boolean;
  /** True only for the first load; `refreshing` is derived from the pair. */
  isPending?: boolean;
  refetch: () => unknown;
}

export function useListRefresh(aiPrefix: string, query: ListRefreshSource): ListRefresh {
  const t = useT();
  return {
    refresh: { label: t('common.refresh'), aiId: `${aiPrefix}:refresh`, busy: Boolean(query.isFetching) },
    onRefresh: () => {
      void query.refetch();
    },
    // A source that does not distinguish its first load (an aggregate, a panel) is
    // treated as already loaded: showing the veil is never wrong, showing skeletons
    // on top of rows that exist would be.
    refreshing: Boolean(query.isFetching) && query.isPending !== true,
    emptyLabels: { emptyClear: t('table.clearSearchAndFilters'), emptyRefresh: t('common.refresh') },
    filterLabels: { clearFilters: t('node.filter.clearAll'), clearFilter: (title) => t('node.filter.clear', { title }) },
  };
}
