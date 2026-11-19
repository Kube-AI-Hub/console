import * as React from 'react';
import type { NodeDetail } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import { formatQuantity } from '@/lib/quantity';
import { NODE_TOTAL_RESOURCES, resourceLabelKey } from './nodeDetailModel';

/**
 * 资源总量 — the capacity headline, before the per-usage percentages.
 *
 * The old console leads with these numbers and only then shows utilisation; the
 * rebuilt page went straight to percentages, which answers "how full is it" before
 * "how big is it". On a heterogeneous node the second question is the one that
 * identifies the machine: 128 cores and 2 TiB of RAM says more about a box than
 * "6% CPU".
 *
 * Four keys, not `Object.keys(capacity)`: `hugepages-1Gi` / `hugepages-2Mi` are
 * tuning knobs that are almost always zero, and listing them under a "totals"
 * heading implies they are something to size. The GPU rows are added when the node
 * reports them, because on an accelerator node the card count *is* headline
 * capacity.
 */
export function NodeTotalsPanel({ node }: { node: NodeDetail }): React.ReactElement {
  const t = useT();
  const gpuKeys = Object.keys(node.capacity).filter((key) => key === 'nvidia.com/gpu');
  const keys = [...NODE_TOTAL_RESOURCES, ...gpuKeys];
  return <section className="rounded-ai-lg border border-ai-line bg-ai-surface-1 p-4" data-ai-id="node-detail:totals">
    <h2 className="mb-3 text-sm font-semibold">{t('node.totals.title')}</h2>
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 xl:grid-cols-6">
      {keys.map((key) => {
        const labelKey = resourceLabelKey(key);
        const value = node.capacity[key];
        return <div key={key} className="min-w-0" data-ai-resource={key}>
          <dt className="text-[11px] text-ai-fg-muted">{labelKey ? t(labelKey) : key}</dt>
          <dd className="mt-1 whitespace-nowrap text-lg font-semibold tabular-nums text-ai-fg"
            data-ai-id={`node-detail:total:${key}`}>
            {value ? formatQuantity(key, value) : '-'}
          </dd>
        </div>;
      })}
    </dl>
  </section>;
}
