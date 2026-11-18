import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ApiError, clusterApi, clusterStatusApi, type ClusterModule } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiButton, Badge, Panel, Progress, Skeleton } from '@kube-ai-hub/ui';
import type { LocaleKey } from '@kube-ai-hub/locales';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { GPU_VENDOR_LABEL_KEYS, vendorKey } from './gpuVendors';
import { VendorIcon } from './VendorIcon';

/**
 * 集群状态：the old console's 集群状态 page, mapped onto the monitor page.
 *
 * The old page opened with three blocks before its trend charts: node online
 * status, node accelerator-vendor distribution, and component status. The new
 * monitor page already had every trend; this section restores the three summary
 * blocks the migration had dropped.
 *
 * Three independent reads, one block each, so a failure stays local:
 *
 * - componenthealth (v1alpha2) answers node counts, per-component backends and the
 *   control-plane labels;
 * - nodes/stats (v1alpha3) answers node counts per accelerator vendor;
 * - the etcd ServiceMonitor object answers whether etcd is scraped at all.
 *
 * A block's state is its own: loading skeleton, empty, 403 (retry cannot help),
 * 5xx (retry offered), "not reported" and "not installed" are five different
 * answers and never stand in for one another. The section itself is not tied to
 * the trend queries: the trends failing must not blank the cluster's status.
 */

export interface ClusterStatusSectionProps {
  cluster: string;
  /**
   * Whether the page's 自动刷新 control is on.
   *
   * The switch has to mean one thing for the whole page: the trends already move
   * their window every five seconds, so the status band re-reads at the same cadence
   * instead of becoming "the half of the page that does not refresh". The cluster
   * object is deliberately not polled -- readiness and the installed-module list are
   * register-once information, and re-reading them every tick would be load without a
   * fact attached.
   */
  live: boolean;
}

/** One of the six KubeSphere services, keyed by the namespace health reports. */
interface ServiceSpec {
  namespace: string;
  labelKey: LocaleKey;
  /** 'configz' key that must be enabled; undefined for components the platform always installs. */
  module?: string;
}

/** The six services the old console drew, in its order. */
const SERVICE_COMPONENTS: readonly ServiceSpec[] = [
  { namespace: 'kubesphere-system', labelKey: 'cluster.monitor.status.service.platform' },
  { namespace: 'kube-system', labelKey: 'cluster.monitor.status.service.kubernetes' },
  { namespace: 'istio-system', labelKey: 'cluster.monitor.status.service.istio', module: 'servicemesh' },
  { namespace: 'kubesphere-monitoring-system', labelKey: 'cluster.monitor.status.service.monitoring', module: 'monitoring' },
  { namespace: 'kubesphere-logging-system', labelKey: 'cluster.monitor.status.service.logging', module: 'logging' },
  { namespace: 'kubesphere-devops-system', labelKey: 'cluster.monitor.status.service.devops', module: 'devops' },
];

/** The control-plane names the health endpoint reports through 'label.component'. */
const CORE_COMPONENTS = [
  { key: 'etcd', labelKey: 'cluster.monitor.status.core.etcd' },
  { key: 'controller-manager', labelKey: 'cluster.monitor.status.core.controllerManager', labelValue: 'kube-controller-manager' },
  { key: 'scheduler', labelKey: 'cluster.monitor.status.core.scheduler', labelValue: 'kube-scheduler' },
] as const;

type BadgeTone = React.ComponentProps<typeof Badge>['tone'];

/** What a service row can be, which is not just healthy/unhealthy. */
type ServiceState = 'healthy' | 'unhealthy' | 'not-installed' | 'not-reported';

/** What a core row can be besides the etcd probe. */
type CoreState = 'healthy' | 'unhealthy' | 'not-reported';

/** Whether a configz module is known to be off. Unknown configz never answers "off". */
function moduleInstalled(modules: ClusterModule[] | undefined, key: string | undefined): boolean {
  if (!key) return true;
  if (!modules) return true;
  return modules.some((module) => module.key === key && module.enabled);
}

