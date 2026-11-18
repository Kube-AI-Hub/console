import * as React from 'react';
import type { NodeDetail } from '@kube-ai-hub/api-client';
import { Button } from '@kube-ai-hub/ui';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { formatTimestamp } from '@/lib/time';
import { useT } from '@/i18n';
import { GPU_MODES } from './gpuModeConfig';
import { GPU_VENDOR_LABEL_KEYS, vendorKey } from './gpuVendors';
import { hasPendingMode } from './nodeListQueries';
import { formatGpuMemory } from './gpuFormat';

export function NodeInfoSidebar({ node, onMode }: { node: NodeDetail; onMode: () => void }): React.ReactElement {
  const t = useT();
  const vendor = vendorKey(node.gpuVendor ?? '');
  const gpu = Boolean(node.gpuVendor && node.gpuVendor.toLowerCase() !== 'cpu');
  const mode = GPU_MODES[node.gpuVendor?.toLowerCase() ?? '']?.find((entry) => entry.value === node.gpuMode);
  return <aside className="min-w-0 self-start rounded-ai-lg border border-ai-line bg-ai-surface-1 p-4" data-ai-id="node-detail:basic">
    <h2 className="mb-4 text-sm font-semibold">{t('node.detail.basic')}</h2>
    <dl className="grid grid-cols-1 gap-y-1 text-xs [&>dd]:mb-3">
      <DefinitionRow label={t('node.detail.internalIP')} value={node.internalIP} />
      <DefinitionRow label={t('cluster.column.role')} value={node.role} />
      <DefinitionRow label={t('node.detail.osImage')} value={node.nodeInfo.osImage} />
      <DefinitionRow label={t('node.detail.architecture')} value={node.nodeInfo.architecture} />
      <DefinitionRow label={t('node.detail.kernel')} value={node.nodeInfo.kernelVersion} />
      <DefinitionRow label={t('node.detail.operatingSystem')} value={node.nodeInfo.operatingSystem} />
      <DefinitionRow label={t('node.detail.runtime')} value={node.nodeInfo.containerRuntimeVersion} />
      <DefinitionRow label={t('node.detail.kubeletVersion')} value={node.nodeInfo.kubeletVersion} />
      <DefinitionRow label={t('node.detail.kubeProxyVersion')} value={node.nodeInfo.kubeProxyVersion} />
      <DefinitionRow label={t('node.detail.xpu')} value={gpu ? `${vendor ? t(GPU_VENDOR_LABEL_KEYS[vendor]) : node.gpuVendor} ${node.gpuModel ?? ''}` : 'CPU'} />
      {gpu ? <>
        <DefinitionRow label={t('node.detail.gpuMode')} value={<div className="flex items-center justify-between gap-2">
          <span>{hasPendingMode(node) ? t(node.gpuModeStatus?.status === 'in_progress' ? 'node.mode.in_progress' : 'node.mode.waiting') : mode ? t(mode.labelKey) : node.gpuMode || '-'}</span>
          {/* No host-only guard: the mode endpoint accepts `cluster` as a query
              parameter and works on member clusters (see the note in `NodesPage`). */}
          <Button size="sm" variant="secondary" data-ai-id="node-detail:gpu-mode" disabled={hasPendingMode(node)}
            onClick={onMode}>{t('node.mode.title')}</Button>
        </div>} />
        {node.gpuModeStatus?.status === 'failed' ? <p role="alert" className="mb-3 text-xs text-ai-danger">
          {node.gpuModeStatus.message || t('node.mode.failed')}</p> : null}
        <DefinitionRow label={t('node.detail.gpuDriver')} value={node.nodeInfo.gpuDriverVersion} />
        <DefinitionRow label={t('node.detail.gpuEngine')} value={node.nodeInfo.gpuEngineVersion} />
        <DefinitionRow label={t('node.hardware.cards')} value={node.nodeInfo.cardCount ?? '-'} />
        <DefinitionRow label={t('node.list.gpuMemory')} value={node.nodeInfo.gpuMemoryTotalMiB === undefined ? '-' : formatGpuMemory(node.nodeInfo.gpuMemoryTotalMiB)} />
        {node.nodeInfo.deviceSplitCount !== undefined ? <DefinitionRow label={t('node.mode.splitCount')} value={node.nodeInfo.deviceSplitCount} /> : null}
      </> : null}
      <DefinitionRow label={t('node.detail.createdAt')} value={formatTimestamp(node.createdAt)} />
    </dl>
  </aside>;
}
