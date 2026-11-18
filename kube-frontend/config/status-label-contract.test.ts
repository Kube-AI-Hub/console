import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * One label table for pod/workload status.
 *
 * The same pod state showed up as `running` on the cluster pods list and 「运行中」 on the
 * project list (guide pitfall 52). The fix is one shared table (`lib/status.ts`), but the
 * list that forgot to call it renders happily — only an E2E notices, and only after the
 * page is rebuilt. This contract reads the sources instead.
 *
 * Pages with their own status vocabularies (app-store install states, workspace project
 * phases) are deliberately not listed: they do not share the pod/workload enum.
 */

const root = new URL('..', import.meta.url).pathname;

/** Surfaces that render a pod or workload status column. */
const STATUS_SURFACES = [
  'apps/console-next/src/pages/cluster/ClusterPodsPage.tsx',
  'apps/console-next/src/pages/cluster/ClusterWorkloadsPage.tsx',
  'apps/console-next/src/pages/app-workloads/WorkloadListPage.tsx',
  'apps/console-next/src/pages/app-workloads/WorkloadDetailPage.tsx',
];

describe('status labels come from the shared table', () => {
  it('every pod/workload status surface calls statusLabel', () => {
    const missing: string[] = [];
    for (const relative of STATUS_SURFACES) {
      const source = readFileSync(join(root, relative), 'utf8');
      if (!source.includes('statusLabel(')) missing.push(relative);
    }
    expect(missing, `这些页面渲染状态但没走共享文案表：${missing.join(', ')}`).toEqual([]);
  });

  it("the shared table covers the pod list's lowercase states", () => {
    // The client normalizes pod states to lowercase while the API spells phases capitalized;
    // a table with only `Running` silently returns `running` unchanged.
    const source = readFileSync(join(root, 'apps/console-next/src/lib/status.ts'), 'utf8');
    for (const state of ['running', 'waiting', 'completed', 'error']) {
      expect(source, `lib/status.ts 缺少小写状态 ${state}`).toContain(`${state}: '`);
    }
  });
});
