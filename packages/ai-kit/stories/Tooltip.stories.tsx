import type { Meta, StoryObj } from '@storybook/react';
import { Tooltip } from '../src/primitives/Feedback';
import { Button } from '../src/primitives/Button';
import { Icon } from '../src/primitives/Icon';
import { ComponentDocs } from './_docs-layout';

const meta: Meta<typeof Tooltip> = {
  title: 'Components/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="Tooltip"
          summary="悬停或聚焦时补充说明。只用于非必要的辅助信息。"
          description={
            <>
              Tooltip 的内容<strong>不能是操作必需的</strong>：触屏用户无法悬停，
              键盘用户也只能在聚焦触发器时看到。凡是要靠 tooltip 才能完成的操作，都是缺陷。
              需要承载按钮或表单时用 <code>Popover</code>；
              需要在点击后保持打开时传 <code>trigger=&quot;click&quot;</code>。
            </>
          }
        />
      ),
    },
  },
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const BasicTooltip: Story = {
  name: 'basic tooltip',
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Tooltip content="悬停 200ms 后出现">
        <Button variant="secondary">hover 触发</Button>
      </Tooltip>
      <Tooltip content="点击才出现，再点一次关闭" trigger="click">
        <Button variant="secondary">click 触发</Button>
      </Tooltip>
      <Tooltip content="出现在下方" side="bottom">
        <Button variant="ghost">下方</Button>
      </Tooltip>
      <Tooltip content="出现在右侧" side="right">
        <Button variant="ghost">右侧</Button>
      </Tooltip>
    </div>
  ),
};

/** 图标按钮没有可见文字，tooltip 就是它唯一的名字——但仍需 `aria-label`。 */
export const IconOnlyTrigger: Story = {
  name: 'icon only trigger',
  render: () => (
    <div className="flex items-center gap-3">
      <Tooltip content="刷新列表">
        <Button variant="ghost" size="icon" aria-label="刷新列表">
          <Icon name="refresh" />
        </Button>
      </Tooltip>
      <Tooltip content="更多操作">
        <Button variant="ghost" size="icon" aria-label="更多操作">
          <Icon name="more" />
        </Button>
      </Tooltip>
    </div>
  ),
};

/** 长内容要能换行，并给出宽度上限，否则会拉成一条不可读的长条。 */
export const LongContent: Story = {
  name: 'long content',
  render: () => (
    <Tooltip content="节点亲和性用于约束 Pod 可以调度到哪些节点上，支持硬性要求与软性偏好两种模式。">
      <Button variant="link">什么是节点亲和性？</Button>
    </Tooltip>
  ),
};
