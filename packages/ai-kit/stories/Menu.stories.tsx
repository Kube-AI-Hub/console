import type { Meta, StoryObj } from '@storybook/react';
import { Icon } from '../src/primitives/Icon';
import { Menu, type MenuNode } from '../src/primitives/Menu';
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
              侧栏导航保持 Tab 顺序，不用方向键漫游。
              每一行标题都左对齐；没有图标时从同一条左边起，嵌套只按固定步长右移。
              只要有一项带图标，每一行都留出图标槽，没有图标的分组留空。
              <code>collapsed</code> 收成图标轨道；没有图标的项仍显示标题，避免变成空按钮。
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

/**
 * Same shape as the cluster sidebar: a group has no icon of its own, its pages
 * do, and a top-level page has one too. Every row keeps an icon slot, so the
 * group title lines up with the other labels and a child's icon sits under it.
 */
const WITH_ICONS: MenuNode[] = [
  {
    key: 'workloads',
    label: '工作负载',
    children: [
      { key: 'pods', label: 'Pod', icon: <Icon name="pod" size={14} /> },
      { key: 'deployments', label: 'Deployment', icon: <Icon name="hammer" size={14} /> },
      { key: 'statefulsets', label: 'StatefulSet', icon: <Icon name="stateful-set" size={14} /> },
    ],
  },
  {
    key: 'config',
    label: '配置',
    children: [
      { key: 'configmaps', label: '配置字典', icon: <Icon name="database" size={14} /> },
      { key: 'secrets', label: '保密字典', icon: <Icon name="backup" size={14} /> },
    ],
  },
  { key: 'monitor', label: '监控告警', icon: <Icon name="monitor" size={14} /> },
];

export const WithIcons: Story = {
  name: 'with icons',
  render: () => (
    <div className="w-56 rounded-ai-lg border border-ai-line bg-ai-surface-1 p-1">
      <Menu items={WITH_ICONS} activeKey="pods" aria-label="带图标的导航" />
    </div>
  ),
};

/**
 * Icon rail. Groups carry an icon too, so the collapsed row has something to
 * show: the label is hidden and the glyph keeps the title.
 */
const COLLAPSED_ICONS: MenuNode[] = [
  {
    key: 'workloads',
    label: '工作负载',
    icon: <Icon name="hammer" size={14} />,
    children: [
      { key: 'pods', label: 'Pod', icon: <Icon name="pod" size={14} /> },
      { key: 'deployments', label: 'Deployment', icon: <Icon name="hammer" size={14} /> },
      { key: 'statefulsets', label: 'StatefulSet', icon: <Icon name="stateful-set" size={14} /> },
    ],
  },
  {
    key: 'config',
    label: '配置',
    icon: <Icon name="database" size={14} />,
    children: [
      { key: 'configmaps', label: '配置字典', icon: <Icon name="database" size={14} /> },
      { key: 'secrets', label: '保密字典', icon: <Icon name="backup" size={14} /> },
    ],
  },
  { key: 'monitor', label: '监控告警', icon: <Icon name="monitor" size={14} /> },
];

/**
 * Collapsed rail. A row with an icon shows only the icon; a row without one
 * keeps its label, so the button is never empty. Nested pages stay closed.
 */
export const CollapsedMenu: Story = {
  name: 'collapsed menu',
  render: () => (
    <div className="flex items-start gap-6">
      <div className="w-56 rounded-ai-lg border border-ai-line bg-ai-surface-1 p-1">
        <Menu items={ITEMS} activeKey="pods" collapsed aria-label="无图标的折叠导航" />
      </div>
      <div className="w-14 rounded-ai-lg border border-ai-line bg-ai-surface-1 p-1">
        <Menu items={COLLAPSED_ICONS} activeKey="monitor" collapsed aria-label="带图标的折叠导航" />
      </div>
    </div>
  ),
};
