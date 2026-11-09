import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { Checkbox, CheckboxGroup } from '../src/primitives/Toggles';
import { ComponentDocs } from './_docs-layout';

const meta: Meta<typeof Checkbox> = {
  title: 'Components/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="Checkbox"
          summary="多选，或表示接受某个条件。三态用于表格表头的全选。"
          description={
            <>
              Checkbox 表达「可以多选」；只有一个选项且互斥的场景请用 <code>Switch</code>（立即生效）
              或 <code>RadioGroup</code>（成组提交）。三态（<code>indeterminate</code>）用于部分选中的父项。
            </>
          }
        />
      ),
    },
  },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const BasicCheckbox: Story = {
  name: 'basic checkbox',
  render: () => {
    const [checked, setChecked] = React.useState(true);
    const [indeterminate, setIndeterminate] = React.useState(true);
    return (
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm text-ai-fg-secondary">
          <Checkbox checked={checked} onCheckedChange={setChecked} aria-label="接受条款" />
          我已阅读并同意服务条款
        </label>
        <label className="flex items-center gap-2 text-sm text-ai-fg-secondary">
          <Checkbox checked={indeterminate} onCheckedChange={setIndeterminate} aria-label="部分选中" />
          部分选中（indeterminate）
        </label>
        <label className="flex items-center gap-2 text-sm text-ai-fg-secondary">
          <Checkbox disabled aria-label="禁用" />
          禁用状态
        </label>
      </div>
    );
  },
};

/** 成组时父项随子项数量自动切换全选 / 部分选中 / 未选。 */
export const CheckboxGroupStory: Story = {
  name: 'checkbox group',
  render: () => {
    const [selected, setSelected] = React.useState<string[]>(['api-server']);
    return (
      <div className="flex w-64 flex-col gap-3">
        <CheckboxGroup
          withSelectAll
          aria-label="控制面组件"
          value={selected}
          onChange={setSelected}
          direction="vertical"
          options={[
            { value: 'api-server', label: 'api-server' },
            { value: 'scheduler', label: 'scheduler' },
            { value: 'controller-manager', label: 'controller-manager' },
          ]}
        />
        <p className="text-xs text-ai-fg-muted">已选：{selected.join(', ') || '（无）'}</p>
      </div>
    );
  },
};

/** 选项带禁用项时，全选只作用于可选的那些。 */
export const CheckboxGroupWithDisabled: Story = {
  name: 'checkbox group with disabled',
  render: () => {
    const [selected, setSelected] = React.useState<string[]>([]);
    return (
      <div className="flex w-72 flex-col gap-3">
        <CheckboxGroup
          withSelectAll
          aria-label="权限"
          value={selected}
          onChange={setSelected}
          direction="vertical"
          options={[
            { value: 'read', label: '查看' },
            { value: 'write', label: '编辑' },
            { value: 'admin', label: '管理员（无权限授予）', disabled: true },
          ]}
        />
        <p className="text-xs text-ai-fg-muted">已选：{selected.join(', ') || '（无）'}</p>
      </div>
    );
  },
};
