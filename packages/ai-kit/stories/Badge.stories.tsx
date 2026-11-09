import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '../src/primitives/Display';
import { ComponentDocs } from './_docs-layout';

const badgeMeta: Meta<typeof Badge> = {
  title: 'Components/Badge',
  component: Badge,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="Badge"
          summary="系统派生的状态或计数。不可点击、不可移除。"
          description={
            <>
              三种形态：<strong>状态文字</strong>（<code>text</code> + 色点，用于表格状态列）、
              <strong>计数</strong>（<code>count</code>，超出 <code>max</code> 显示 <code>99+</code>）、
              <strong>胶囊标签</strong>（默认，用于分类）。颜色只是辅助，文字本身必须能表达状态。
            </>
          }
        />
      ),
    },
  },
};

export default badgeMeta;

type BadgeStory = StoryObj<typeof Badge>;

export const BadgeStates: BadgeStory = {
  name: 'status text',
  render: () => (
    <div className="flex flex-wrap gap-5">
      <Badge text="运行中" tone="success" />
      <Badge text="等待调度" tone="warning" />
      <Badge text="失败" tone="danger" />
      <Badge text="已停止" tone="neutral" />
      <Badge text="同步中" tone="info" />
    </div>
  ),
};

export const BadgeCounts: BadgeStory = {
  name: 'counts',
  render: () => (
    <div className="flex items-center gap-3">
      <Badge count={0} />
      <Badge count={7} tone="accent" />
      <Badge count={99} tone="info" />
      <Badge count={100} tone="danger" />
      <Badge count={50} max={10} tone="warning" />
    </div>
  ),
};
