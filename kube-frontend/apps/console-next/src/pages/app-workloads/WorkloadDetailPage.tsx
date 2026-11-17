import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiButton, AiSurface, Badge, Button, Icon, Skeleton, cn } from '@kube-ai-hub/ui';
import {
  objectEventsApi,
  type PodEvent,
  type WorkloadDetail,
  type WorkloadKind,
  type WorkloadRevision,
} from '@kube-ai-hub/api-client';
import { useLocale, type LocaleKey } from '@/i18n';
import { api as apiClient } from '@/api';
import {
  useDeleteWorkload,
  useRestartWorkload,
  useRollbackWorkload,
  useScaleWorkload,
  useUpdateWorkload,
  useWorkload,
  useWorkloadAutoscaling,
  useJobRuns,
  useWorkloadPods,
  useWorkloadService,
  useWorkloadRevisions,
  type WorkloadDescriptor,
} from './queries';
import { EditInfoDialog } from '@/components/resource/EditInfoDialog';
import { ReplicasDialog } from './ReplicasDialog';
import { WorkloadMonitorPanel } from './WorkloadMonitorPanel';
import { EditWorkloadDialog } from './EditWorkloadDialog';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { LoadingDialog } from '@/components/resource/LoadingDialog';
import { ResourceErrorPanel, MutationAlert } from '@/components/resource/ResourceErrorPanel';
import { YamlDialog } from '@/components/resource/YamlDialog';
import { toYaml } from '@/components/resource/yaml';
import { formatTimestamp } from '@/lib/time';
import { statusLabel } from '@/lib/status';
import { DefinitionRow as Row } from '@/components/resource/DefinitionRow';

/**
 * The detail view shared by every application workload.
 *
 * The old console splits a workload's detail into tabs — overview, the pods it runs,
 * its revisions, its events and its metadata — instead of one long column. Tabs are
 * the same shape here, but the data does not change: every query stays at the top of
 * this component, so switching a tab only swaps the panel and never refetches.
 *
 * `replicas`, `images` and the status badge come from the same derivation
 * the list uses — one source, so the two screens cannot disagree about whether a
 * deployment is running.
 *
 * Actions: 编辑 YAML (all kinds), 编辑设置 (the three controllers and CronJobs),
 * 重新部署 (the three controllers that run pods directly), 删除. 扩缩容 and 编辑信息
 * are separate dialogs because they need a form surface the workload kinds do not
 * share; 编辑设置 is the narrow template form described in `edit-form.md`.
 */
/** Container names a pod actually runs; an empty list for anything else. */
function podContainers(detail: WorkloadDetail): string[] {
  const raw = detail.raw as unknown as { spec?: { containers?: Array<{ name?: string }> } };
  return (raw.spec?.containers ?? []).map((container) => String(container.name ?? '')).filter(Boolean);
}

/** One tab of the detail page. Not every kind shows every tab. */
type DetailTab = 'overview' | 'monitor' | 'pods' | 'revisions' | 'containers' | 'events' | 'metadata';

/** Kinds whose detail lists the pods they run, matching `useWorkloadPods`' enablement. */
const POD_OWNING_KINDS: WorkloadKind[] = ['deployments', 'statefulsets', 'daemonsets', 'services'];

/**
 * Kinds whose detail page has a monitor tab.
 *
 * The monitoring API only has workload-level metrics for deployment / statefulset /
 * daemonset (the path kind is mapped to a `workload=~"<Kind>:(...)"` selector); pods
 * have their own pod-level series. Jobs and cronjobs have no workload-level metric,
 * so they get no tab rather than a tab that would only ever say "unavailable".
 */
const MONITORED_WORKLOAD_KINDS: WorkloadKind[] = ['deployments', 'statefulsets', 'daemonsets'];

/** The `involvedObject.kind` an event query filters on, per resource. */
const EVENT_OBJECT_KINDS: Record<WorkloadKind, string> = {
  deployments: 'Deployment',
  statefulsets: 'StatefulSet',
  daemonsets: 'DaemonSet',
  jobs: 'Job',
  cronjobs: 'CronJob',
  pods: 'Pod',
  services: 'Service',
  ingresses: 'Ingress',
};

/**
 * The tabs a kind shows.
 *
 * The old console gives a Deployment five tabs and a Pod four; the rules are the same
 * shape for every workload: the overview is always there, the pod list only where the
 * kind owns pods, revisions only where the controller keeps them, and events and
 * metadata everywhere.
 */
