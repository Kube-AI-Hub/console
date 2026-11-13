import * as React from 'react';
import { configMapsApi, type ConfigMapDetail } from '@kube-ai-hub/api-client';
import { useConfigMaps, useCreateConfigMap, useDeleteConfigMaps, usePatchConfigMap, useUpdateConfigMap } from './queries';
import { api } from '@/api';

/**
 * List state and data for the ConfigMap page.
 *
 * One page, two collections: `namespace` picks the project, and an empty `namespace`
 * (the filter's 全部项目) reads the cluster-wide collection. That is why there is no
 * separate cluster-level page: cross-project viewing is a filter here, not a second
 * screen with its own columns and its own create flow.
 */
export interface ConfigMapListScope {
  cluster: string;
  /**
   * The page's own project, from the route.
   *
   * Used as the starting value of the project filter, so arriving at
   * `/projects/<ns>/configmaps` shows that project rather than the whole cluster.
   */
  namespace?: string;
}

export type ConfigMapSortKey = 'name' | 'createTime';
export type ConfigMapOrder = 'asc' | 'desc';

export function useConfigMapListController({ cluster, namespace, pageSize = 10 }: ConfigMapListScope & { pageSize?: number }) {
  const [page, setPage] = React.useState(1);
  const [keyword, setKeyword] = React.useState('');
  const [debouncedKeyword, setDebouncedKeyword] = React.useState('');
  const [sortBy, setSortBy] = React.useState<ConfigMapSortKey>('createTime');
  const [order, setOrder] = React.useState<ConfigMapOrder>('desc');
  const [selected, setSelected] = React.useState<string[]>([]);
  /*
   * Project filter: the route's project to begin with, empty meaning every project.
   * Once a project is chosen the list reads the per-namespace collection, because kapis
   * has no namespace parameter for the cluster-wide endpoint.
   */
  const [projectFilter, setProjectFilter] = React.useState(namespace ?? '');

  React.useEffect(() => {
    setProjectFilter(namespace ?? '');
  }, [cluster, namespace]);

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
   * An empty project means the cluster-wide collection (`/configmaps`); anything else
   * means `/namespaces/<ns>/configmaps`. The API client decides that from the empty
   * namespace, so the page needs no scope flag.
   */
  const activeNamespace = projectFilter;

  const query = useConfigMaps({
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
  }, [cluster, activeNamespace, page, debouncedKeyword, sortBy, order]);

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
