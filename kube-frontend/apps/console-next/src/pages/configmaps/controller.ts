import * as React from 'react';
import { configMapsApi, type ConfigMapDetail, type ConfigMapScope } from '@kube-ai-hub/api-client';
import { useConfigMaps, useCreateConfigMap, useDeleteConfigMaps, usePatchConfigMap, useUpdateConfigMap } from './queries';
import { api } from '@/api';

/**
 * Shared list state and data for the two ConfigMap pages.
 *
 * The project console (`/projects/:ns/configmaps`) and the cluster console
 * (`/clusters/:c/configmaps`) show the same resource from two collections. Their
 * columns differ and their create flow differs — the cluster page must ask which
 * project — but everything below that line is identical: page, sort, selection,
 * the query and the four mutations.
 *
 * Duplicating that would mean fixing every list bug twice; folding the two pages
 * together would mean a `scope === 'cluster'` branch in every handler. This hook is
 * the middle: one state machine, two thin pages.
 *
 * See `design/kube-frontend/cluster-configmaps/list.md`
 * (DEC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-LIST-01).
 */
export interface ConfigMapListScope {
  scope: ConfigMapScope;
  cluster: string;
  /**
   * The page's own project, from the route. Ignored when `scope` is `cluster`.
   *
   * Used as the starting value of the project filter, so arriving at
   * `/projects/<ns>/configmaps` shows that project rather than the whole cluster.
   */
  namespace?: string;
}

export type ConfigMapSortKey = 'name' | 'createTime';
export type ConfigMapOrder = 'asc' | 'desc';

export function useConfigMapListController({ scope, cluster, namespace, pageSize = 10 }: ConfigMapListScope & { pageSize?: number }) {
  const [page, setPage] = React.useState(1);
  const [keyword, setKeyword] = React.useState('');
  const [debouncedKeyword, setDebouncedKeyword] = React.useState('');
  const [sortBy, setSortBy] = React.useState<ConfigMapSortKey>('createTime');
  const [order, setOrder] = React.useState<ConfigMapOrder>('desc');
  const [selected, setSelected] = React.useState<string[]>([]);
  /*
   * Project filter.
   *
   * The start value is the only thing that differs between the pages: the project
   * page starts at its route's namespace, the cluster page starts at its
   * `?namespace=` (empty meaning every project). Everything after that is shared —
   * and once a project is chosen both read the per-namespace collection, because
   * kapis has no namespace parameter for the cluster-wide endpoint.
   */
  const [projectFilter, setProjectFilter] = React.useState(namespace ?? '');

  React.useEffect(() => {
    setProjectFilter(namespace ?? '');
  }, [cluster, scope, namespace]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedKeyword(keyword.trim());
      // A new search starts at page one; otherwise the reader lands on an empty
      // page three of a two-page result.
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  /**
   * What the query reads.
   *
   * Cluster scope with no project chosen uses `/klusters/<id>`; anything narrower
   * uses the namespaced collection. Neither needs a special case in the page: the
   * filter value is the whole input.
   */
  const activeScope: ConfigMapScope = scope === 'cluster' && projectFilter === '' ? 'cluster' : 'project';
  const activeNamespace = projectFilter;

  const query = useConfigMaps({
    scope: activeScope,
    cluster,
    namespace: activeNamespace,
    page,
    pageSize,
    sortBy,
    order,
    keyword: debouncedKeyword,
  });

  /*
   * Mutations take the namespace of the object, not of the list.
   *
   * A cluster-wide list spans several projects, and a write addressed to the wrong
   * one either 404s or hits a different object with the same name. Callers point
   * the mutations at a row through `setTarget` before opening its dialog.
   */
  const [target, setTarget] = React.useState<{ namespace: string; name: string } | null>(null);
  const writeNamespace = target?.namespace ?? activeNamespace;

  const remove = useDeleteConfigMaps({ cluster, namespace: activeNamespace });
  const create = useCreateConfigMap({ cluster });
  const update = useUpdateConfigMap({ cluster, namespace: writeNamespace });
  const patch = usePatchConfigMap({ cluster, namespace: writeNamespace, name: target?.name ?? '' });

  // Selection is cleared whenever the visible page changes: acting on rows the
  // reader can no longer see is the main way a bulk action deletes the wrong thing.
  React.useEffect(() => {
    setSelected([]);
  }, [cluster, activeScope, activeNamespace, page, debouncedKeyword, sortBy, order]);

  const sortByKey = React.useCallback((key: string, nextOrder: ConfigMapOrder) => {
    setSortBy(key as ConfigMapSortKey);
    setOrder(nextOrder);
    setPage(1);
  }, []);

  /** Fetch the full object for a dialog. Returns `null` when it cannot be read. */
  const loadDetail = React.useCallback(
    async (row: { name: string; namespace: string }): Promise<ConfigMapDetail | null> => {
      setTarget({ namespace: row.namespace, name: row.name });
      try {
        return await configMapsApi(api).get({ cluster, namespace: row.namespace, name: row.name });
      } catch {
        // The page reports it through the mutation slot; a dialog must not open
        // half-populated.
        return null;
      }
    },
    [cluster],
  );

  return {
    page,
    setPage,
    keyword,
    setKeyword,
    sortBy,
    order,
    sortByKey,
    selected,
    setSelected,
    projectFilter,
    setProjectFilter,
    activeNamespace,
    activeScope,
    pageSize,
    query,
    items: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    remove,
    create,
    update,
    patch,
    /** Point the write mutations at one object, before opening its dialog. */
    setTarget,
    loadDetail,
  };
}
