import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { ContainerDetailPage } from '@/pages/app-workloads/ContainerDetailPage';

/**
 * 容器详情页签的渲染契约（LEG-PODS-009/010/011/012）。
 *
 * 数据用 fetch 桩注入：页面走应用自己的 `api` 客户端，桩在 URL 层拦截，不碰真实网络。
 * 断言看内容与关系——哪个面板在、文本是什么、请求发生了几次——不看类名，也不看
 * 具体节点结构，这样样式重排不会让用例变成假失败。
 */

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, ...rest }: { children: React.ReactNode; to: string; params: Record<string, string>; [key: string]: unknown }) => (
    <a href={Object.entries(params).reduce((url, [key, value]) => url.replace('$' + key, value), to)} {...rest}>{children}</a>
  ),
}));

/** 一个带 env / lifecycle / 端口 / 探针 / 镜像 ID 的容器组。 */
const POD = {
  metadata: { name: 'web-0', namespace: 'proj' },
  spec: {
    containers: [
      {
        name: 'app',
        image: 'registry.local/team/app:1.4.2',
        imagePullPolicy: 'IfNotPresent',
        command: ['/bin/sh'],
        args: ['-c', 'sleep 3600'],
        env: [
          { name: 'MODE', value: 'production' },
          { name: 'DB_PASSWORD', value: 'hunter2' },
          { name: 'CONFIG_MODE', valueFrom: { configMapKeyRef: { name: 'app-config', key: 'mode' } } },
        ],
        ports: [{ name: 'http', containerPort: 8080, protocol: 'TCP' }],
        volumeMounts: [{ name: 'data', mountPath: '/data' }],
        resources: { requests: { cpu: '100m' }, limits: { memory: '256Mi' } },
        lifecycle: {
          postStart: { exec: { command: ['/bin/sh', '-c', 'echo started'] } },
          preStop: { httpGet: { path: '/stop', port: 8080, scheme: 'HTTP' } },
        },
        livenessProbe: { httpGet: { path: '/healthz', port: 8080 } },
      },
    ],
    volumes: [{ name: 'data', emptyDir: {} }],
  },
  status: {
    containerStatuses: [
      {
        name: 'app',
        imageID: 'docker://sha256:9f2c4b1d',
        restartCount: 1,
        state: { running: { startedAt: '2026-11-18T10:00:00Z' } },
      },
    ],
  },
};

function mount(element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="zh">{element}</I18nProvider>
    </QueryClientProvider>,
  );
}

/** 一条 range 响应；时间戳取「现在」附近，否则会被图表的时间窗过滤掉。 */
function matrix(name: string, values: number[]) {
  const now = Math.floor(Date.now() / 1000);
  return {
    metric_name: name,
    data: {
      resultType: 'matrix',
      result: [{ metric: {}, values: values.map((value, index) => [now - (values.length - index) * 60, String(value)]) }],
    },
  };
}

/**
 * 容器组详情 + 环境变量引用 + 容器级监控三处请求。
 *
 * `monitor` 决定监控端点的回答：本部署的容器级序列就是空的，所以默认空序列；
 * 有采样与失败两个分支各有用例。
 */
function stubApi(monitor: 'empty' | 'error' | 'series' = 'empty') {
  const calls: URL[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    calls.push(url);
    if (url.pathname.endsWith('/containers/app')) {
      if (monitor === 'error') return new Response('monitoring backend unavailable', { status: 503 });
      if (monitor === 'series') {
        return Response.json({
          results: [
            matrix('container_gpu_usage', [0, 0]),
            matrix('container_gpu_memory_usage', [0, 0]),
            matrix('container_cpu_usage', [0.12, 0.18]),
            matrix('container_memory_usage_wo_cache', [134_217_728, 134_217_728]),
          ],
        });
      }
      return Response.json({ results: [] });
    }
    if (url.pathname.endsWith('/configmaps/app-config')) return Response.json({ data: { mode: 'from-config' } });
    if (url.pathname.endsWith('/pods/web-0')) return Response.json(POD);
    return Response.json({});
  }));
  return calls;
}

function trigger(view: ReturnType<typeof mount>, tab: 'resources' | 'monitor' | 'env' | 'logs'): HTMLElement {
  const element = view.container.querySelector(`[data-ai-id="container-detail:tab-trigger:${tab}"]`);
  expect(element).not.toBeNull();
  return element as HTMLElement;
}