/**
 * Aggregate one namespace's backends.
 *
 * The endpoint reports **backends**, not components: a Deployment with three
 * replicas contributes 3/3 to its namespace. That is the number the old console's
 * 'counts' table summed ('totalBackends'/'healthyBackends'), and it is what a
 * reader means by "监控 12/12" -- three healthy backends of one component still
 * weigh three, and a component with 0 healthy backends out of 2 must not read
 * as 0/1.
 */
function serviceState(
  health: { namespace: string; healthyBackends?: number; totalBackends?: number }[] | undefined,
  spec: ServiceSpec,
  modules: ClusterModule[] | undefined,
): { state: ServiceState; healthy?: number; total?: number } {
  if (!moduleInstalled(modules, spec.module)) return { state: 'not-installed' };
  const rows = (health ?? []).filter((row) => row.namespace === spec.namespace);
  if (rows.length === 0) return { state: 'not-reported' };
  let healthy = 0;
  let total = 0;
  for (const row of rows) {
    healthy += Number(row.healthyBackends ?? 0);
    total += Number(row.totalBackends ?? 0);
  }
  // A namespace that reported only stopped backends has nothing to call healthy;
  // "0/0 正常" is exactly the claim the old page got wrong on a broken cluster.
  if (total <= 0) return { state: 'not-reported' };
  return { state: healthy === total ? 'healthy' : 'unhealthy', healthy, total };
}

/** controller-manager and scheduler: matched by label, normal only when a backend is healthy. */
function coreState(
  health: { label?: Record<string, string>; healthyBackends?: number }[] | undefined,
  labelValue: string,
): CoreState {
  const rows = (health ?? []).filter((row) => row.label?.['component'] === labelValue);
  if (rows.length === 0) return 'not-reported';
  return rows.some((row) => Number(row.healthyBackends ?? 0) > 0) ? 'healthy' : 'unhealthy';
}

/** A percentage printed with at most one decimal and no trailing '.0'. */
function formatPercent(part: number, whole: number): string {
  if (whole <= 0) return '0%';
  const value = Math.round((part / whole) * 1000) / 10;
  return Number.isInteger(value) ? value.toFixed(0) + '%' : value.toFixed(1) + '%';
}

/** Map a block's detailed state onto the four values an agent surface understands. */
function surfaceStateOf(state: string): 'loading' | 'ready' | 'empty' | 'error' {
  if (state === 'loading') return 'loading';
  if (state === 'error' || state === 'permission') return 'error';
  if (state === 'empty' || state === 'unreported' || state === 'not-reported') return 'empty';
  return 'ready';
}

