import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { Input, Textarea, InputPassword, InputSearch } from '../src/primitives/Input';
import { Icon } from '../src/primitives/Icon';
import { ComponentDocs } from './_docs-layout';

const meta: Meta<typeof Input> = {
  title: 'Components/Input',
  component: Input,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="Input"
          summary="单行文本输入。表单里必须配 <label> 或 aria-label。"
          description={
            <>
              输入框本身不带标签与错误文案，那是 <code>FormField</code> / <code>Form.Item</code> 的职责。
              校验失败时传 <code>aria-invalid</code>，边框会转为危险色；只靠红色边框传达错误是不够的，
              必须同时给出文字说明。
            </>
          }
        />
      ),
    },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const BasicInput: Story = {
  name: 'basic input',
  render: () => (
    <div className="flex max-w-sm flex-col gap-3">
      <Input aria-label="名称" placeholder="请输入名称" />
      <Input aria-label="只读" defaultValue="不可编辑的值" readOnly />
      <Input aria-label="成功" aria-invalid={false} defaultValue="api-server" />
      <Input aria-label="错误" aria-invalid defaultValue="" placeholder="此项为必填" />
      <Input aria-label="禁用" disabled defaultValue="禁用状态" />
    </div>
  ),
};

/** 前后缀图标是装饰性的，会被排除在无障碍树之外。 */
export const WithAffixes: Story = {
  name: 'with affixes',
  render: () => (
    <div className="flex max-w-sm flex-col gap-3">
      <Input aria-label="搜索" placeholder="搜索资源" leading={<Icon name="magnifier" />} />
      <Input aria-label="命名空间" placeholder="kube-system" trailing={<span className="text-[10px] text-ai-fg-faint">可选</span>} />
    </div>
  ),
};

/** 密码字段带小眼睛按钮，可切换明文查看；按钮本身可被键盘操作。 */
export const Password: Story = {
  name: 'password',
  render: () => (
    <div className="flex max-w-sm flex-col gap-3">
      <InputPassword defaultValue="secret-value" aria-label="密码" />
      <InputPassword defaultValue="always-visible" defaultVisible aria-label="默认明文" />
      <InputPassword defaultValue="locked" disabled aria-label="禁用" />
    </div>
  ),
};

/** 搜索框：回车或点按钮才提交，适合服务端查询。 */
export const Search: Story = {
  name: 'search input',
  render: () => {
    const [query, setQuery] = React.useState('');
    const [submitted, setSubmitted] = React.useState('');
    return (
      <div className="flex max-w-md flex-col gap-2">
        <InputSearch
          value={query}
          onChange={setQuery}
          onSearch={setSubmitted}
          placeholder="按名称搜索"
          aria-label="搜索"
        />
        <p className="text-xs text-ai-fg-muted">已提交的查询：{submitted || '（尚未搜索）'}</p>
      </div>
    );
  },
};

/** 不要按钮时只保留 Enter 提交，适合工具栏里的紧凑搜索。 */
export const SearchWithoutButton: Story = {
  name: 'search without button',
  render: () => (
    <div className="max-w-sm">
      <InputSearch hideButton onSearch={() => undefined} placeholder="回车搜索" aria-label="搜索" />
    </div>
  ),
};

/** 多行文本。会保留用户的换行，不要对内容做 trim。 */
export const BasicTextarea: Story = {
  name: 'basic textarea',
  render: () => <Textarea className="max-w-sm" aria-label="说明" placeholder="补充说明（可选）" rows={4} />,
};
