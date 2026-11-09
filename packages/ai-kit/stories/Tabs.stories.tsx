import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { Tabs } from '../src/primitives/Navigation';
import { ComponentDocs } from './_docs-layout';

const meta: Meta<typeof Tabs> = {
  title: 'Components/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="Tabs"
          summary="在同一个上下文里切换视图。切换不改变路由时不写进 URL。"
          description={
            <>
              Tabs 是<strong>同一个对象的几个视角</strong>（概览 / 监控 / 事件），不是导航；
              需要在不同页面之间跳转时用左侧菜单。默认选中第一项，切换保持页面其他部分不重建。
            </>
          }
        />
      ),
    },
  },
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const BasicTabs: Story = {
  name: 'basic tabs',
  render: () => (
    <div className="max-w-xl">
      <Tabs
        defaultValue="overview"
        items={[
          { value: 'overview', label: '概览' },
          { value: 'monitor', label: '监控' },
          { value: 'events', label: '事件' },
        ]}
      />
    </div>
  ),
};

/** 计数徽标让用户不必点开就知道哪里有内容。 */
export const WithCounts: Story = {
  name: 'with counts',
  render: () => (
    <div className="max-w-xl">
      <Tabs
        defaultValue="events"
        items={[
          { value: 'overview', label: '概览' },
          { value: 'monitor', label: '监控', count: 3 },
          { value: 'events', label: '事件', count: 12 },
        ]}
      />
    </div>
  ),
};

/** 受控用法，便于把当前 tab 写进 URL 查询串。 */
export const Controlled: Story = {
  name: 'controlled',
  render: () => {
    const [value, setValue] = React.useState('overview');
    return (
      <div className="flex max-w-xl flex-col gap-3">
        <Tabs
          value={value}
          onValueChange={setValue}
          items={[
            { value: 'overview', label: '概览' },
            { value: 'monitor', label: '监控' },
            { value: 'events', label: '事件' },
          ]}
        />
        <p className="text-xs text-ai-fg-muted">当前：{value}</p>
      </div>
    );
  },
};
