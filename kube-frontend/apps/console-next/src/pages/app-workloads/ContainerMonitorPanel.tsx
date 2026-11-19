import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { rangeMetricsApi, type MetricSeries } from '@kube-ai-hub/api-client';
import { actionProps, surfaceProps, type AiSurfaceState } from '@kube-ai-hub/ai-surface';
import { Button } from '@kube-ai-hub/ui';
import { ChartSkeleton, TimeSeriesChart } from '@kube-ai-hub/ui/charts';
import { useT, type LocaleKey } from '@/i18n';
import { api as apiClient } from '@/api';

/**
 * 容器详情「监控」页签：GPU 使用 / GPU 显存 / CPU / 内存四条曲线。
 *
 * 旧 console 的容器详情监控页签（`Pods/Containers/Monitoring.jsx`）读的就是这四个
 * 指标，容器放在**请求路径**里而不是查询参数里；时间窗沿用工作负载监控页签的
 * 1h/6h/24h。三档窗口的步长在这里定，页面不传。
 *
 * 三态分开，与 WorkloadMonitorPanel 同一套判断（那个面板是工作负载/容器组作用域，
 * 这里是容器作用域 + 四条固定指标，共用组件会把两种作用域塞进一个 props 里）：
 * - 请求失败 → 「监控不可用」+ 重试：集群可能没装监控组件，这不是「没有数据」；
 * - 成功但没有采样 → 「该时间窗没有数据」：本部署的 cAdvisor 序列不带容器标签，
 *   容器级四条全空，GPU 两条尤其如此，面板照常请求、照常显示空态；
 * - 真实 0 → 照常画零值曲线：空闲不是缺失。
 */
export interface ContainerMonitorPanelProps {
  cluster: string;
  namespace: string;
  pod: string;
  container: string;
}

const WINDOWS = [
  { key: '1h', ms: 60 * 60 * 1000, step: '60s' },
  { key: '6h', ms: 6 * 60 * 60 * 1000, step: '5m' },
  { key: '24h', ms: 24 * 60 * 60 * 1000, step: '15m' },
] as const;

type WindowKey = (typeof WINDOWS)[number]['key'];

/**
 * 四条容器级指标，一次请求取全。
 *
 * 分开请求会让四张图的时间轴与采样点对不上，而且四次往返只是同一份数据的四个切片。
 */
const METRICS = [
  'container_gpu_usage',
  'container_gpu_memory_usage',
  'container_cpu_usage',
  'container_memory_usage_wo_cache',
] as const;

type ChartKey = 'gpu' | 'gpu-memory' | 'cpu' | 'memory';

interface ChartSpec {
  key: ChartKey;
  /** 序列名，与 METRICS 一一对应；空序列时按名字取不到点，就是空态。 */
  metric: (typeof METRICS)[number];
  titleKey: LocaleKey;
}

/** 图的顺序照旧 console：GPU、GPU 显存、CPU、内存。 */
const CHARTS: ChartSpec[] = [
  { key: 'gpu', metric: 'container_gpu_usage', titleKey: 'container.monitor.gpu' },
  { key: 'gpu-memory', metric: 'container_gpu_memory_usage', titleKey: 'container.monitor.gpuMemory' },
  { key: 'cpu', metric: 'container_cpu_usage', titleKey: 'container.monitor.cpu' },
  { key: 'memory', metric: 'container_memory_usage_wo_cache', titleKey: 'container.monitor.memory' },
];