function tabsFor(kind: WorkloadKind): DetailTab[] {
  if (kind === 'pods') return ['overview', 'monitor', 'containers', 'events', 'metadata'];
  const tabs: DetailTab[] = ['overview'];
  if (MONITORED_WORKLOAD_KINDS.includes(kind)) tabs.push('monitor');
  if (POD_OWNING_KINDS.includes(kind)) tabs.push('pods');
  if (kind === 'deployments') tabs.push('revisions');
  tabs.push('events', 'metadata');
  return tabs;
}

/** The locale key behind each tab's label, so the translation stays in the dictionary. */
const TAB_LABEL_KEYS: Record<DetailTab, LocaleKey> = {
  overview: 'workloads.detail.tab.overview',
  monitor: 'workloads.detail.tab.monitor',
  pods: 'workloads.detail.tab.pods',
  revisions: 'workloads.detail.tab.revisions',
  containers: 'workloads.detail.tab.containers',
  events: 'workloads.detail.tab.events',
  metadata: 'workloads.detail.tab.metadata',
};

/**
 * One metadata block: the labels or annotations of the object, as key/value rows.
 *
 * Labels and annotations are user data, not schema fields, so the key is printed as
 * the label and there is nothing to translate inside it.
 */
function MetadataBlock({
  aiId,
  title,
  entries,
  empty,
}: {
  aiId: string;
  title: string;
  entries: Record<string, string>;
  empty: string;
}): React.ReactElement {
  const rows = Object.entries(entries);
  return (
    <section className="rounded-ai-md border border-ai-line p-4" data-ai-id={aiId}>
      <h2 className="mb-3 text-sm font-medium text-ai-fg">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-xs text-ai-fg-muted">{empty}</p>
      ) : (
        <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-[minmax(6rem,auto)_1fr]">
          {rows.map(([key, value]) => (
            <Row key={key} label={key} value={value || '-'} />
          ))}
        </dl>
      )}
    </section>
  );
}

export interface WorkloadDetailPageProps {
  descriptor: WorkloadDescriptor;
  /** Needed to build links to other pages; the route always carries it. */
  workspace: string;
  cluster: string;
  namespace: string;
  name: string;
}

type Dialog = 'none' | 'loading' | 'editYaml' | 'delete' | 'editInfo' | 'scale' | 'editSettings';

