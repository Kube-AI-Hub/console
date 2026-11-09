import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { Select } from '../src/primitives/Select';
import { ComponentDocs } from './_docs-layout';

const meta: Meta<typeof Select> = {
  title: 'Components/Select',
  component: Select,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="Select"
          summary="从固定集合中选一个值。选项不超过 7 个时可考虑改用 RadioGroup。"
          description={
            <>
              Select 约束取值必须来自 <code>options</code>；如果不能确定候选值（例如命名空间名），
              用 <code>AutoComplete</code>，它允许自由输入并给出建议。
              键盘操作遵循原生 select 习惯：上下移动、回车确认、Esc 关闭。
            </>
          }
        />
      ),
    },
  },
};

export default meta;
type Story = StoryObj<typeof Select>;

const BASIC = [
  { value: 'rolling', label: '滚动更新' },
  { value: 'recreate', label: '重建' },
  { value: 'manual', label: '手动（禁用）', disabled: true },
];

export const BasicSelect: Story = {
  name: 'select',
  render: () => {
    const [value, setValue] = React.useState('');
    return (
      <div className="flex max-w-sm flex-col gap-3">
        <Select options={BASIC} value={value} onValueChange={setValue} placeholder="请选择更新策略" aria-label="更新策略" />
        <Select options={BASIC} disabled placeholder="禁用状态" aria-label="禁用" />
        <p className="text-xs text-ai-fg-muted">当前值：{value || '（空）'}</p>
      </div>
    );
  },
};

/** 长列表会滚动，并保持触发器宽度。 */
export const LongList: Story = {
  name: 'long list',
  render: () => {
    const options = Array.from({ length: 30 }, (_, index) => ({
      value: `ns-${index}`,
      label: `namespace-${String(index).padStart(2, '0')}`,
    }));
    return (
      <Select className="max-w-sm" options={options} placeholder="选择命名空间" aria-label="命名空间" />
    );
  },
};

/** 允许自由输入并给出建议，值不受选项约束。 */
export const Searchable: Story = {
  name: 'select-searchable',
  render: () => {
    const [value, setValue] = React.useState('');
    const options = [
      'default',
      'kube-system',
      'kubesphere-system',
      'monitoring',
      'agent-platform',
      'gateway-system',
    ].map((item) => ({ value: item, label: item }));
    return (
      <div className="flex max-w-sm flex-col gap-2">
        <Select
          searchable
          options={options}
          value={value}
          onValueChange={setValue}
          placeholder="输入关键词筛选"
          aria-label="命名空间"
        />
        <p className="text-xs text-ai-fg-muted">当前值：{value || '（空）'}，输入 kube 试试</p>
      </div>
    );
  },
};

/** 多选搜索场景下，选项很多时搜索几乎是必需的。 */
export const SearchableLongList: Story = {
  name: 'select-searchable long list',
  render: () => {
    const [value, setValue] = React.useState('');
    const options = Array.from({ length: 40 }, (_, index) => ({
      value: `node-${index}`,
      label: `gpu-node-${String(index).padStart(2, '0')}`,
    }));
    return (
      <div className="max-w-sm">
        <Select searchable options={options} value={value} onValueChange={setValue} placeholder="搜索节点" aria-label="节点" />
      </div>
    );
  },
};
