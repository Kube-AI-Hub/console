import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { Tree } from '../src/primitives/Tree';
import { ComponentDocs } from './_docs-layout';

const meta: Meta<typeof Tree> = {
  title: 'Components/Tree',
  component: Tree,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="Tree"
          summary="层级数据的浏览与选择，例如目录结构或资源归属。"
          description={
            <>
              展开状态受控时用 <code>expandedKeys</code> + <code>onExpandedChange</code>；
              不传则组件自己管理。选中与展开是<strong>两个独立状态</strong>：
              选中有自己的回调，不会因为展开而变化。
            </>
          }
        />
      ),
    },
  },
};

export default meta;
type Story = StoryObj<typeof Tree>;

const NODES = [
  {
    key: 'root',
    label: '工作负载',
    children: [
      { key: 'deploy', label: 'Deployment' },
      { key: 'sts', label: 'StatefulSet' },
      { key: 'ds', label: 'DaemonSet' },
    ],
  },
  {
    key: 'svc',
    label: '服务',
    children: [
      { key: 'clusterip', label: 'ClusterIP' },
      { key: 'nodeport', label: 'NodePort' },
    ],
  },
  { key: 'secret', label: '保密字典' },
];

export const BasicTree: Story = {
  name: 'basic tree',
  render: () => (
    <div className="w-64 rounded-ai-lg border border-ai-line bg-ai-surface-1 p-2">
      <Tree nodes={NODES} expandedKeys={['root']} selectedKey="deploy" />
    </div>
  ),
};

/** 受控展开，便于记住用户的展开偏好。 */
export const ControlledExpansion: Story = {
  name: 'controlled expansion',
  render: () => {
    const [expanded, setExpanded] = React.useState<string[]>(['root', 'svc']);
    const [selected, setSelected] = React.useState('clusterip');
    return (
      <div className="flex w-64 flex-col gap-2">
        <div className="rounded-ai-lg border border-ai-line bg-ai-surface-1 p-2">
          <Tree
            nodes={NODES}
            expandedKeys={expanded}
            onExpandedChange={setExpanded}
            selectedKey={selected}
            onSelect={setSelected}
          />
        </div>
        <p className="text-xs text-ai-fg-muted">
          已展开 {expanded.length} 个分组，选中 {selected}
        </p>
      </div>
    );
  },
};