export function WorkloadDetailPage({ descriptor, workspace, cluster, namespace, name }: WorkloadDetailPageProps): React.ReactElement {
  const { t } = useLocale();
  const kind: WorkloadKind = descriptor.kind;
  const navigate = useNavigate();
  const query = useWorkload(kind, { cluster, namespace, name });
  const update = useUpdateWorkload(kind, { cluster, namespace });
  const remove = useDeleteWorkload(kind, { cluster, namespace });
  const restart = useRestartWorkload(kind, { cluster, namespace });
  const scale = useScaleWorkload(kind, { cluster, namespace });
  const autoscaling = useWorkloadAutoscaling(kind, { cluster, namespace, name });
  const revisions = useWorkloadRevisions(kind, { cluster, namespace, name });
  const pods = useWorkloadPods(kind, { cluster, namespace, name });
  const governing = useWorkloadService(kind, { cluster, namespace, name });
  const runs = useJobRuns(kind, { cluster, namespace, name });
  const rollback = useRollbackWorkload(kind, { cluster, namespace });
  const [rollbackTarget, setRollbackTarget] = React.useState<WorkloadRevision | null>(null);
  const [dialog, setDialog] = React.useState<Dialog>('none');
  const [activeTab, setActiveTab] = React.useState<DetailTab>('overview');

  const detail = query.data;

  // Fetched at the top like every other query: the events tab reads this cache when it
  // is opened, and switching between tabs never starts a request of its own.
  const events = useQuery({
    queryKey: ['object-events', kind, namespace, name],
    queryFn: ({ signal }) =>
      objectEventsApi(apiClient).list({ cluster, namespace, name, kind: EVENT_OBJECT_KINDS[kind], signal }),
  });

  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';

  const back = useBackTo(kind);

  const tabs = React.useMemo(() => tabsFor(kind), [kind]);
  // If the route ever reuses this component for another kind, the remembered tab may
  // not exist there; falling back to the first tab keeps the panel rendered.
  const active = tabs.includes(activeTab) ? activeTab : tabs[0];

  /** The workload's derived status (running/stopped/…), not a raw API phase. */
  const workloadStatusLabel = (status: string): string => {
    const key = descriptor.statusKeys[status];
    return key ? t(key) : status;
  };

  return (
    <AiSurface as="section" aiId={`${kind}-detail:surface`} state={state} className="flex min-w-0 flex-col gap-4">
      <div>
        <a
          href={back}
          className="inline-flex items-center gap-1 text-xs text-ai-link hover:underline"
          {...actionProps(`${kind}-detail:back`)}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
            event.preventDefault();
            void navigate({ href: back });
          }}
        >
          <Icon name="chevron-left" size={12} />
          {t(descriptor.titleKey)}
        </a>
      </div>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}

      {state === 'error' ? (
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId={`${kind}-detail:retry`} />
      ) : null}

      {detail ? (
        <>
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-semibold text-ai-fg">{detail.alias || detail.name}</h1>
                {descriptor.showStatus && detail.status ? (
                  <Badge tone={detail.status === 'running' ? 'success' : detail.status === 'updating' ? 'warning' : 'neutral'}>
                    {workloadStatusLabel(detail.status)}
                  </Badge>
                ) : null}
                {detail.federated ? <Badge tone="info">{t('resource.federated')}</Badge> : null}
              </div>
              {detail.alias ? <p className="text-xs text-ai-fg-muted">{detail.name}</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Same operations the old console's detail offered, in its order. */}
              <AiButton aiId={`${kind}-detail:edit-info`} size="sm" variant="secondary" onClick={() => setDialog('editInfo')}>
                {t('resource.action.editInfo')}
              </AiButton>
              {descriptor.allowEditSettings ? (
                <Button
                  variant="secondary"
                  size="sm"
                  {...actionProps(`${kind}-detail:edit-settings`)}
                  onClick={() => setDialog('editSettings')}
                >
                  {t('resource.action.editSettings')}
                </Button>
              ) : null}
              {descriptor.allowScale ? (
                <AiButton aiId={`${kind}-detail:scale`} size="sm" variant="secondary" onClick={() => setDialog('scale')}>
                  {t('workloads.action.scale')}
                </AiButton>
              ) : null}
              {descriptor.allowRedeploy ? (
                <AiButton
                  aiId={`${kind}-detail:redeploy`}
                  size="sm"
                  variant="secondary"
                  // Restarting is a write: the loading frame covers the request so
                  // the button never looks dead while the pod template is patched.
                  onClick={() => {
                    setDialog('loading');
                    restart.mutate(name, { onSettled: () => setDialog('none') });
                  }}
                >
                  {t('workloads.action.redeploy')}
                </AiButton>
              ) : null}
              <Button variant="ghost" size="sm" {...actionProps(`${kind}-detail:edit-yaml`)} onClick={() => setDialog('editYaml')}>
                {t('resource.action.editYaml')}
              </Button>
              {descriptor.allowDelete === false ? null : (
                <AiButton aiId={`${kind}-detail:delete`} size="sm" variant="danger" onClick={() => setDialog('delete')}>
                  {t('common.delete')}
                </AiButton>
              )}
            </div>
          </header>

          {/*
            * The tab bar. The ui package does not export a Tabs primitive yet, so the
            * triggers are Buttons with the ARIA tab roles — a plain button element is
            * forbidden here by the page contract, and this way the appearance stays
            * the design system's.
            */}
          <div role="tablist" aria-label={t(descriptor.titleKey)} className="flex flex-wrap gap-1 border-b border-ai-line">
            {tabs.map((tab) => {
              const selected = tab === active;
              return (
                <Button
                  key={tab}
                  role="tab"
                  size="sm"
                  variant="ghost"
                  id={`workload-detail-tab-${tab}`}
                  aria-selected={selected}
                  aria-controls={`workload-detail-panel-${tab}`}
                  data-ai-id={`workload-detail:tab-trigger:${tab}`}
                  className={cn(
                    'rounded-none border-b-2 px-3',
                    selected ? 'border-ai-accent text-ai-accent' : 'border-transparent text-ai-fg-muted',
                  )}
                  onClick={() => setActiveTab(tab)}
                >
                  {t(TAB_LABEL_KEYS[tab])}
                </Button>
              );
            })}
          </div>

          {/* 概览: what the object is and how it is configured. */}
          {active === 'overview' ? (
            <div
              role="tabpanel"
              id="workload-detail-panel-overview"
              aria-labelledby="workload-detail-tab-overview"
              data-ai-id="workload-detail:tab:overview"
              className="flex flex-col gap-4"
            >
              <section className="rounded-ai-md border border-ai-line p-4">
                <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('workloads.detail.attributes')}</h2>
                <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-[minmax(6rem,auto)_1fr]">
                  <Row label={t('workloads.field.cluster')} value={cluster} />
                  <Row label={t('workloads.field.project')} value={detail.namespace || namespace} />
                  <Row label={t('workloads.field.app')} value={detail.app || '-'} />
                  {descriptor.showProgress ? (
                    <Row
                      label={t('workloads.field.replicas')}
                      value={detail.total === undefined ? '-' : `${detail.ready ?? 0}/${detail.total}`}
                    />
                  ) : null}
                  <Row label={t('workloads.field.createdAt')} value={formatTimestamp(detail.createdAt)} />
                  <Row label={t('workloads.field.creator')} value={detail.creator || '-'} />
                  {/*
                   * Kind-specific rows, in the old console's order: a pod shows its node,
                   * IPs, QoS and restarts; a service shows its type, addresses and
                   * selector. Rendering them from a list keeps this page free of per-kind
                   * branches.
                   */}
                  {detail.attributes.map((attribute) => (
                    <Row
                      key={attribute.key}
                      label={t(`workloads.field.${attribute.key}` as never)}
                      // The pod's phase is a raw API enum; every other attribute is already
                      // human-readable (an IP, a QoS class, a node name).
                      value={
                        attribute.key === 'podStatus' && attribute.value
                          ? statusLabel(t, attribute.value)
                          : attribute.value || '-'
                      }
                    />
                  ))}
                </dl>
              </section>

              {/*
                * 自动伸缩: the old console shows this block only when an autoscaler exists,
                * because there is nothing to report otherwise. The same rule here — a
                * "no autoscaling" row would be noise on every workload.
                */}
              {autoscaling.data?.exists ? (
                <section className="rounded-ai-md border border-ai-line p-4" data-ai-id={`${kind}-detail:autoscaling`}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-medium text-ai-fg">{t('workloads.detail.autoscaling')}</h2>
                    <Badge tone={autoscaling.data.active ? 'success' : 'warning'}>
                      {autoscaling.data.active ? t('workloads.detail.autoscalingActive') : t('workloads.detail.autoscalingInactive')}
                    </Badge>
                  </div>
                  <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-[minmax(6rem,auto)_1fr]">
                    <Row label={t('workloads.field.autoscalingName')} value={autoscaling.data.name} />
                    <Row
                      label={t('workloads.field.replicas')}
                      value={`${autoscaling.data.minReplicas} – ${autoscaling.data.maxReplicas}`}
                    />
                    <Row label={t('workloads.field.currentReplicas')} value={String(autoscaling.data.currentReplicas)} />
                    <Row
                      label={t('workloads.field.metrics')}
                      value={autoscaling.data.metrics.length === 0 ? '-' : autoscaling.data.metrics.join(', ')}
                    />
                  </dl>
                </section>
              ) : null}

              {/*
                * 端口: a service's ports answer "how does traffic reach it" — the service
                * port maps to a container port, and for NodePort/LoadBalancer there is a
                * node port as well. The old console shows the same three columns.
                */}
              {kind === 'services' && detail.ports.length > 0 ? (
                <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="services-detail:ports">
                  <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('workloads.detail.ports')}</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-ai-fg-muted">
                          <th className="pb-2 pr-4 font-medium">{t('workloads.field.portName')}</th>
                          <th className="pb-2 pr-4 font-medium">{t('workloads.field.servicePort')}</th>
                          <th className="pb-2 pr-4 font-medium">{t('workloads.field.containerPort')}</th>
                          <th className="pb-2 font-medium">{t('workloads.field.nodePort')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.ports.map((port, index) => (
                          <tr key={`${port.name}-${index}`} className="border-t border-ai-line" data-ai-row={`port-${index}`}>
                            <td className="py-1.5 pr-4 font-mono text-[11px] text-ai-fg-secondary">{port.name || '-'}</td>
                            <td className="py-1.5 pr-4 tabular-nums text-ai-fg">{port.port}</td>
                            <td className="py-1.5 pr-4 tabular-nums text-ai-fg-secondary">{port.targetPort || '-'}</td>
                            <td className="py-1.5 tabular-nums text-ai-fg-secondary">{port.nodePort ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              {/*
                * 执行记录: a Job's history is the pods it started — each retry is another
                * pod, and its phase and exit code are the answer to "why did this fail".
                * The old console numbers the runs, which is what makes "the third retry is
                * the one that broke" readable.
                */}
              {kind === 'jobs' && (runs.data?.length ?? 0) > 0 ? (
                <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="jobs-detail:runs">
                  <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('workloads.detail.runs')}</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-ai-fg-muted">
                          <th className="pb-2 pr-4 font-medium">{t('workloads.field.runIndex')}</th>
                          <th className="pb-2 pr-4 font-medium">{t('workloads.field.podName')}</th>
                          <th className="pb-2 pr-4 font-medium">{t('workloads.field.podStatus')}</th>
                          <th className="pb-2 pr-4 font-medium">{t('workloads.field.exitCode')}</th>
                          <th className="pb-2 pr-4 font-medium">{t('workloads.field.startedAt')}</th>
                          <th className="pb-2 font-medium">{t('workloads.field.finishedAt')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(runs.data ?? []).map((run) => (
                          <tr key={run.pod} className="border-t border-ai-line" data-ai-row={`run-${run.index}`}>
                            <td className="py-1.5 pr-4 tabular-nums text-ai-fg-secondary">{run.index}</td>
                            <td className="py-1.5 pr-4">
                              <a
                                href={`/kube-frontend/${workspace}/clusters/${cluster}/projects/${namespace}/pods/${run.pod}`}
                                className="inline-flex min-h-6 items-center font-mono text-[11px] text-ai-link hover:underline"
                                {...actionProps(`jobs-detail:run-pod:${run.index}`)}
                                data-ai-id={`jobs-detail:run-pod:${run.index}`}
                              >
                                {run.pod}
                              </a>
                            </td>
                            <td className="py-1.5 pr-4">
                              <Badge tone={run.phase === 'Succeeded' ? 'success' : run.phase === 'Failed' ? 'danger' : 'warning'}>
                                {run.phase ? statusLabel(t, run.phase) : '-'}
                              </Badge>
                              {run.reason ? <span className="ml-1.5 text-[11px] text-ai-fg-muted">{run.reason}</span> : null}
                            </td>
                            <td className="py-1.5 pr-4 tabular-nums text-ai-fg-secondary">{run.exitCode}</td>
                            <td className="py-1.5 pr-4 tabular-nums text-ai-fg-muted">{run.startTime ? formatTimestamp(run.startTime) : '-'}</td>
                            <td className="py-1.5 tabular-nums text-ai-fg-muted">{run.endTime ? formatTimestamp(run.endTime) : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              {/*
                * 关联服务: a StatefulSet's `spec.serviceName` names the service that
                * governs its pod DNS. The relationship is declared, not inferred from a
                * selector, so this block reports exactly what the field says — including
                * when it names a service that does not exist, which is a common
                * configuration mistake.
                */}
              {kind === 'statefulsets' && governing.data?.name ? (
                <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="statefulsets-detail:service">
                  <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('workloads.detail.service')}</h2>
                  {governing.data.exists ? (
                    <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-[minmax(6rem,auto)_1fr]">
                      <Row label={t('workloads.field.serviceName')} value={governing.data.name} />
                      <Row label={t('workloads.field.serviceType')} value={governing.data.type} />
                      <Row label={t('workloads.field.clusterIP')} value={governing.data.clusterIP || '-'} />
                      <Row label={t('workloads.detail.ports')} value={governing.data.ports.join(', ') || '-'} />
                    </dl>
                  ) : (
                    // Naming a missing service breaks pod DNS without failing the apply.
                    <p className="text-xs text-ai-danger" data-ai-id="statefulsets-detail:service-missing">
                      {t('workloads.service.missing', { name: governing.data.name })}
                    </p>
                  )}
                </section>
              ) : null}

              {/*
                * 容器镜像: a controller's template has no page of its own, so its images
                * stay on the overview as a plain list. A pod's containers get their own
                * tab, because each one leads to its container page.
                */}
              {kind !== 'pods' && detail.images.length > 0 ? (
                <section className="rounded-ai-md border border-ai-line p-4" data-ai-id={`${kind}-detail:containers`}>
                  <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('workloads.detail.containers')}</h2>
                  <ul className="flex flex-col gap-2">
                    {detail.images.map((image) => (
                      <li
                        key={image}
                        className="overflow-x-auto whitespace-nowrap rounded-ai-sm border border-ai-line px-2 py-1.5 font-mono text-[11px] text-ai-fg-muted"
                        data-ai-row={image}
                      >
                        {image}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          ) : null}

          {/* 监控: CPU and memory over time, one panel shared by workloads and pods. */}
          {active === 'monitor' ? (
            <div
              role="tabpanel"
              id="workload-detail-panel-monitor"
              aria-labelledby="workload-detail-tab-monitor"
              data-ai-id="workload-detail:tab:monitor"
              className="flex flex-col gap-4"
            >
              <WorkloadMonitorPanel cluster={cluster} namespace={namespace} kind={kind} name={name} />
            </div>
          ) : null}

          {/* 关联容器组: the pods this workload actually runs. */}
          {active === 'pods' ? (
            <div
              role="tabpanel"
              id="workload-detail-panel-pods"
              aria-labelledby="workload-detail-tab-pods"
              data-ai-id="workload-detail:tab:pods"
              className="flex flex-col gap-4"
            >
              {pods.isPending ? <Skeleton className="h-24 w-full" /> : null}
              {(pods.data?.length ?? 0) > 0 ? (
                <section className="rounded-ai-md border border-ai-line p-4" data-ai-id={`${kind}-detail:pods`}>
                  <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('workloads.detail.pods')}</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-ai-fg-muted">
                          <th className="pb-2 pr-4 font-medium">{t('workloads.field.podName')}</th>
                          <th className="pb-2 pr-4 font-medium">{t('workloads.field.podStatus')}</th>
                          <th className="pb-2 pr-4 font-medium">{t('workloads.field.node')}</th>
                          <th className="pb-2 pr-4 font-medium">{t('workloads.field.restarts')}</th>
                          <th className="pb-2 font-medium">{t('workloads.field.createdAt')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(pods.data ?? []).map((pod) => (
                          <tr key={pod.name} className="border-t border-ai-line" data-ai-row={pod.name}>
                            <td className="py-1.5 pr-4">
                              {/*
                               * A pod row is the usual way into that pod's own page — the
                               * question "why is this one unhealthy" is answered there.
                               */}
                              <a
                                href={`/kube-frontend/${workspace}/clusters/${cluster}/projects/${namespace}/pods/${pod.name}`}
                                className="inline-flex min-h-6 items-center font-mono text-[11px] text-ai-link hover:underline"
                                {...actionProps(`deployments-detail:pod:${pod.name}`)}
                                data-ai-id={`${kind}-detail:pod:${pod.name}`}
                              >
                                {pod.name}
                              </a>
                            </td>
                            <td className="py-1.5 pr-4">
                              <Badge tone={pod.terminating ? 'neutral' : pod.phase === 'Running' ? 'success' : 'warning'}>
                                {pod.terminating ? t('workloads.pod.terminating') : pod.phase ? statusLabel(t, pod.phase) : '-'}
                              </Badge>
                            </td>
                            <td className="py-1.5 pr-4 text-ai-fg-secondary">{pod.node || '-'}</td>
                            <td className="py-1.5 pr-4 tabular-nums text-ai-fg-secondary">{pod.restarts}</td>
                            <td className="py-1.5 tabular-nums text-ai-fg-muted">{formatTimestamp(pod.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}

          {/* 修订版本: a Deployment keeps one ReplicaSet per revision; rolling back restores one. */}
          {active === 'revisions' ? (
            <div
              role="tabpanel"
              id="workload-detail-panel-revisions"
              aria-labelledby="workload-detail-tab-revisions"
              data-ai-id="workload-detail:tab:revisions"
              className="flex flex-col gap-4"
            >
              {revisions.isPending ? <Skeleton className="h-24 w-full" /> : null}
              {(revisions.data?.length ?? 0) > 0 ? (
                <section className="rounded-ai-md border border-ai-line p-4" data-ai-id={`${kind}-detail:revisions`}>
                  <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('workloads.detail.revisions')}</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-ai-fg-muted">
                          <th className="pb-2 pr-4 font-medium">{t('workloads.field.revision')}</th>
                          <th className="pb-2 pr-4 font-medium">{t('workloads.detail.containers')}</th>
                          <th className="pb-2 pr-4 font-medium">{t('workloads.field.replicas')}</th>
                          <th className="pb-2 pr-4 font-medium">{t('workloads.field.createdAt')}</th>
                          <th className="pb-2 font-medium">{t('workloads.field.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(revisions.data ?? []).map((revision) => (
                          <tr key={revision.replicaSet} className="border-t border-ai-line" data-ai-row={`rev-${revision.revision}`}>
                            <td className="py-1.5 pr-4 tabular-nums text-ai-fg">
                              {revision.revision}
                              {revision.current ? (
                                <span className="ml-1.5 rounded-ai-sm bg-ai-accent/10 px-1 text-[10px] text-ai-accent">
                                  {t('workloads.revision.current')}
                                </span>
                              ) : null}
                            </td>
                            <td className="py-1.5 pr-4 font-mono text-[11px] text-ai-fg-secondary">{revision.images.join(', ') || '-'}</td>
                            <td className="py-1.5 pr-4 tabular-nums text-ai-fg-secondary">{revision.replicas}</td>
                            <td className="py-1.5 pr-4 tabular-nums text-ai-fg-muted">{formatTimestamp(revision.createdAt)}</td>
                            <td className="py-1.5">
                              {/* Rolling back to the revision you are on would be a no-op. */}
                              {revision.current ? null : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  {...actionProps(`deployments-detail:rollback-${revision.revision}`)}
                                  onClick={() => setRollbackTarget(revision)}
                                >
                                  {t('workloads.action.rollback')}
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}

          {/* 容器: a pod's containers, each row the way into that container's page. */}
          {active === 'containers' ? (
            <div
              role="tabpanel"
              id="workload-detail-panel-containers"
              aria-labelledby="workload-detail-tab-containers"
              data-ai-id="workload-detail:tab:containers"
              className="flex flex-col gap-4"
            >
              <section className="rounded-ai-md border border-ai-line p-4" data-ai-id={`${kind}-detail:containers`}>
                <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('workloads.detail.containers')}</h2>
                <ul className="flex flex-col gap-2">
                  {podContainers(detail).map((containerName) => (
                    <li key={containerName} data-ai-row={containerName}>
                      <a
                        href={`/kube-frontend/${workspace}/clusters/${cluster}/projects/${namespace}/pods/${name}/containers/${containerName}`}
                        className="inline-flex min-h-6 items-center font-mono text-[11px] text-ai-link hover:underline"
                        data-ai-id={`${kind}-detail:container:${containerName}`}
                      >
                        {containerName}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          ) : null}

          {/* 事件: the events Kubernetes recorded against this object. */}
          {active === 'events' ? (
            <div
              role="tabpanel"
              id="workload-detail-panel-events"
              aria-labelledby="workload-detail-tab-events"
              data-ai-id="workload-detail:tab:events"
              className="flex flex-col gap-4"
            >
              <section className="rounded-ai-md border border-ai-line p-4" data-ai-id={`${kind}-detail:events`}>
                <h2 className="mb-3 text-sm font-medium text-ai-fg">
                  {t('workloads.detail.events')} ({events.data?.length ?? 0})
                </h2>
                {events.isPending ? <Skeleton className="h-16 w-full" /> : null}
                {events.isError ? (
                  <p className="text-xs text-ai-fg-muted">{t('workloads.detail.eventsUnavailable')}</p>
                ) : null}
                {events.data && events.data.length === 0 ? (
                  <p className="text-xs text-ai-fg-muted">{t('workloads.detail.noEvents')}</p>
                ) : null}
                {events.data && events.data.length > 0 ? (
                  <ul className="flex flex-col divide-y divide-ai-line text-xs" data-ai-id={`${kind}-detail:event-list`}>
                    {events.data.map((event: PodEvent, index: number) => (
                      <li key={`${event.reason}-${index}`} className="flex flex-col gap-1 py-1.5" data-ai-row={`${event.reason}-${index}`}>
                        <span className="flex flex-wrap items-center gap-2">
                          <Badge tone={event.type === 'Warning' ? 'warning' : 'neutral'}>{event.type || '-'}</Badge>
                          <span className="font-medium text-ai-fg">{event.reason}</span>
                        </span>
                        <span className="text-ai-fg-muted">{event.message}</span>
                        <span className="text-ai-fg-muted">
                          {[event.source, event.count > 1 ? `x${event.count}` : '', formatTimestamp(event.lastSeen)]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            </div>
          ) : null}

          {/* 元数据: the labels and annotations a user put on the object. */}
          {active === 'metadata' ? (
            <div
              role="tabpanel"
              id="workload-detail-panel-metadata"
              aria-labelledby="workload-detail-tab-metadata"
              data-ai-id="workload-detail:tab:metadata"
              className="flex flex-col gap-4"
            >
              <MetadataBlock
                aiId={`${kind}-detail:labels`}
                title={t('metadata.labels')}
                entries={detail.labels}
                empty={t('metadata.noLabels')}
              />
              <MetadataBlock
                aiId={`${kind}-detail:annotations`}
                title={t('metadata.annotations')}
                entries={detail.annotations}
                empty={t('metadata.noAnnotations')}
              />
            </div>
          ) : null}
        </>
      ) : null}

      <MutationAlert error={update.error ?? remove.error ?? restart.error ?? scale.error} />

      <LoadingDialog open={dialog === 'loading'} title={t('workloads.action.redeploy')} subject={name} />

      {dialog === 'editInfo' && detail ? (
        <EditInfoDialog
          open
          onOpenChange={(open) => !open && setDialog('none')}
          resource={`${kind}-detail`}
          name={detail.name}
          alias={detail.alias}
          description={detail.description}
          annotations={detail.annotations}
          pending={update.isPending}
          onSubmit={async (annotations) => {
            // `update()` derives the object name from `body.metadata.name`; a bare
            // annotation patch has no name and would be PUT to the collection URL.
            await update.mutateAsync({ ...detail.raw, metadata: { ...detail.raw.metadata, annotations } });
            setDialog('none');
          }}
        />
      ) : null}

      {dialog === 'editSettings' && detail ? (
        <EditWorkloadDialog
          open
          onOpenChange={(open) => !open && setDialog('none')}
          cluster={cluster}
          kind={kind}
          detail={detail}
          pending={update.isPending}
          onSubmit={async (body) => {
            // The dialog keeps itself open on failure, so an error (409 included) is
            // read where the fields are, not in a banner behind the modal.
            await update.mutateAsync(body);
            setDialog('none');
          }}
        />
      ) : null}

      {dialog === 'scale' && detail ? (
        <ReplicasDialog
          open
          onOpenChange={(open) => !open && setDialog('none')}
          current={detail.total ?? 0}
          pending={scale.isPending}
          onSubmit={async (replicas) => {
            await scale.mutateAsync({ name: detail.name, replicas });
            setDialog('none');
          }}
        />
      ) : null}

      {dialog === 'editYaml' && detail ? (
        <YamlDialog
          open
          onOpenChange={(open) => !open && setDialog('none')}
          initialYaml={toYaml(detail.raw)}
          lockName={detail.name}
          title={t('resource.action.editYaml')}
          submitLabel={t('common.confirm')}
          pending={update.isPending}
          onSubmit={async (object) => {
            await update.mutateAsync(object as never);
            setDialog('none');
          }}
        />
      ) : null}

      {rollbackTarget ? (
        // A rollback restarts every pod at once; it gets the same confirmation as a
        // destructive action rather than firing on one click from a table row.
        <DeleteDialog
          open
          onOpenChange={(open) => !open && setRollbackTarget(null)}
          names={[detail?.name ?? name]}
          resource={kind}
          noun={t('workloads.action.rollback')}
          title={t('workloads.action.rollback')}
          confirmLabel={t('workloads.action.rollback')}
          pending={rollback.isPending}
          onConfirm={async () => {
            await rollback.mutateAsync({ name: detail?.name ?? name, replicaSet: rollbackTarget.replicaSet });
            setRollbackTarget(null);
          }}
        />
      ) : null}

      {dialog === 'delete' ? (
        <DeleteDialog
          open
          onOpenChange={(open) => !open && setDialog('none')}
          names={[name]}
          resource={kind}
          noun={t(descriptor.titleKey)}
          pending={remove.isPending}
          onConfirm={async () => {
            await remove.mutateAsync([name]);
            setDialog('none');
            void navigate({ href: back });
          }}
        />
      ) : null}
    </AiSurface>
  );
}

/** The list URL, derived from the current scope so a detail page can always go back. */
function useBackTo(kind: WorkloadKind): string {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const match = /^(\/kube-frontend\/[^/]+\/clusters\/[^/]+\/projects\/[^/]+)\//.exec(pathname);
  const root = match?.[1] ?? '/';
  return `${root}/${kind}`;
}
