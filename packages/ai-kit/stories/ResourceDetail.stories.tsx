import type { Meta, StoryObj } from '@storybook/react';
import { ResourceDetail, type DetailSchema } from '../src/schema/ResourceDetail';
import { Button } from '../src/primitives/Button';
import { Badge } from '../src/primitives/Display';

interface NodeRow {
  name: string;
  status: string;
  ip: string;
  os: string;
  runtime: string;
  cpu: string;
  memory: string;
  gpuModel: string;
  gpuCount: number;
  gpuMode: string;
  labels: Record<string, string>;
  gpus: Array<{ index: number; model: string; memory: string; utilization: number }>;
}

const NODE: NodeRow = {
  name: 'a100-04',
  status: 'ready',
  ip: '10.0.0.14',
  os: 'Ubuntu 22.04.3 LTS',
  runtime: 'containerd 1.7.13',
  cpu: '96 核',
  memory: '1024 GiB',
  gpuModel: 'NVIDIA A100 80GB',
  gpuCount: 8,
  gpuMode: 'HAMi 虚拟化',
  labels: { 'node-role.kubernetes.io/worker': '', 'topology.kubernetes.io/zone': 'cn-shanghai-a' },
  gpus: [
    { index: 0, model: 'A100 80GB', memory: '80 GiB', utilization: 72 },
    { index: 1, model: 'A100 80GB', memory: '80 GiB', utilization: 65 },
    { index: 2, model: 'A100 80GB', memory: '80 GiB', utilization: 12 },
    { index: 3, model: 'A100 80GB', memory: '80 GiB', utilization: 0 },
  ],
};

const schema: DetailSchema<NodeRow> = {
  header: {
    title: (row) => row.name,
    subtitle: (row) => `${row.os} · ${row.runtime}`,
    status: (row) => ({ label: row.status === 'ready' ? '就绪' : '异常', tone: row.status === 'ready' ? 'success' : 'danger' }),
    actions: () => (
      <>
        <Button variant="secondary" size="sm">编辑</Button>
        <Button variant="secondary" size="sm">驱逐</Button>
      </>
    ),
  },
  stats: [
    { key: 'cpu', label: 'CPU', value: (row) => row.cpu },
    { key: 'memory', label: '内存', value: (row) => row.memory },
    { key: 'gpu', label: 'GPU', value: (row) => `${row.gpuCount} × ${row.gpuModel}` },
    { key: 'mode', label: '虚拟化', value: (row) => row.gpuMode },
  ],
  sections: [
    {
      id: 'basic',
      title: '基本信息',
      fields: [
        { key: 'ip', label: '内网 IP', type: 'code' },
        { key: 'os', label: '操作系统' },
        { key: 'runtime', label: '容器运行时' },
        { key: 'name', label: '节点名称', type: 'code' },
      ],
    },
    {
      id: 'labels',
      title: '标签',
      render: (row) => (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(row.labels).map(([key, value]) => (
            <Badge key={key} tone="neutral">{value ? `${key}=${value}` : key}</Badge>
          ))}
        </div>
      ),
    },
    {
      id: 'gpu',
      title: 'GPU 设备',
      description: '自研字段示例：通过 section.render 挂载任意组件',
      render: (row) => (
        <div className="flex flex-col gap-1.5">
          {row.gpus.map((gpu) => (
            <div key={gpu.index} className="flex items-center gap-3 rounded-ai-sm bg-ai-surface-2 px-3 py-2">
              <span className="font-ai-mono text-[11px] text-ai-fg-muted">#{gpu.index}</span>
              <span className="text-xs text-ai-fg-secondary">{gpu.model}</span>
              <span className="text-[11px] text-ai-fg-muted">{gpu.memory}</span>
              <span className="ml-auto tabular-nums text-xs text-ai-fg-secondary">{gpu.utilization}%</span>
            </div>
          ))}
        </div>
      ),
    },
  ],
};

const meta: Meta = {
  title: 'Schema/ResourceDetail',
  parameters: { layout: 'padded' },
};
export default meta;

export const NodeDetail: StoryObj = {
  render: () => (
    <div className="mx-auto max-w-4xl">
      <ResourceDetail schema={schema} data={NODE} />
    </div>
  ),
};
