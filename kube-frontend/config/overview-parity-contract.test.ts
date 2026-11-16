import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
describe('legacy overview capability inventory', () => {
  it('keeps every metric actually referenced by the old resource rows in the new client', () => {
    const old = read('../src/pages/clusters/containers/Overview/Dashboard/ResourcesUsage/index.jsx');
    const types = new Map([...old.matchAll(/(\w+): '(cluster_[^']+)'/g)].map((match) => [match[1], match[2]]));
    const used = new Set([...old.matchAll(/data\[MetricTypes\.(\w+)\]/g)].map((match) => types.get(match[1])));
    const client = read('packages/api-client/src/cluster.ts');
    for (const metric of used) expect(client).toContain(`'${metric}'`);
    expect(client).toContain("gpuUsed: values.get('cluster_gpu_usage')");
    expect(client).toContain("error: attempt('error')");
    const page = read('apps/console-next/src/pages/cluster/ClusterOverviewPage.tsx');
    const resources = read('apps/console-next/src/pages/cluster/overviewResourceMetrics.ts');
    const panel = read('apps/console-next/src/pages/cluster/OverviewResourcePanel.tsx');
    expect(page).toContain('OverviewResourcePanel');
    expect(panel).toContain('`overview:usage-${entry.key}`');
    for (const key of ['gpu-memory', 'gpu', 'disk']) expect(resources).toContain(`key: '${key}'`);
    for (const id of ['schedule-error', 'visibility', 'kubeconfig-open']) {
      expect(page).toContain(`overview:${id}`);
    }
  });
  it('retains all legacy ranking dimensions and the global Top5 request', () => {
    const old = read('../src/stores/rank/node.js').match(/const sort_metric_options = \[([\s\S]*?)\]/)?.[1] ?? '';
    const metrics = [...old.matchAll(/'(node_[^']+)'/g)].map((match) => match[1]);
    expect(metrics).toHaveLength(9);
    const client = read('packages/api-client/src/node-ranking.ts');
    for (const metric of metrics) expect(client).toContain(`'${metric}'`);
    expect(client).toContain("type: 'rank'");
    expect(read('apps/console-next/src/pages/cluster/NodeRankingPanel.tsx')).toContain('pageSize: preview ? 5 : list.pageSize');
  });
  it('retains component categories and opt-in user-config reading without credential persistence', () => {
    const groups = read('apps/console-next/src/pages/cluster/componentGroups.ts');
    for (const group of ['kubeaihub', 'kubernetes', 'istio', 'monitoring', 'logging', 'devops']) {
      expect(groups).toContain(`key: '${group}'`);
    }
    const dialog = read('apps/console-next/src/pages/cluster/UserKubeconfigDialog.tsx');
    expect(dialog).toContain('gcTime: 0');
    expect(dialog).toContain('client.cancelQueries');
    expect(dialog).toContain('client.removeQueries');
    expect(dialog).not.toMatch(/localStorage|console\.log/);
    expect(read('packages/api-client/src/kubectl.ts')).toContain("responseType: 'text'");
  });
  /*
   * The overview used to carry its own `function Panel`, which is how two panel headers on
   * one page ended up at different heights and why the node block could not stretch its
   * body. Both the shared panel and the dense description list exist now; this check keeps
   * the next edit from copying either one back into the page.
   */
  it('builds the overview panels from shared components instead of page-local copies', () => {
    const page = read('apps/console-next/src/pages/cluster/ClusterOverviewPage.tsx');
    const resources = read('apps/console-next/src/pages/cluster/OverviewResourcePanel.tsx');
    const ranking = read('apps/console-next/src/pages/cluster/NodeRankingPanel.tsx');
    const components = read('apps/console-next/src/pages/cluster/OverviewComponents.tsx');
    for (const file of [page, resources, ranking, components]) {
      expect(file).toContain('Panel');
      // A second `function Panel(` in the app is the copy this check exists to prevent.
      expect(file).not.toMatch(/^function Panel\(/m);
    }
    // The identity panels use the dense variant: 14px medium labels over 12px values.
    expect(page).toContain('variant="dense"');
    expect(page).toContain('divided');
    // Both blocks in the 1:2 row give their header the same floor and let the body stretch.
    for (const file of [resources, ranking]) {
      expect(file).toContain('headerClassName="min-h-[3.75rem] items-center"');
      expect(file).toContain('bodyClassName="flex min-h-0 flex-1 flex-col"');
    }
    // The node block's only action is a link; selecting a resource is the grid's job.
    expect(resources).toContain('overview:node-summary-more');
  });
});
