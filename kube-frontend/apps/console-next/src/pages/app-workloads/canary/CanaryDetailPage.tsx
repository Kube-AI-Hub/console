import * as React from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiButton, AiSurface, Badge, Button, Skeleton } from '@kube-ai-hub/ui';
import {
  pausedStrategy,
  resumedStrategy,
  strategiesApi,
  toStrategyDetail,
  withBluegreenVersion,
  withGovernor,
  withTrafficWeight,
  workloadsApi,
  type KubeStrategy,
  type StrategyDetail,
  type StrategyVersion,
} from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { MutationAlert, ResourceErrorPanel, errorMessage } from '@/components/resource/ResourceErrorPanel';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { DefinitionRow as Row } from '@/components/resource/DefinitionRow';
import { formatTimestamp } from '@/lib/time';
import { STATUS_TONES, matchKindText, matchTypeText, modeText, statusText, typeText, versionRoleText } from './labels';
import { TrafficDialog, type TrafficChange } from './TrafficDialog';
import { useStrategyPermission } from './useStrategyPermission';

/**
 * One gray release: what it is, how traffic is split, what routes it matches and what
 * the controller said about it.
 *
 * The old console opened this as a full-screen modal from a card list; here it is a real
 * route, so a release has a URL an operator can send to somebody. The sections keep the
 * old order — versions and their traffic first, then the request match, then the
 * controller's conditions — because that is the order the release is debugged in.
 *
 * Writing is deliberately narrow: traffic/version selection, pause/resume and delete.
 * Editing the workloads behind the versions stays on the workload pages (each version
 * links to its workload), and the container editor the old console embedded here is not
 * duplicated.
 */
export interface CanaryDetailPageProps {
  workspace: string;
  cluster: string;
  namespace: string;
  name: string;
}

type Dialog = 'none' | 'traffic' | 'delete';

/** The Deployment a version runs, as far as the strategy tells us. */
interface VersionWorkload {
  name: string;
  ready: number;
  total: number;
}

/**
 * Which workload backs a version.
 *
 * The controller records the names it created in annotations; objects made by hand (or
 * by this console) follow the naming convention host-version. The annotations win, and
 * when neither yields a name the version simply has no workload to link — showing a
 * guessed link would open a 404.
 */
function workloadNameFor(detail: StrategyDetail, version: StrategyVersion): string {
  const annotations = detail.raw.metadata?.annotations ?? {};
  const oldName = annotations['servicemesh.kubesphere.io/oldWorkloadName'] ?? '';
  const newName = annotations['servicemesh.kubesphere.io/newWorkloadName'] ?? '';
  if (version.role === 'principal' && oldName) return oldName;
  if ((version.role === 'canary' || version.role === 'mirror') && newName) return newName;
  if (!detail.targetService) return '';
  return detail.targetService + '-' + version.version;
}