export function ClusterStatusSection({ cluster, live }: ClusterStatusSectionProps): React.ReactElement {
  const t = useT();

  /*
   * 'status.configz' decides which modules are installed, so the section reads the
   * cluster object itself under the overview's query key. Sharing the identity means
   * navigating between the two pages costs no second request, and a failed detail read
   * is not fatal here: 'modules' stays undefined and the section simply does not claim
   * a module is "not installed" (absence is unknown, not disabled).
   */
  const clusterDetail = useQuery({
    queryKey: ['cluster-detail', cluster],
    queryFn: ({ signal }) => clusterApi(apiClient).get({ cluster, signal }),
  });
  const modules = clusterDetail.data?.modules;

  const componentHealth = useQuery({
    queryKey: ['cluster-status', cluster, 'component-health'],
    queryFn: ({ signal }) => clusterStatusApi(apiClient).componentHealth({ cluster, signal }),
    staleTime: 30_000,
    retry: false,
    refetchInterval: live ? 5000 : false,
  });
  const vendorStats = useQuery({
    queryKey: ['cluster-status', cluster, 'node-vendor-stats'],
    queryFn: ({ signal }) => clusterStatusApi(apiClient).nodeVendorStats({ cluster, signal }),
    staleTime: 30_000,
    retry: false,
    refetchInterval: live ? 5000 : false,
  });
  const etcd = useQuery({
    queryKey: ['cluster-status', cluster, 'etcd-service-monitor'],
    staleTime: 30_000,
    retry: false,
    refetchInterval: live ? 5000 : false,
    queryFn: async ({ signal }): Promise<'monitoring' | 'not-monitored'> => {
      try {
        await clusterStatusApi(apiClient).etcdServiceMonitor({ cluster, signal });
        return 'monitoring';
      } catch (error) {
        // 404 is the answer "not wired into monitoring"; every other failure is a
        // real error the block has to show (403 in particular is not "absent").
        if (error instanceof ApiError && error.isNotFound) return 'not-monitored';
        throw error;
      }
    },
  });

  const nodeStatus = componentHealth.data?.nodeStatus;
  const nodeState = componentHealth.isPending
    ? 'loading'
    : componentHealth.isError
      ? (componentHealth.error instanceof ApiError && componentHealth.error.isPermission ? 'permission' : 'error')
      : nodeStatus?.totalNodes === undefined || nodeStatus?.healthyNodes === undefined
        ? 'unreported'
        : nodeStatus.totalNodes === 0
          ? 'empty'
          : 'ready';

  const vendors = React.useMemo(() => {
    const byKey = new Map<string, number>();
    for (const [raw, count] of Object.entries(vendorStats.data ?? {})) {
      if (raw === 'healthy' || raw === 'total') continue;
      // Normalise the label the same way the node list does ('huawei' is 'ascend',
      // 'CPU' is the CPU case); two spellings for one vendor add up rather than
      // becoming two rows.
      const key = vendorKey(raw) ?? raw;
      byKey.set(key, (byKey.get(key) ?? 0) + count);
    }
    return [...byKey.entries()]
      .filter(([, count]) => count > 0)
      .map(([vendor, count]) => ({ vendor, count }))
      .sort((a, b) => b.count - a.count || a.vendor.localeCompare(b.vendor));
  }, [vendorStats.data]);
  const vendorTotal = vendors.reduce((sum, row) => sum + row.count, 0);
  const vendorState = vendorStats.isPending
    ? 'loading'
    : vendorStats.isError
      ? (vendorStats.error instanceof ApiError && vendorStats.error.isPermission ? 'permission' : 'error')
      : vendors.length === 0
        ? 'empty'
        : 'ready';

  const componentsState = componentHealth.isPending
    ? 'loading'
    : componentHealth.isError
      ? (componentHealth.error instanceof ApiError && componentHealth.error.isPermission ? 'permission' : 'error')
      : 'ready';

  const blocks = [nodeState, vendorState, componentsState];
  const sectionState = blocks.some((state) => state === 'error' || state === 'permission')
    ? 'error'
    : blocks.some((state) => state === 'loading')
      ? 'loading'
      : blocks.every((state) => state === 'empty' || state === 'unreported')
        ? 'empty'
        : 'ready';

  return (
    <section className="flex flex-col gap-2" data-ai-id="cluster-monitor:status" data-ai-state={sectionState}>
      <h2 className="text-sm font-semibold text-ai-fg-secondary">{t('cluster.monitor.status.title')}</h2>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Panel
          title={t('cluster.monitor.status.nodeOnline')}
          icon="nodes"
          data-ai-id="cluster-monitor:status:node-online:card"
          data-ai-state={surfaceStateOf(nodeState)}
          bodyClassName="flex flex-col gap-3"
        >
          {nodeState === 'loading' ? (
            <Skeleton className="h-20 w-full" data-ai-id="cluster-monitor:status:node-online:loading" />
          ) : null}
          {nodeState === 'error' || nodeState === 'permission' ? (
            <BlockError
              prefix="cluster-monitor:status:node-online"
              error={componentHealth.error}
              onRetry={() => void componentHealth.refetch()}
            />
          ) : null}
          {nodeState === 'unreported' ? (
            <div className="flex flex-col gap-1 py-4" data-ai-id="cluster-monitor:status:node-online:unreported">
              <p className="text-sm text-ai-fg-secondary">{t('cluster.monitor.status.notReported')}</p>
              <p className="text-xs text-ai-fg-muted">{t('cluster.monitor.status.nodeUnreportedHint')}</p>
            </div>
          ) : null}
          {nodeState === 'empty' ? (
            <div className="flex flex-col gap-1 py-4" data-ai-id="cluster-monitor:status:node-online:empty">
              <p className="text-sm text-ai-fg-secondary">{t('cluster.monitor.status.nodeEmpty')}</p>
              <p className="text-xs text-ai-fg-muted">{t('cluster.monitor.status.nodeEmptyHint')}</p>
            </div>
          ) : null}
          {nodeState === 'ready' && nodeStatus?.totalNodes !== undefined && nodeStatus.healthyNodes !== undefined ? (
            <NodeOnlineBody cluster={cluster} healthy={nodeStatus.healthyNodes} total={nodeStatus.totalNodes} />
          ) : null}
        </Panel>

        <Panel
          title={t('cluster.monitor.status.vendor')}
          icon="gpu"
          data-ai-id="cluster-monitor:status:vendor:card"
          data-ai-state={surfaceStateOf(vendorState)}
          bodyClassName="flex flex-col gap-3"
        >
          {vendorState === 'loading' ? (
            <Skeleton className="h-20 w-full" data-ai-id="cluster-monitor:status:vendor:loading" />
          ) : null}
          {vendorState === 'error' || vendorState === 'permission' ? (
            <BlockError
              prefix="cluster-monitor:status:vendor"
              error={vendorStats.error}
              onRetry={() => void vendorStats.refetch()}
            />
          ) : null}
          {vendorState === 'empty' ? (
            <div className="flex flex-col gap-1 py-4" data-ai-id="cluster-monitor:status:vendor:empty">
              <p className="text-sm text-ai-fg-secondary">{t('cluster.monitor.status.vendorEmpty')}</p>
              <p className="text-xs text-ai-fg-muted">{t('cluster.monitor.status.vendorEmptyHint')}</p>
            </div>
          ) : null}
          {vendorState === 'ready' ? (
            <ul className="flex flex-col gap-3" data-ai-id="cluster-monitor:status:vendor">
              {vendors.map((row) => (
                <VendorRow key={row.vendor} vendor={row.vendor} count={row.count} total={vendorTotal} />
              ))}
            </ul>
          ) : null}
        </Panel>

        <Panel
          title={t('cluster.monitor.status.components')}
          icon="components"
          data-ai-id="cluster-monitor:status:components"
          data-ai-state={surfaceStateOf(componentsState)}
          bodyClassName="flex flex-col gap-4"
        >
          {componentsState === 'loading' ? (
            <Skeleton className="h-40 w-full" data-ai-id="cluster-monitor:status:components:loading" />
          ) : null}
          {componentsState === 'error' || componentsState === 'permission' ? (
            <BlockError
              prefix="cluster-monitor:status"
              error={componentHealth.error}
              onRetry={() => void componentHealth.refetch()}
            />
          ) : null}
          {componentsState === 'ready' ? (
            <div className="flex flex-col gap-4">
              <section className="flex flex-col gap-1">
                <h3 className="text-xs font-medium text-ai-fg-muted">{t('cluster.monitor.status.serviceTitle')}</h3>
                <ul className="flex flex-col">
                  {SERVICE_COMPONENTS.map((spec) => (
                    <ServiceRow
                      key={spec.namespace}
                      spec={spec}
                      status={serviceState(componentHealth.data?.kubesphereStatus, spec, modules)}
                    />
                  ))}
                </ul>
              </section>
              <section className="flex flex-col gap-1 border-t border-ai-line pt-3">
                <h3 className="text-xs font-medium text-ai-fg-muted">{t('cluster.monitor.status.coreTitle')}</h3>
                <ul className="flex flex-col">
                  {CORE_COMPONENTS.map((core) => (
                    <CoreRow
                      key={core.key}
                      core={core}
                      status={
                        'labelValue' in core
                          ? coreState(componentHealth.data?.kubesphereStatus, core.labelValue)
                          : undefined
                      }
                      etcd={etcd.data}
                      etcdPending={etcd.isPending}
                      etcdError={etcd.error}
                      onEtcdRetry={() => void etcd.refetch()}
                    />
                  ))}
                </ul>
              </section>
            </div>
          ) : null}
        </Panel>
      </div>
    </section>
  );
}