/** 字节 → GiB：API 报的是字节，页面按 GiB 读（与工作负载监控页一致）。 */
function formatMemory(bytes: number): string {
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GiB`;
}

export function ContainerMonitorPanel({ cluster, namespace, pod, container }: ContainerMonitorPanelProps): React.ReactElement {
  const t = useT();
  const [windowKey, setWindowKey] = React.useState<WindowKey>('1h');
  const window = WINDOWS.find((entry) => entry.key === windowKey) ?? WINDOWS[0];

  /*
   * 时间窗只在切换时换算成绝对时间戳。
   *
   * 把 `end: Date.now()` 放进查询键会让它在每次渲染都变，查询于是永远重新取数；
   * 集群监控页踩过同一个坑，这里沿用「选定窗口时定一次」的写法。
   */
  const [range, setRange] = React.useState(() => {
    const end = Math.floor(Date.now() / 1000) * 1000;
    return { start: end - WINDOWS[0].ms, end };
  });
  React.useEffect(() => {
    const end = Math.floor(Date.now() / 1000) * 1000;
    setRange({ start: end - window.ms, end });
  }, [windowKey, window.ms]);

  const trends = useQuery({
    queryKey: ['container-monitor', cluster, namespace, pod, container, windowKey, range.start, range.end],
    queryFn: ({ signal }) =>
      rangeMetricsApi(apiClient).container({
        cluster,
        namespace,
        pod,
        container,
        metrics: [...METRICS],
        start: range.start,
        end: range.end,
        step: window.step,
        signal,
      }),
    /*
     * 切页签不会重新取数：页面在首次进入监控页签后保持本面板挂载（不卸载、不换查询
     * 键）。staleTime 只负责另一件事——窗口重新聚焦时不必立刻再打一次；历史窗口本来
     * 也不会因为一次重取而变准。
     */
    staleTime: 60_000,
    retry: false,
  });

  const seriesByName = React.useMemo(() => {
    const map = new Map<string, MetricSeries>();
    for (const series of trends.data ?? []) map.set(series.name, series);
    return map;
  }, [trends.data]);

  const charted = React.useMemo(
    () => CHARTS.map((chart) => ({ chart, points: seriesByName.get(chart.metric)?.points ?? [] })),
    [seriesByName],
  );

  const totalPoints = charted.reduce((sum, entry) => sum + entry.points.length, 0);
  const loading = trends.isPending;
  const unavailable = trends.isError;
  const empty = !loading && !unavailable && totalPoints === 0;
  const hasData = !loading && !unavailable && totalPoints > 0;
  const panelState: AiSurfaceState = loading ? 'loading' : unavailable ? 'error' : empty ? 'empty' : 'ready';

  const format = React.useCallback(
    (key: ChartKey, value: number): string => {
      if (key === 'cpu') return `${value.toFixed(3)} ${t('workloads.detail.monitor.cores')}`;
      if (key === 'memory' || key === 'gpu-memory') return formatMemory(value);
      // GPU 用量是卡数（可能带小数），不是百分比。
      return String(Number(value.toFixed(2)));
    },
    [t],
  );

  return (
    <div className="flex flex-col gap-4" {...surfaceProps(panelState, 'container-detail:monitor')}>
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-xs text-ai-fg-muted">{t('container.monitor.hint')}</p>
        <div className="flex flex-wrap gap-1" {...actionProps('container-detail:monitor:window')}>
          {WINDOWS.map((entry) => (
            <Button
              key={entry.key}
              size="sm"
              variant={entry.key === windowKey ? 'primary' : 'secondary'}
              aria-pressed={entry.key === windowKey}
              {...actionProps(`container-detail:monitor:window:${entry.key}`)}
              onClick={() => setWindowKey(entry.key)}
            >
              {t(`workloads.detail.monitor.range.${entry.key}`)}
            </Button>
          ))}
        </div>
      </header>

      {loading ? (
        /* The skeleton stands in for the plots, at the plot's own height. */
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2" data-ai-id="container-detail:monitor:loading">
          {CHARTS.map((chart) => (
            <ChartSkeleton key={chart.metric} height={140} aiId={`container-detail:monitor:loading:${chart.key}`} />
          ))}
        </div>
      ) : null}

      {unavailable ? (
        <div
          className="flex flex-col gap-2 rounded-lg border border-ai-border bg-ai-surface p-4"
          data-ai-id="container-detail:monitor:error"
        >
          <span className="text-sm text-ai-fg-secondary">{t('container.monitor.unavailable')}</span>
          <span className="text-xs text-ai-fg-muted">{t('container.monitor.unavailableHint')}</span>
          <div>
            <Button
              size="sm"
              variant="secondary"
              {...actionProps('container-detail:monitor:retry')}
              onClick={() => void trends.refetch()}
            >
              {t('common.retry')}
            </Button>
          </div>
        </div>
      ) : null}

      {empty ? (
        <div
          className="flex flex-col gap-1 rounded-lg border border-ai-border bg-ai-surface p-4"
          data-ai-id="container-detail:monitor:empty"
        >
          <span className="text-sm text-ai-fg-secondary">{t('container.monitor.empty')}</span>
          <span className="text-xs text-ai-fg-muted">{t('container.monitor.emptyHint')}</span>
        </div>
      ) : null}

      {hasData ? (
        <div
          className="grid grid-cols-1 gap-3 xl:grid-cols-2"
          data-ai-id="container-detail:monitor:chart"
          data-ai-window={windowKey}
          data-ai-points={String(totalPoints)}
        >
          {charted.map(({ chart, points }) => (
            <MonitorCard
              key={chart.key}
              chart={chart}
              points={points}
              start={range.start}
              end={range.end}
              format={format}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * 一张趋势卡。
 *
 * 一条序列没有采样时由共享图表画空态文案，而不是画一条零线：本部署
 * GPU 两条本来就没有容器级序列，硬画零线会被读成「GPU 用量是 0」。真实的全 0 序列
 * 走另一条路——有点就画线，零值也是点。
 *
 * The plot is `TimeSeriesChart`, filled and smoothed: a single container metric is
 * exactly the case where an area reads better than a bare line, and the hover
 * readout names the instant the pointer is on.
 */
function MonitorCard({
  chart,
  points,
  start,
  end,
  format,
}: {
  chart: ChartSpec;
  points: MetricSeries['points'];
  start: number;
  end: number;
  format: (key: ChartKey, value: number) => string;
}): React.ReactElement {
  const t = useT();
  const current = points.length > 0 ? points[points.length - 1]?.value : undefined;
  const aiId = `container-detail:monitor:${chart.key}`;
  const label = t(chart.titleKey);

  return (
    <section
      className="flex min-w-0 flex-col rounded-lg border border-ai-border bg-ai-surface p-4"
      data-ai-id={aiId}
      aria-label={label}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-ai-fg">{label}</h3>
        <span className="text-xs tabular-nums text-ai-fg-muted" data-ai-id={`${aiId}:current`}>
          {current === undefined ? '-' : format(chart.key, current)}
        </span>
      </div>
      <TimeSeriesChart
        series={[{ key: chart.key, label, points, area: true, smooth: true }]}
        start={start}
        end={end}
        label={label}
        emptyText={t('container.monitor.empty')}
        height={140}
        formatValue={(value) => format(chart.key, value)}
        data-ai-id={`${aiId}:chart`}
      />
    </section>
  );
}
