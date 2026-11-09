import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { Tag } from '../src/primitives/Display';
import { ComponentDocs } from './_docs-layout';

/* ---------------- Tag ---------------- */

const meta: Meta<typeof Tag> = {
  title: 'Components/Tag',
  component: Tag,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="Tag"
          summary="标注资源的分类、标签或可移除的筛选条件。"
          description={
            <>
              与 <code>Badge</code> 的分工：Tag 是用户数据（k8s label、筛选条件），可以带移除按钮；
              Badge 是系统派生的状态（Running、副本数），不可交互。
              需要表达状态时用 <code>&lt;Badge text=&quot;运行中&quot; /&gt;</code>。
            </>
          }
        />
      ),
    },
  },
};

export default meta;
type Story = StoryObj<typeof Tag>;

export const BasicTag: Story = {
  name: 'basic tag',
  render: () => {
    const [tags, setTags] = React.useState(['app=nginx', 'tier=frontend', 'env=prod']);
    return (
      <div className="flex flex-wrap items-center gap-2">
        {tags.map((tag) => (
          <Tag key={tag} onRemove={() => setTags((current) => current.filter((item) => item !== tag))}>
            {tag}
          </Tag>
        ))}
        {tags.length === 0 ? <span className="text-xs text-ai-fg-muted">已全部移除</span> : null}
      </div>
    );
  },
};

/** 语义色让标签在密集列表里可区分；颜色不是唯一编码，文字仍然承担信息。 */
export const TagTones: Story = {
  name: 'tag tones',
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      {(['neutral', 'accent', 'info', 'success', 'warning', 'danger'] as const).map((tone) => (
        <Tag key={tone} tone={tone}>{tone}</Tag>
      ))}
      <Tag color="#8b5cf6">自定义颜色</Tag>
    </div>
  ),
};
