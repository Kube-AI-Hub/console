import type { Meta, StoryObj } from '@storybook/react';
import { Loading } from '../src/primitives/Feedback';
import { ComponentDocs } from './_docs-layout';

const loadingMeta: Meta<typeof Loading> = {
  title: 'Components/Loading',
  component: Loading,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="Loading"
          summary="表示一块区域正在加载，占位时长超过 300ms 时才应出现。"
          description={
            <>
              短暂的加载（&lt; 300ms）直接显示结果，不要闪一个加载态，否则用户会感到页面在抖动。
              需要表达<strong>结构轮廓</strong>而非单纯等待时，用 <code>Skeleton</code> 代替。
            </>
          }
        />
      ),
    },
  },
};

export default loadingMeta;
type LoadingStory = StoryObj<typeof Loading>;

/** 默认文案为「加载中」，在上下文明确时可以省略。 */
export const BasicLoading: LoadingStory = {
  name: 'basic alerts',
  render: () => <Loading />,
};

/** 加载的是具体资源时，写清在等什么，避免用户以为整页卡住。 */
export const CustomLabel: LoadingStory = {
  name: 'custom label',
  render: () => <Loading label="正在拉取节点指标" />,
};

/** 卡片内的局部加载，容器决定高度，Loading 只负责居中的指示器。 */
export const InsideCard: LoadingStory = {
  name: 'inside card',
  render: () => (
    <div className="max-w-md rounded-ai-lg border border-ai-line bg-ai-surface-1">
      <div className="flex items-center justify-between border-b border-ai-line px-4 py-3">
        <span className="text-sm font-semibold text-ai-fg">节点列表</span>
        <span className="text-xs text-ai-fg-muted">12 个</span>
      </div>
      <Loading label="正在加载节点" />
    </div>
  ),
};