/** The node ratio as the card body, with the way to the node list. */
function NodeOnlineBody({
  cluster,
  healthy,
  total,
}: {
  cluster: string;
  healthy: number;
  total: number;
}): React.ReactElement {
  const t = useT();
  const percent = total > 0 ? (healthy / total) * 100 : 0;
  return (
    <Link
      to="/kube-frontend/clusters/$cluster/nodes"
      params={{ cluster }}
      className="flex flex-col gap-3 rounded-ai-md p-1 transition-colors duration-ai-fast hover:bg-ai-surface-2"
      {...actionProps('cluster-monitor:status:node-online:link')}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums text-ai-fg" data-ai-id="cluster-monitor:status:node-online">
          {healthy}/{total}
        </span>
        <span className="text-sm tabular-nums text-ai-fg-muted" data-ai-id="cluster-monitor:status:node-online:ratio">
          {formatPercent(healthy, total)}
        </span>
      </div>
      <Progress
        value={percent}
        tone={healthy === total ? 'success' : 'warning'}
        label={t('cluster.monitor.status.nodeOnline')}
      />
      <p className="text-xs text-ai-fg-muted">{t('cluster.monitor.status.nodeOnlineHint')}</p>
    </Link>
  );
}

/** One vendor: mark, name, count, share, and the horizontal ratio bar. */
function VendorRow({ vendor, count, total }: {
  vendor: string;
  count: number;
  total: number;
}): React.ReactElement {
  const t = useT();
  const labelKey = vendorKey(vendor);
  const label = t(labelKey ? (GPU_VENDOR_LABEL_KEYS[labelKey] as LocaleKey) : 'node.vendor.unknown');
  const percent = total > 0 ? (count / total) * 100 : 0;
  return (
    <li
      className="flex flex-col gap-1.5"
      data-ai-id={'cluster-monitor:status:vendor:row:' + vendor}
      data-ai-count={count}
    >
      <div className="flex items-center gap-2">
        <VendorIcon vendor={vendor} size={20} className="text-ai-fg-secondary" />
        <span className="min-w-0 flex-1 truncate text-sm text-ai-fg" title={label}>
          {label}
        </span>
        <span className="text-xs tabular-nums text-ai-fg-secondary" data-ai-id={'cluster-monitor:status:vendor:row:' + vendor + ':count'}>
          {count}
        </span>
        <span className="w-14 text-right text-xs tabular-nums text-ai-fg-muted" data-ai-id={'cluster-monitor:status:vendor:row:' + vendor + ':percent'}>
          {formatPercent(count, total)}
        </span>
      </div>
      <Progress value={percent} tone="accent" label={label} />
    </li>
  );
}

