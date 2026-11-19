import * as React from 'react';
import type { NodeDetail, NodeInsightValues } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import { formatBytes } from '@/lib/quantity';
import { NODE_TOTAL_RESOURCES, capacityLabel, formatCapacityValue } from './nodeDetailModel';
import { acceleratorByResource, acceleratorForSubResource } from './acceleratorKinds';
import { useAcceleratorKinds } from './useAcceleratorKinds';

/**
 * 资源总量 — the capacity headline, before the per-usage percentages.
 *
 * The old console leads with these numbers and only then shows utilisation; the
 * rebuilt page went straight to percentages, which answers "how full is it" before
 * "how big is it". On a heterogeneous node the second question is the one that
 * identifies the machine: 128 cores and 2 TiB of RAM says more about a box than
 * "6% CPU".
 *
 * Rows come from three places, matching the old console:
 *
 * - **core capacity** from `status.capacity` (CPU, memory, pods, ephemeral storage);
 * - **accelerator totals** from `status.capacity` too, but named and united through
 *   the platform's `gpu.kinds` table — each family spells its sub-resources its own
 *   way, so a raw key list cannot tell a card count from its memory;
 * - **disk total** from monitoring (`node_disk_size_capacity`), because the filesystem
 *   size is a measured fact, not a schedulable resource.
 *
 * Card and GPU-memory totals also come from `nodeInfo.cardCount` /
 * `nodeInfo.gpuMemoryTotal` when the device plugin reports them. Those are the
 * aggregator's own count and are what the old console prints as 卡 / 显存 total.
 */
export function NodeTotalsPanel({ node, usage }: {
  node: NodeDetail;
  /** Instant metrics; `node_disk_size_capacity` feeds the disk total. */
  usage?: NodeInsightValues;
}): React.ReactElement {
  const t = useT();
  const { kinds } = useAcceleratorKinds();

  const core = NODE_TOTAL_RESOURCES
    .filter((key) => key in node.capacity)
    .map((key) => ({ key, label: capacityLabel(key, t, kinds), value: formatCapacityValue(key, node.capacity[key] ?? '') }));

  /*
   * Accelerator rows, in the order the node reports them, each with the unit its kind
   * declares. While `kinds` is loading (or if the read failed) this list is empty and
   * the block shows only the core totals — the accelerator numbers are still in the
   * allocation table, under their own keys.
   */
  const accelerators = Object.keys(node.capacity)
    .filter((key) => acceleratorByResource(kinds, key) !== undefined || acceleratorForSubResource(kinds, key) !== undefined)
    .filter((key) => Number(node.capacity[key]) > 0)
    .map((key) => {
      const sub = acceleratorForSubResource(kinds, key);
      const kind = acceleratorByResource(kinds, key) ?? sub?.kind;
      const memoryUnit = sub?.role === 'memory' ? kind?.memoryUnit : undefined;
      return { key, label: capacityLabel(key, t, kinds), value: formatCapacityValue(key, node.capacity[key] ?? '', memoryUnit) };
    });

  /*
   * The aggregator's own totals. `cardCount` is the number of physical cards the
   * device plugin sees, which can differ from the sum of per-vendor resource keys;
   * `gpuMemoryTotal` is in MiB. Both are printed by the old console and are the
   * numbers an operator quotes.
   */
  const cardUnit = t('node.list.cards');
  const reported: Array<{ key: string; label: string; value: string }> = [];
  if (node.nodeInfo.cardCount !== undefined) {
    reported.push({ key: 'cardCount', label: t('node.resource.gpuTotal'), value: `${node.nodeInfo.cardCount} ${cardUnit}` });
  }
  if (node.nodeInfo.gpuMemoryTotalMiB !== undefined) {
    reported.push({ key: 'gpuMemoryTotal', label: t('node.resource.gpuMemoryTotal'), value: formatBytes(String(node.nodeInfo.gpuMemoryTotalMiB * 1024 ** 2)) });
  }
  const diskTotal = usage?.node_disk_size_capacity;
  if (diskTotal !== undefined && diskTotal > 0) {
    reported.push({ key: 'diskTotal', label: t('node.resource.diskTotal'), value: formatBytes(String(diskTotal)) });
  }

  return <section className="rounded-ai-lg border border-ai-line bg-ai-surface-1 p-4" data-ai-id="node-detail:totals">
    <h2 className="mb-3 text-sm font-semibold">{t('node.totals.title')}</h2>
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 xl:grid-cols-6">
      {[...core, ...reported, ...accelerators].map((entry) => (
        <div key={entry.key} className="min-w-0" data-ai-resource={entry.key}>
          <dt className="truncate text-[11px] text-ai-fg-muted" title={entry.label}>{entry.label}</dt>
          <dd className="mt-1 whitespace-nowrap text-lg font-semibold tabular-nums text-ai-fg"
            data-ai-id={`node-detail:total:${entry.key}`}>
            {entry.value}
          </dd>
        </div>
      ))}
    </dl>
  </section>;
}