export function CanaryDetailPage({ workspace, cluster, namespace, name }: CanaryDetailPageProps): React.ReactElement {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = React.useState<Dialog>('none');
  const [notice, setNotice] = React.useState('');

  const detailKey = React.useMemo(() => ['strategies', cluster, namespace, name] as const, [cluster, namespace, name]);
  const listKey = React.useMemo(() => ['strategies', cluster, namespace] as const, [cluster, namespace]);

  const query = useQuery({
    queryKey: detailKey,
    queryFn: ({ signal }) => strategiesApi(apiClient).get({ cluster, namespace, name, signal }),
  });

  const workloads = useQuery({
    queryKey: ['workloads', 'deployments', cluster, namespace, 'grayrelease-versions'],
    queryFn: ({ signal }) => workloadsApi(apiClient, 'deployments').list({ cluster, namespace, page: 1, pageSize: -1, signal }),
  });

  const removePermission = useStrategyPermission('delete', cluster, namespace, name);

  const detail = query.data ? toStrategyDetail(query.data) : null;

  const workloadByName = React.useMemo(() => {
    const map = new Map<string, VersionWorkload>();
    for (const item of workloads.data?.items ?? []) {
      map.set(item.name, { name: item.name, ready: item.ready ?? 0, total: item.replicas });
    }
    return map;
  }, [workloads.data]);

  const update = useMutation({
    mutationFn: (body: KubeStrategy) => strategiesApi(apiClient).update({ cluster, namespace, name, body }),
    onSuccess: (saved) => {
      queryClient.setQueryData(detailKey, saved);
      void queryClient.invalidateQueries({ queryKey: listKey });
    },
  });

  const remove = useMutation({
    mutationFn: () => strategiesApi(apiClient).remove({ cluster, namespace, name }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: detailKey });
      void queryClient.invalidateQueries({ queryKey: listKey });
    },
  });

  const listHref = '/kube-frontend/' + workspace + '/clusters/' + cluster + '/projects/' + namespace + '/grayrelease';
  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';

  function applyTraffic(change: TrafficChange): void {
    if (!detail) return;
    const raw = detail.raw;
    const body =
      change.kind === 'weight'
        ? withTrafficWeight(raw, change.weight)
        : change.kind === 'bluegreen'
          ? withBluegreenVersion(raw, change.version)
          : withGovernor(raw, change.version);
    update.mutate(body, {
      onSuccess: () => {
        setDialog('none');
        setNotice(t('grayRelease.detail.trafficUpdated'));
      },
    });
  }

  function togglePause(): void {
    if (!detail) return;
    if (detail.governor) {
      update.mutate(resumedStrategy(detail.raw), {
        onSuccess: () => setNotice(t('grayRelease.detail.resumed')),
      });
      return;
    }
    update.mutate(pausedStrategy(detail.raw), {
      onSuccess: () => setNotice(t('grayRelease.detail.paused', { version: detail.principal || '-' })),
    });
  }

  const canAdjustTraffic = detail !== null && (detail.mode === 'traffic' || detail.mode === 'content' || detail.mode === 'bluegreen');
  // Pause/resume is a canary concept: the governing version is optional there, while a
  // blue-green switch is the same thing expressed as a version choice.
  const canPause = detail !== null && (detail.mode === 'traffic' || detail.mode === 'content');

  return (
    <AiSurface as="section" aiId="grayrelease-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <div>
        <a
          href={listHref}
          className="inline-flex items-center gap-1 text-xs text-ai-link hover:underline"
          {...actionProps('grayrelease-detail:back')}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
            event.preventDefault();
            void navigate({ href: listHref });
          }}
        >
          {t('grayRelease.back')}
        </a>
      </div>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="grayrelease-detail:retry" />
      ) : null}

      {detail ? (
        <>
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-base font-semibold text-ai-fg">{detail.alias || detail.name}</h1>
                <Badge tone={detail.type === 'Canary' ? 'info' : 'neutral'}>{typeText(t, detail.type)}</Badge>
                <span title={detail.statusDetail || undefined}>
                  <Badge tone={STATUS_TONES[detail.status]}>{statusText(t, detail.status)}</Badge>
                </span>
              </div>
              <p className="text-xs text-ai-fg-muted">
                {detail.targetService || '-'} · {modeText(t, detail.mode)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {canAdjustTraffic ? (
                <Button size="sm" variant="ghost" {...actionProps('grayrelease-detail:edit-traffic')} onClick={() => setDialog('traffic')}>
                  {t('grayRelease.action.editTraffic')}
                </Button>
              ) : null}
              {canPause ? (
                <Button size="sm" variant="ghost" {...actionProps(detail.governor ? 'grayrelease-detail:resume' : 'grayrelease-detail:pause')} onClick={togglePause}>
                  {detail.governor ? t('grayRelease.action.resume') : t('grayRelease.action.pause')}
                </Button>
              ) : null}
              {removePermission.denied ? null : (
                <AiButton aiId="grayrelease-detail:delete" size="sm" variant="danger" onClick={() => setDialog('delete')}>
                  {t('grayRelease.action.delete')}
                </AiButton>
              )}
            </div>
          </header>

          {notice ? (
            <p role="status" className="text-xs text-ai-success" data-ai-id="grayrelease-detail:notice">
              {notice}
            </p>
          ) : null}

          <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="grayrelease-detail:attributes">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('grayRelease.detail.attributes')}</h2>
            <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-[minmax(6rem,auto)_1fr]">
              <Row label={t('grayRelease.detail.field.cluster')} value={cluster} />
              <Row label={t('grayRelease.detail.field.project')} value={detail.namespace || namespace} />
              <Row label={t('grayRelease.detail.field.mode')} value={modeText(t, detail.mode)} />
              <Row label={t('grayRelease.detail.field.targetService')} value={detail.targetService || '-'} />
              <Row label={t('grayRelease.detail.field.principal')} value={detail.principal || '-'} />
              <Row label={t('grayRelease.detail.field.governor')} value={detail.governor || t('grayRelease.detail.governorNone')} />
              <Row label={t('grayRelease.detail.field.strategyPolicy')} value={detail.strategyPolicy || '-'} />
              <Row label={t('grayRelease.detail.field.createdAt')} value={formatTimestamp(detail.createdAt)} />
            </dl>
          </section>

          <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="grayrelease-detail:versions">
            <h2 className="text-sm font-medium text-ai-fg">{t('grayRelease.detail.versions')}</h2>
            <p className="mb-3 text-xs text-ai-fg-muted">{t('grayRelease.detail.versionsDescription')}</p>
            <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {detail.versions.map((version) => {
                const workloadName = workloadNameFor(detail, version);
                const workload = workloadName ? workloadByName.get(workloadName) : undefined;
                return (
                  <li
                    key={version.version}
                    data-ai-row={version.version}
                    data-ai-id={'grayrelease-detail:version:' + version.version}
                    className="flex flex-col gap-1.5 rounded-ai-md border border-ai-line bg-ai-surface-2 p-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-medium text-ai-fg">{version.version || '-'}</span>
                      <Badge tone={version.role === 'principal' ? 'neutral' : 'info'}>{versionRoleText(t, version.role)}</Badge>
                      {version.governing ? <Badge tone="success">{t('grayRelease.detail.version.governing')}</Badge> : null}
                    </div>
                    <p className="text-ai-fg-secondary">
                      {version.weight === undefined
                        ? version.role === 'mirror'
                          ? '-'
                          : t('grayRelease.detail.version.weightUnset')
                        : t('grayRelease.detail.version.weight', { weight: version.weight })}
                    </p>
                    {workload ? (
                      <>
                        <Link
                          to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/deployments/$name"
                          params={{ workspace, cluster, namespace, name: workload.name }}
                          className="inline-flex min-h-6 items-center text-ai-link hover:underline"
                          data-ai-id={'grayrelease-detail:workload:' + workload.name}
                        >
                          {workload.name}
                        </Link>
                        <p className="tabular-nums text-ai-fg-muted">
                          {t('grayRelease.detail.version.replicas', { available: workload.ready, desired: workload.total })}
                        </p>
                      </>
                    ) : (
                      <p className="text-ai-fg-muted">
                        {t('grayRelease.detail.version.noWorkload')}
                        {workloadName ? ' (' + workloadName + ')' : ''}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="grayrelease-detail:match-rules">
            <h2 className="text-sm font-medium text-ai-fg">{t('grayRelease.detail.matchRules')}</h2>
            <p className="mb-3 text-xs text-ai-fg-muted">{t('grayRelease.detail.matchRulesDescription')}</p>
            {detail.matchRules.length === 0 ? (
              <p className="text-xs text-ai-fg-muted" data-ai-id="grayrelease-detail:match-rules-empty">
                {t('grayRelease.detail.noMatchRules')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-ai-fg-muted">
                    <tr>
                      <th className="py-1 pr-3 font-medium">{t('grayRelease.detail.match.column.rule')}</th>
                      <th className="py-1 pr-3 font-medium">{t('grayRelease.detail.match.column.kind')}</th>
                      <th className="py-1 pr-3 font-medium">{t('grayRelease.detail.match.column.type')}</th>
                      <th className="py-1 pr-3 font-medium">{t('grayRelease.detail.match.column.value')}</th>
                      <th className="py-1 font-medium">{t('grayRelease.detail.match.column.target')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.matchRules.map((rule, index) => (
                      <tr
                        key={rule.index + '-' + rule.kind + '-' + rule.key + '-' + index}
                        data-ai-row={rule.index + '-' + rule.kind + '-' + (rule.key || rule.matchType)}
                        className="border-t border-ai-line"
                      >
                        <td className="py-1 pr-3 tabular-nums text-ai-fg-muted">{rule.index}</td>
                        <td className="py-1 pr-3">
                          {matchKindText(t, rule.kind)}
                          {rule.key ? ' ' + rule.key : ''}
                        </td>
                        <td className="py-1 pr-3">{matchTypeText(t, rule.matchType)}</td>
                        <td className="break-all py-1 pr-3 font-mono text-[11px] text-ai-fg">{rule.value || '-'}</td>
                        <td className="py-1 font-mono text-[11px] text-ai-fg-secondary">{rule.targets.join(', ') || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="grayrelease-detail:conditions">
            <h2 className="text-sm font-medium text-ai-fg">{t('grayRelease.detail.conditions')}</h2>
            <p className="mb-3 text-xs text-ai-fg-muted">{t('grayRelease.detail.conditionsDescription')}</p>
            {detail.conditions.length === 0 ? (
              <div data-ai-id="grayrelease-detail:conditions-empty" className="text-xs text-ai-fg-muted">
                <p>{t('grayRelease.detail.conditionsEmpty')}</p>
                <p className="mt-1">{t('grayRelease.detail.conditionsEmptyHint')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-ai-fg-muted">
                    <tr>
                      <th className="py-1 pr-3 font-medium">{t('grayRelease.detail.condition.column.type')}</th>
                      <th className="py-1 pr-3 font-medium">{t('grayRelease.detail.condition.column.status')}</th>
                      <th className="py-1 pr-3 font-medium">{t('grayRelease.detail.condition.column.reason')}</th>
                      <th className="py-1 pr-3 font-medium">{t('grayRelease.detail.condition.column.message')}</th>
                      <th className="py-1 font-medium">{t('grayRelease.detail.condition.column.lastTransition')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.conditions.map((condition, index) => (
                      <tr key={condition.type + '-' + index} data-ai-row={condition.type} className="border-t border-ai-line">
                        <td className="py-1 pr-3">{condition.type || '-'}</td>
                        <td className="py-1 pr-3">{condition.status || '-'}</td>
                        <td className="py-1 pr-3">{condition.reason || '-'}</td>
                        <td className="break-all py-1 pr-3">{condition.message || '-'}</td>
                        <td className="py-1 tabular-nums text-ai-fg-muted">{formatTimestamp(condition.lastTransitionTime)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <MutationAlert error={update.error ?? remove.error} />
        </>
      ) : null}

      {detail && dialog === 'traffic' ? (
        <TrafficDialog
          open
          detail={detail}
          pending={update.isPending}
          {...(update.error ? { error: errorMessage(t, update.error) } : {})}
          onOpenChange={(open) => {
            if (open) return;
            setDialog('none');
            update.reset();
          }}
          onSubmit={applyTraffic}
        />
      ) : null}

      {dialog === 'delete' ? (
        <DeleteDialog
          open
          onOpenChange={(open) => {
            if (open) return;
            setDialog('none');
            remove.reset();
          }}
          names={[name]}
          resource="grayrelease"
          noun={t('grayRelease.title')}
          pending={remove.isPending}
          {...(remove.error ? { error: errorMessage(t, remove.error) } : {})}
          onConfirm={async () => {
            await remove.mutateAsync();
            setDialog('none');
            void navigate({ href: listHref });
          }}
        />
      ) : null}
    </AiSurface>
  );
}