const SERVICE_TONE: Record<ServiceState, BadgeTone> = {
  healthy: 'success',
  unhealthy: 'warning',
  'not-installed': 'neutral',
  'not-reported': 'neutral',
};

/** One of the six services: namespace aggregate, or why there is no number. */
function ServiceRow({
  spec,
  status,
}: {
  spec: ServiceSpec;
  status: { state: ServiceState; healthy?: number; total?: number };
}): React.ReactElement {
  const t = useT();
  const label = t(spec.labelKey);
  const text =
    status.state === 'not-installed'
      ? t('cluster.monitor.status.notInstalled')
      : status.state === 'not-reported'
        ? t('cluster.monitor.status.notReported')
        : status.state === 'healthy'
          ? t('cluster.monitor.status.healthy')
          : t('cluster.monitor.status.unhealthy');
  return (
    <li
      className="flex items-center justify-between gap-2 border-b border-ai-line/50 py-1.5 last:border-b-0"
      data-ai-id={'cluster-monitor:status:components:service:' + spec.namespace}
      data-ai-status={status.state}
      title={status.state === 'not-installed' ? t('cluster.monitor.status.notInstalledHint') : undefined}
    >
      <span className="min-w-0 truncate text-sm text-ai-fg">{label}</span>
      <span className="flex shrink-0 items-center gap-2">
        {/*
         * A healthy row prints the ratio alone: '12/12 正常' restates the same fact
         * twice. An unhealthy or absent row keeps the text badge, because there the
         * number is the count and the badge is the verdict -- colour alone would not
         * survive a greyscale screenshot or a screen reader.
         */}
        {status.healthy !== undefined && status.total !== undefined ? (
          <span
            className="text-xs tabular-nums text-ai-fg-secondary"
            title={t('cluster.monitor.status.healthy')}
          >
            {status.healthy}/{status.total}
          </span>
        ) : null}
        {status.state === 'healthy' ? null : <Badge tone={SERVICE_TONE[status.state]}>{text}</Badge>}
      </span>
    </li>
  );
}

