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
  /** Empty-state escapes: the same refresh plus "clear search and filters". */
  emptyLabels: { emptyClear: string; emptyRefresh: string };
}

/**
 * What a list needs to know about its reader: whether a fetch is in flight, and how to start one.
 *
 * Deliberately narrower than `UseQueryResult`: a page that refreshes several lists at once supplies
 * its own aggregate, and demanding a full query result would only force a cast.
 */
export interface ListRefreshSource {
  isFetching?: boolean;
  refetch: () => unknown;
}

export function useListRefresh(aiPrefix: string, query: ListRefreshSource): ListRefresh {
  const t = useT();
  return {
    refresh: { label: t('common.refresh'), aiId: `${aiPrefix}:refresh`, busy: Boolean(query.isFetching) },
    onRefresh: () => {
      void query.refetch();
    },
    emptyLabels: { emptyClear: t('table.clearSearchAndFilters'), emptyRefresh: t('common.refresh') },
  };
}
