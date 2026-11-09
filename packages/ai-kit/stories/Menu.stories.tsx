import type { Meta, StoryObj } from '@storybook/react';
import { Menu } from '../src/primitives/Menu';
import { ComponentDocs } from './_docs-layout';

/* ---------------- Menu ---------------- */

const meta: Meta<typeof Menu> = {
  title: 'Components/Menu',
  component: Menu,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="Menu"
          summary="左侧主导航。分组可折叠，选中项所在分组自动展开。"
          description={
            <>
              菜单的结构就是产品的信息架构，只放一级路由。
              组件使用 <code>role=&quot;tree&quot;</code> 语义，方向键可在项之间移动。
              <code>collapsed</code> 收成图标轨道，用于窄屏或把注意力让给内容。
            </>
          }
        />
      ),
    },
  },
};

export default meta;
type Story = StoryObj<typeof Menu>;

const ITEMS = [
  {
    key: 'workloads',
    label: '工作负载',
    children: [
      { key: 'pods', label: 'Pod' },
      { key: 'deployments', label: 'Deployment' },
      { key: 'statefulsets', label: 'StatefulSet' },
    ],
  },
  {
    key: 'config',
    label: '配置',
    children: [
      { key: 'configmaps', label: '配置字典' },
      { key: 'secrets', label: '保密字典' },
    ],
  },
  { key: 'monitor', label: '监控告警' },
];

export const BasicMenu: Story = {
  name: 'basic menu',
  render: () => (
    <div className="w-56 rounded-ai-lg border border-ai-line bg-ai-surface-1 p-1">
      <Menu items={ITEMS} activeKey="pods" aria-label="主导航" />
    </div>
  ),
};

/** 折叠态只显示图标，提示走 title 属性。 */
export const CollapsedMenu: Story = {
  name: 'collapsed menu',
  render: () => (
    <div className="w-14 rounded-ai-lg border border-ai-line bg-ai-surface-1 p-1">
      <Menu items={ITEMS} activeKey="pods" collapsed aria-label="主导航" />
    </div>
  ),
};