/** etcd's probe state; separate from the label-matched control plane. */
type EtcdState = 'loading' | 'monitoring' | 'not-monitored' | 'permission' | 'error';

/** One control-plane row: the two label-matched ones, plus etcd's ServiceMonitor probe. */
function CoreRow({ core, status, etcd, etcdPending, etcdError, onEtcdRetry }: {
  core: (typeof CORE_COMPONENTS)[number];
  /** Undefined for etcd, which is not label-matched. */
  status: CoreState | undefined;
  etcd: 'monitoring' | 'not-monitored' | undefined;
  etcdPending: boolean;
  etcdError: unknown;
  onEtcdRetry: () => void;
}): React.ReactElement {
  const t = useT();
  const label = t(core.labelKey);
  const etcdState: EtcdState | undefined = core.key === 'etcd'
    ? etcdPending
      ? 'loading'
      : etcdError
        ? (etcdError instanceof ApiError && etcdError.isPermission ? 'permission' : 'error')
        : etcd
    : undefined;
  const coreTone: Record<CoreState, BadgeTone> = {
    healthy: 'success',
    unhealthy: 'warning',
    'not-reported': 'neutral',
  };
  const coreText: Record<CoreState, string> = {
    healthy: t('cluster.monitor.status.healthy'),
    unhealthy: t('cluster.monitor.status.unhealthy'),
    'not-reported': t('cluster.monitor.status.notReported'),
  };
  const etcdText: Record<EtcdState, string> = {
    loading: t('common.loading'),
    monitoring: t('cluster.monitor.status.etcd.monitoring'),
    'not-monitored': t('cluster.monitor.status.etcd.notMonitored'),
    permission: t('cluster.monitor.status.etcd.noPermission'),
    error: t('cluster.monitor.status.etcd.failed'),
  };
  const etcdTone: Record<EtcdState, BadgeTone> = {
    loading: 'neutral',
    monitoring: 'success',
    'not-monitored': 'neutral',
    permission: 'warning',
    error: 'danger',
  };
  const rowState = etcdState === undefined
    ? (status ?? 'not-reported')
    : etcdState === 'loading'
      ? 'loading'
      : etcdState === 'monitoring'
        ? 'healthy'
        : etcdState === 'not-monitored'
          ? 'not-reported'
          : etcdState;
  return (
    <li
      className="flex items-center justify-between gap-2 border-b border-ai-line/50 py-1.5 last:border-b-0"
      data-ai-id={'cluster-monitor:status:components:core:' + core.key}
      data-ai-status={rowState}
    >
      <span className="min-w-0 truncate text-sm text-ai-fg">{label}</span>
      <span className="flex shrink-0 items-center gap-2">
        {etcdState !== undefined ? (
          <Badge tone={etcdTone[etcdState]}>{etcdText[etcdState]}</Badge>
        ) : (
          <Badge tone={coreTone[status ?? 'not-reported']}>{coreText[status ?? 'not-reported']}</Badge>
        )}
        {etcdState === 'error' ? (
          <AiButton
            aiId="cluster-monitor:status:components:core:etcd:retry"
            bare
            className="text-xs text-ai-link hover:underline"
            onClick={onEtcdRetry}
          >
            {t('common.retry')}
          </AiButton>
        ) : null}
      </span>
    </li>
  );
}

/** The two failure pictures a block can show: permission (no retry) and failure (retry). */
function BlockError({
  prefix,
  error,
  onRetry,
}: {
  prefix: string;
  error: unknown;
  onRetry: () => void;
}): React.ReactElement {
  const t = useT();
  if (error instanceof ApiError && error.isPermission) {
    return (
      <div
        role="alert"
        className="flex flex-col gap-1 rounded-ai-md border border-ai-line p-4"
        data-ai-id={prefix + ':permission'}
      >
        <p className="text-sm font-medium text-ai-fg">{t('cluster.monitor.status.permission')}</p>
        <p className="text-xs leading-5 text-ai-fg-muted">{t('cluster.monitor.status.permissionHint')}</p>
      </div>
    );
  }
  return (
    <div data-ai-id={prefix + ':error'}>
      <ResourceErrorPanel error={error} onRetry={onRetry} retryAiId={prefix + ':retry'} />
    </div>
  );
}
