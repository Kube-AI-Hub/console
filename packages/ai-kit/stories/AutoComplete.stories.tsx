import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { AutoComplete } from '../src/primitives/AutoComplete';
import { ComponentDocs } from './_docs-layout';

const meta: Meta<typeof AutoComplete> = {
  title: 'Components/AutoComplete',
  component: AutoComplete,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="AutoComplete"
          summary="允许自由输入的输入框，同时给出候选建议。"
          description={
            <>
              与 <code>Select</code> 的分工：Select <strong>约束取值</strong>必须来自选项；
              AutoComplete 只是<strong>建议</strong>，用户可以输入列表里没有的值。
              命名空间名、镜像地址这类「常见但不封闭」的字段用它。
              键盘操作遵循 combobox：上下移动高亮，回车确认，Esc 收起。
            </>
          }
        />
      ),
    },
  },
};

export default meta;
type Story = StoryObj<typeof AutoComplete>;

const NAMESPACES = ['default', 'kube-system', 'kubesphere-system', 'agent-platform', 'monitoring'].map(
  (value) => ({ value }),
);

export const BasicAutocomplete: Story = {
  name: 'basic autocomplete',
  render: () => {
    const [value, setValue] = React.useState('');
    return (
      <div className="flex max-w-sm flex-col gap-2">
        <AutoComplete
          value={value}
          onChange={setValue}
          options={NAMESPACES}
          placeholder="输入或选择命名空间"
          aria-label="命名空间"
        />
        <p className="text-xs text-ai-fg-muted">当前值：{value || '（空）'}</p>
      </div>
    );
  },
};

/** 自定义过滤：这里按前缀匹配而不是子串。 */
export const CustomFilter: Story = {
  name: 'custom filter',
  render: () => {
    const [value, setValue] = React.useState('');
    return (
      <div className="max-w-sm">
        <AutoComplete
          value={value}
          onChange={setValue}
          options={NAMESPACES}
          filter={(option, query) => option.value.startsWith(query)}
          placeholder="按前缀匹配"
          aria-label="前缀匹配"
        />
      </div>
    );
  },
};

/** 空结果给出明确提示，不要留一个空白面板。 */
export const EmptyState: Story = {
  name: 'empty state',
  render: () => {
    const [value, setValue] = React.useState('no-such-namespace');
    return (
      <div className="max-w-sm">
        <AutoComplete
          value={value}
          onChange={setValue}
          options={NAMESPACES}
          emptyText="没有匹配的命名空间"
          aria-label="空结果"
        />
      </div>
    );
  },
};

/** 禁用态的选项不会响应点击，但仍显示在列表里。 */
export const DisabledOption: Story = {
  name: 'disabled option',
  render: () => (
    <div className="max-w-sm">
      <AutoComplete
        options={[
          { value: 'default' },
          { value: 'kube-system' },
          { value: 'reserved', disabled: true },
        ]}
        placeholder="尝试选择 reserved"
        aria-label="含禁用项"
      />
    </div>
  ),
};
