import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { Tabs, TabsContent } from '../src/primitives/Navigation';
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
              <br />
              需要被自动化精确定位的页签传 <code>aiId</code>（落在触发器上）；
              未保存提示点用 <code>badge</code> 画点、<code>badgeLabel</code> 提供读屏文案；
              面板作为 <code>children</code> 传入、与触发器同属 Radix root（触发器的
              <code>aria-controls</code> 才指向真实节点），由 <code>TabsContent</code> 渲染。
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

/**
 * 未保存提示：点由调用方传入（这里 6px 的 warning 圆点），badgeLabel 是读屏文案。
 *
 * 点本身 aria-hidden，无障碍名称由 label + badgeLabel 组成；这样「有未保存修改」
 * 不只靠颜色传达。
 */
export const WithDirtyBadge: Story = {
  name: 'with dirty badge',
  render: () => (
    <div className="max-w-xl">
      <Tabs
        defaultValue="profile"
        items={[
          {
            value: 'profile',
            label: '基本信息',
            aiId: 'demo:tab-profile',
            badge: <span className="size-1.5 rounded-full bg-ai-warning" />,
            badgeLabel: '未保存的修改',
          },
          { value: 'password', label: '密码设置', aiId: 'demo:tab-password' },
        ]}
      />
    </div>
  ),
};

/**
 * 面板用法：把 TabsContent 作为 children 传进 Tabs。
 *
 * 触发器与面板在同一个 Radix root 下，aria-controls / aria-labelledby 才成对；
 * 切换页签只切换面板内容，外层页面不重建。
 */
export const WithContent: Story = {
  name: 'with content',
  render: () => (
    <div className="max-w-xl">
      <Tabs
        defaultValue="profile"
        items={[
          { value: 'profile', label: '基本信息' },
          { value: 'password', label: '密码设置' },
        ]}
      >
        <TabsContent value="profile" className="pt-3">
          <p className="text-xs leading-5 text-ai-fg-secondary">
            基本信息面板：用户名与平台角色只读，邮箱可以修改。
          </p>
        </TabsContent>
        <TabsContent value="password" className="pt-3">
          <p className="text-xs leading-5 text-ai-fg-secondary">
            密码设置面板：修改成功后需要重新登录。
          </p>
        </TabsContent>
      </Tabs>
    </div>
  ),
};