/** 等首屏资源状态面板出来：其余用例都从这一屏开始点。 */
async function mountReady(monitor: 'empty' | 'error' | 'series' = 'empty') {
  const calls = stubApi(monitor);
  const view = mount(<ContainerDetailPage workspace="ws" cluster="host" namespace="proj" pod="web-0" container="app" />);
  await waitFor(() => expect(view.container.querySelector('[data-ai-id="container-detail:basic"]')).not.toBeNull());
  return { view, calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('容器详情页签', () => {
  it('默认停在资源状态页签，镜像 ID 与生命周期都在这一屏', async () => {
    const { view } = await mountReady();

    // 默认页签是资源状态，其余面板还没渲染（页签只切面板）。
    expect(view.container.querySelector('[data-ai-id="container-detail:tab:resources"]')).not.toBeNull();
    expect(view.container.querySelector('[data-ai-id="container-detail:tab:env"]')).toBeNull();
    expect(view.container.querySelector('[data-ai-id="container-detail:tab:monitor"]')).toBeNull();

    // 镜像 ID 与镜像分开两行，值来自 status.containerStatuses[].imageID。
    expect(view.container.querySelector('[data-ai-id="container-detail:image-id"]')).toHaveTextContent('docker://sha256:9f2c4b1d');
    expect(view.container.querySelector('[data-ai-id="container-detail:basic"]')).toHaveTextContent('registry.local/team/app:1.4.2');

    // 生命周期两条各一行：类型是本地化文案，参数是对象原文。
    expect(view.container.querySelector('[data-ai-id="container-detail:lifecycle"]')).not.toBeNull();
    expect(view.container.querySelector('[data-ai-id="container-detail:lifecycle:postStart"]')).toHaveTextContent('启动后');
    expect(view.container.querySelector('[data-ai-id="container-detail:lifecycle:postStart"]')).toHaveTextContent('echo started');
    expect(view.container.querySelector('[data-ai-id="container-detail:lifecycle:preStop"]')).toHaveTextContent('HTTP 请求');
    expect(view.container.querySelector('[data-ai-id="container-detail:lifecycle:preStop"]')).toHaveTextContent('/stop');

    // 既有区块仍在同一页签里。
    for (const id of ['resources', 'mounts', 'ports', 'probes']) {
      expect(view.container.querySelector(`[data-ai-id="container-detail:${id}"]`)).not.toBeNull();
    }
  });

  it('切到环境变量页签显示按容器分组的解析值与掩码', async () => {
    const { view } = await mountReady();

    await userEvent.click(trigger(view, 'env'));

    const panel = view.container.querySelector('[data-ai-id="container-detail:tab:env"]');
    expect(panel).not.toBeNull();
    // 页签只切面板：资源状态面板让位给环境变量面板。
    expect(view.container.querySelector('[data-ai-id="container-detail:tab:resources"]')).toBeNull();
    expect(panel).toHaveTextContent('容器 app');

    await waitFor(() => expect(view.container.querySelector('[data-ai-row="MODE"]')).not.toBeNull());
    // 字面量照原样显示，valueFrom 已由 resolvePodEnv 解析成 ConfigMap 里的值。
    expect(view.container.querySelector('[data-ai-row="MODE"]')).toHaveTextContent('production');
    expect(view.container.querySelector('[data-ai-row="CONFIG_MODE"]')).toHaveTextContent('from-config');
    // 名称含 password 的变量只给掩码，真实值不进 DOM。
    expect(view.container.querySelector('[data-ai-row="DB_PASSWORD"]')).toHaveTextContent('******');
    expect(view.container.innerHTML).not.toContain('hunter2');
  });

  it('切到监控页签时四图一次请求，空序列显示空态而不是错误或零线', async () => {
    const { view, calls } = await mountReady();

    // 没打开监控页签前不该有容器级监控请求。
    expect(calls.filter((url) => url.pathname.endsWith('/containers/app'))).toHaveLength(0);

    await userEvent.click(trigger(view, 'monitor'));
    expect(view.container.querySelector('[data-ai-id="container-detail:tab:monitor"]')).not.toBeNull();

    await waitFor(() => expect(view.container.querySelector('[data-ai-id="container-detail:monitor:empty"]')).not.toBeNull());
    // 200 无采样是「没有数据」，不是「监控不可用」。
    expect(view.container.querySelector('[data-ai-id="container-detail:monitor:error"]')).toBeNull();
    // 四张图一个请求取全，四条指标都在 metrics_filter 里。
    const monitorCalls = calls.filter((url) => url.pathname.endsWith('/containers/app'));
    expect(monitorCalls).toHaveLength(1);
    const filter = monitorCalls[0]!.searchParams.get('metrics_filter') ?? '';
    for (const metric of ['container_gpu_usage', 'container_gpu_memory_usage', 'container_cpu_usage', 'container_memory_usage_wo_cache']) {
      expect(filter).toContain(`${metric}$`);
    }

    // 切走再切回不得重复请求：面板首次进入后保持挂载，非当前页签只是隐藏。
    await userEvent.click(trigger(view, 'resources'));
    const kept = view.container.querySelector('[data-ai-id="container-detail:tab:monitor"]') as HTMLElement;
    expect(kept).not.toBeNull();
    expect(kept.hidden).toBe(true);
    await userEvent.click(trigger(view, 'monitor'));
    await waitFor(() => expect(view.container.querySelector('[data-ai-id="container-detail:tab:monitor"]')).not.toBeNull());
    expect((view.container.querySelector('[data-ai-id="container-detail:tab:monitor"]') as HTMLElement).hidden).toBe(false);
    expect(calls.filter((url) => url.pathname.endsWith('/containers/app'))).toHaveLength(1);
  });

  it('监控有采样时四张图都画出来，全 0 的序列仍是图不是空态', async () => {
    const { view } = await mountReady('series');

    await userEvent.click(trigger(view, 'monitor'));
    await waitFor(() => expect(view.container.querySelector('[data-ai-id="container-detail:monitor:chart"]')).not.toBeNull());

    expect(view.container.querySelector('[data-ai-id="container-detail:monitor:empty"]')).toBeNull();
    for (const key of ['gpu', 'gpu-memory', 'cpu', 'memory']) {
      const card = view.container.querySelector(`[data-ai-id="container-detail:monitor:${key}"]`);
      expect(card).not.toBeNull();
      // 有点就是图：共享图表在无点时才会打 data-ai-state="empty"。
      expect(card!.querySelector('[data-ai-state="empty"]')).toBeNull();
      /*
       * The plot is present and ready. It is asserted through its state rather than
       * through an `svg`: the drawing library is stubbed in this suite (it lives in
       * ai-kit's own React), so the element is a div here. The real SVG is covered by
       * ai-kit's chart tests and the browser pass.
       */
      const plot = card!.querySelector('[data-ai-id="container-detail:monitor:' + key + ':chart"]');
      expect(plot).not.toBeNull();
      expect(plot!.querySelector('[data-ai-state="empty"]')).toBeNull();
    }
    // GPU 用量是真实的 0，不是「没有数据」。
    expect(view.container.querySelector('[data-ai-id="container-detail:monitor:gpu:current"]')).toHaveTextContent('0');
    expect(view.container.querySelector('[data-ai-id="container-detail:monitor:cpu:current"]')).toHaveTextContent('核');
  });

  it('监控请求失败显示不可用与重试，而不是空态', async () => {
    const { view } = await mountReady('error');

    await userEvent.click(trigger(view, 'monitor'));
    await waitFor(() => expect(view.container.querySelector('[data-ai-id="container-detail:monitor:error"]')).not.toBeNull());

    const panel = view.container.querySelector('[data-ai-id="container-detail:monitor:error"]');
    expect(panel).toHaveTextContent('监控不可用');
    expect(panel!.querySelector('[data-ai-id="container-detail:monitor:retry"]')).not.toBeNull();
    // 失败与「没有数据」是两件事，不能同时出现。
    expect(view.container.querySelector('[data-ai-id="container-detail:monitor:empty"]')).toBeNull();
  });

  it('切到日志页签显示既有日志区块，终端仍是页面级操作', async () => {
    const { view } = await mountReady();

    await userEvent.click(trigger(view, 'logs'));

    const panel = view.container.querySelector('[data-ai-id="container-detail:tab:logs"]');
    expect(panel).not.toBeNull();
    const logs = view.container.querySelector('[data-ai-id="container-detail:logs"]');
    expect(logs).not.toBeNull();
    expect(logs).toHaveTextContent('打开日志控制台');
    // 终端区块留在页签之外：换页签不该收起已打开的 shell。
    expect(view.container.querySelector('[data-ai-id="container-detail:terminal-open"]')).not.toBeNull();
  });
});
