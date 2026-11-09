import type { Meta, StoryObj } from '@storybook/react';
import { Textarea } from '../src/primitives/Input';
import { ComponentDocs } from './_docs-layout';

const meta: Meta<typeof Textarea> = {
  title: 'Components/TextArea',
  component: Textarea,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="TextArea"
          summary="多行文本输入。保留用户的换行，适合说明、YAML 片段与备注。"
          description={
            <>
              导出名为 <code>Textarea</code>，对应 kube-design 的 <code>TextArea</code>。
              只在需要反复修改的短文本里使用；结构化配置（YAML / JSON）应该用带语法高亮的编辑器，
              而不是一个文本域。
            </>
          }
        />
      ),
    },
  },
};

export default meta;
type Story = StoryObj<typeof Textarea>;

export const BasicTextarea: Story = {
  name: 'basic textarea',
  render: () => (
    <div className="max-w-md">
      <Textarea aria-label="说明" placeholder="补充说明（可选）" rows={4} />
    </div>
  ),
};

/** 预设行数同时设定最小高度，用户可以继续拉高。 */
export const WithRows: Story = {
  name: 'with rows',
  render: () => (
    <div className="flex max-w-md flex-col gap-3">
      <Textarea aria-label="两行" rows={2} defaultValue="第一行&#10;第二行" />
      <Textarea aria-label="六行" rows={6} placeholder="六行高度" />
    </div>
  ),
};

/** 校验失败时标记 invalid，并配文字说明。 */
export const States: Story = {
  name: 'states',
  render: () => (
    <div className="flex max-w-md flex-col gap-3">
      <Textarea aria-label="普通" placeholder="普通状态" />
      <Textarea aria-label="错误" aria-invalid defaultValue="" placeholder="此项为必填" />
      <Textarea aria-label="禁用" disabled defaultValue="不可编辑的内容" />
      <Textarea aria-label="只读" readOnly rows={3} defaultValue={'labels:\n  app: nginx'} />
    </div>
  ),
};

/** 关闭手动缩放以保持布局稳定，但仍允许滚动。 */
export const NoResize: Story = {
  name: 'no resize',
  render: () => (
    <div className="max-w-md">
      <Textarea aria-label="固定高度" rows={3} className="resize-none" placeholder="不允许拖动调整高度" />
    </div>
  ),
};
