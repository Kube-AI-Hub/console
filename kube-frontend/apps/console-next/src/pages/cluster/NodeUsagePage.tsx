import * as React from 'react';
import type { NodeRankMetric } from '@kube-ai-hub/api-client';
import { AiSurface } from '@kube-ai-hub/ui';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { NodeRankingPanel } from './NodeRankingPanel';

export function NodeUsagePage({ cluster, initialMetric = 'node_cpu_utilisation' }: {
  cluster: string; initialMetric?: NodeRankMetric;
}) {
  const [state, setState] = React.useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  return <AiSurface aiId="node-usage:page" state={state} data-ai-id="node-usage:page">
    <NodeRankingPanel cluster={cluster} initialMetric={initialMetric} onStateChange={setState}
      renderError={(error, onRetry) => <ResourceErrorPanel error={error} onRetry={onRetry} retryAiId="node-usage:retry" />} />
  </AiSurface>;
}
