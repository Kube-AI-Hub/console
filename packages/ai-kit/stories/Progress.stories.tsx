import type { Meta, StoryObj } from '@storybook/react';
import { Progress, resolveProgressTone } from '../src/primitives/Display';
import { ComponentDocs } from './_docs-layout';

const meta: Meta<typeof Progress> = {
  title: 'Components/Progress',
  component: Progress,
  tags: ['autodocs'],
  argTypes: {
    tone: { control: 'select', options: ['accent', 'success', 'warning', 'danger', 'auto'] },
    value: { control: { type: 'range', min: 0, max: 100 } },
  },
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="Progress"
          summary="表示一个任务的完成度或一个容量的占用率。"
          description={
            <>
              两种情况不要混用：<strong>进度</strong>（部署中 62%）是从 0 到 100 前进的过程，
              用户关心还要多久；<strong>水位</strong>（磁盘已用 87%）是当前占用，
              用户关心是否接近上限。后者用 <code>tone=&quot;auto&quot;</code>，
              超过阈值自动转黄、转红，不需要额外图例。
            </>
          }
        />
      ),
    },
  },
};

export default meta;
type Story = StoryObj<typeof Progress>;

export const BasicProgress: Story = {
  name: 'basic progress',
  render: () => (
    <div className="flex max-w-md flex-col gap-4">
      <Progress value={25} label="部署进度 25%" />
      <Progress value={62} label="部署进度 62%" />
      <Progress value={100} label="部署完成" />
    </div>
  ),
};

/** 阈值判色：≥80 转警告，≥95 转危险。 */
export const ProgressAutoStatus: Story = {
  name: 'progress auto status',
  render: () => (
    <div className="flex max-w-md flex-col gap-3">
      {[30, 79, 80, 94, 95, 100].map((value) => (
        <div key={value} className="flex items-center gap-3">
          <span className="w-10 shrink-0 font-ai-mono text-[11px] text-ai-fg-muted">{value}%</span>
          <Progress value={value} tone="auto" label={`占用 ${value}%`} className="flex-1" />
          <span className="w-16 shrink-0 text-right text-[11px] text-ai-fg-secondary">
            {resolveProgressTone(value)}
          </span>
        </div>
      ))}
    </div>
  ),
};

/** 自定义阈值用于更严格的场景，例如内存。 */
export const CustomThresholds: Story = {
  name: 'custom thresholds',
  render: () => (
    <div className="flex max-w-md flex-col gap-3">
      <Progress value={45} tone="auto" thresholds={[50, 80]} label="内存 45%" />
      <Progress value={60} tone="auto" thresholds={[50, 80]} label="内存 60%" />
      <Progress value={85} tone="auto" thresholds={[50, 80]} label="内存 85%" />
    </div>
  ),
};

/** 固定色用于与状态无关的进度，例如下载。 */
export const FixedTone: Story = {
  name: 'fixed tone',
  render: () => (
    <div className="flex max-w-md flex-col gap-3">
      <Progress value={40} tone="accent" label="下载中" />
      <Progress value={100} tone="success" label="已完成" />
    </div>
  ),
};
