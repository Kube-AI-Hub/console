import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { networkIsolationApi, networkPoliciesApi, networkPoliciesWriteApi, type NetworkPolicySummary } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, Switch, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useResourceListState, toListParams } from '@/components/resource/useResourceListState';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { NetworkPolicyDialog } from './NetworkPolicyDialog';
import { NetworkRulesPanel } from './NetworkRulesPanel';
import { formatTimestamp } from '@/lib/time';

/**
 * 项目网络隔离.
 *
 * Two things on one page because they answer one question ("is this project's traffic
 * controlled?"): the project-level switch, which KubeSphere stores as a namespace
 * annotation, and the NetworkPolicy objects that actually enforce it.
 *
 * The switch is a merge patch on that annotation — writing the whole namespace would
 * risk dropping labels set elsewhere.
 */
export interface NetworkIsolationPageProps {
  workspace: string;
  cluster: string;
  namespace: string;
}

const PAGE_SIZE = 10;

export function NetworkIsolationPage({ workspace, cluster, namespace }: NetworkIsolationPageProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const list = useResourceListState<'name' | 'createTime'>({ defaultSortBy: 'name', resetOn: [cluster, namespace] });

  const isolation = useQuery({
    queryKey: ['network-isolation', namespace],
    queryFn: ({ signal }) => networkIsolationApi(apiClient).get({ namespace, signal }),
  });

  const params = toListParams(list, { cluster, namespace }, PAGE_SIZE);
  const policies = useQuery({
    // The key repeats every request parameter, so a page or sort change is a new entry
    // rather than a stale hit.
    queryKey: ['networkpolicies', cluster, namespace, params.page, params.sortBy, params.order, params.keyword],
    queryFn: ({ signal }) => networkPoliciesApi(apiClient).list({ ...params, signal }),
  });

  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<NetworkPolicySummary | null>(null);

  const create = useMutation({
    mutationFn: (input: { name: string; podSelector: string; direction: 'Ingress' | 'Egress'; peerSelector: string }) =>
      networkPoliciesWriteApi(apiClient).create({ namespace, ...input }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['networkpolicies', cluster, namespace] }),
  });

  const remove = useMutation({
    mutationFn: (name: string) => networkPoliciesWriteApi(apiClient).remove({ namespace, name }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['networkpolicies', cluster, namespace] }),
  });

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => networkIsolationApi(apiClient).set({ namespace, enabled }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['network-isolation', namespace] }),
  });

  const rows = (policies.data?.items ?? []) as NetworkPolicySummary[];
  const total = policies.data?.total ?? 0;

  const schema = React.useMemo<ListSchema<NetworkPolicySummary>>(
    () => ({
      title: t('settings.network.title'),
      description: t('settings.network.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('settings.network.search'), aiId: 'networkpolicies:search' },
      sortableKeys: ['name', 'createTime'],
      sortAiPrefix: 'networkpolicies',
      sort: { key: list.sortBy, order: list.order },
      columns: [
        {
          key: 'name',
          title: t('settings.column.name'),
          render: (row) => (
            <span className="flex min-w-0 flex-col">
              {/* The detail page owns 编辑 YAML; a rule that needs a change is reached
                  from here, not by hunting for the object's YAML in kubectl. */}
              <a
                href={`/kube-frontend/${encodeURIComponent(workspace)}/clusters/${encodeURIComponent(cluster)}/projects/${encodeURIComponent(namespace)}/networkpolicies/${encodeURIComponent(row.name)}`}
                className="truncate font-medium text-ai-accent hover:underline"
                {...actionProps(`networkpolicies:open:${row.name}`)}
              >
                {row.alias || row.name}
              </a>
              <span className="truncate font-mono text-[11px] text-ai-fg-muted">{row.podSelector}</span>
            </span>
          ),
        },
        {
          key: 'policyTypes',
          title: t('settings.network.types'),
          width: 140,
          hideBelow: 'md',
          render: (row) => (
            <span className="flex flex-wrap gap-1">
              {row.policyTypes.length === 0 ? '-' : row.policyTypes.map((type) => <Badge key={type} tone="info">{type}</Badge>)}
            </span>
          ),
        },
        {
          key: 'rules',
          title: t('settings.network.rules'),
          width: 130,
          hideBelow: 'lg',
          render: (row) => (
            <span className="tabular-nums text-ai-fg-secondary">{t('settings.network.ruleCounts', { ingress: row.ingressRules, egress: row.egressRules })}</span>
          ),
        },
        {
          key: 'createTime',
          title: t('settings.column.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
        },
      ],
      // Only policies this console created can be deleted here; anything else may be
      // owned by another controller, and deleting it would surprise its owner.
      rowActions: [{ key: 'delete', label: t('settings.network.delete'), tone: 'danger' as const }],
      ...{ primaryAction: { key: 'create', label: t('settings.network.create'), aiId: 'networkpolicies:create' } },
      empty: { title: t('settings.network.emptyTitle'), description: t('settings.network.emptyDescription') },
      labels: {
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      pagination: { page: list.page, pageSize: PAGE_SIZE, total },
    }),
    [list, t, total],
  );

  const state = policies.isPending ? 'loading' : policies.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="networkpolicies:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={policies.error} onRetry={() => void policies.refetch()} retryAiId="networkpolicies:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="networkpolicies:surface" state={state} className="flex min-w-0 flex-col gap-4">
      {/* The switch is the project-wide intent; the table below is what enforces it. */}
      <div className="flex items-center justify-between gap-3 rounded-ai-md border border-ai-line p-3" data-ai-id="networkpolicies:isolation">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs font-medium text-ai-fg-secondary">{t('settings.network.isolate')}</span>
          <span className="text-[11px] text-ai-fg-muted">{t('settings.network.isolateHint')}</span>
        </div>
        {/* The switch is 36×20 by default; on a phone its track is grown to a thumb
            target. The wrapper keeps the agent handle off the control itself. */}
        <div className="flex min-h-11 items-center" {...actionProps('networkpolicies:isolate-toggle')}>
          <Switch
            className="h-6 w-11 sm:h-5 sm:w-9"
            checked={isolation.data ?? false}
            disabled={isolation.isPending || toggle.isPending}
            aria-label={t('settings.network.isolate')}
            onCheckedChange={(next: boolean) => toggle.mutate(next)}
          />
        </div>
      </div>

      <MutationAlert error={toggle.error} />

      <ResourceList
        schema={schema}
        rows={rows}
        loading={state === 'loading'}
        searchValue={list.keyword}
        onSearchChange={list.setKeyword}
        onPageChange={list.setPage}
        onSortChange={(next: { key: string; order: SortOrder } | undefined) => {
          if (next) list.setSort(next);
        }}
        onAction={(action, row) => {
          // `primaryAction` dispatches with no row.
          if (action === 'create') return setCreating(true);
          if (action === 'delete' && row) setDeleting(row);
        }}
      />

      {/*
        * The rule view is a projection of the same objects, not a second model: the
        * table above is where a policy is opened/deleted, and this panel answers what
        * its rules allow. It reads the whole collection, not the current page.
        */}
      <NetworkRulesPanel workspace={workspace} cluster={cluster} namespace={namespace} />

      <MutationAlert error={create.error ?? remove.error} />

      <NetworkPolicyDialog
        open={creating}
        pending={create.isPending}
        onOpenChange={setCreating}
        onSubmit={async (values) => {
          await create.mutateAsync(values);
          setCreating(false);
        }}
      />

      {deleting ? (
        <DeleteDialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          names={[deleting.name]}
          resource="networkpolicies"
          noun={t('settings.network.title')}
          pending={remove.isPending}
          onConfirm={async () => {
            await remove.mutateAsync(deleting.name);
            setDeleting(null);
          }}
        />
      ) : null}
    </AiSurface>
  );
}
