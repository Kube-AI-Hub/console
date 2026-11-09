import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { Dropdown } from '../src/primitives/Navigation';
import { Button } from '../src/primitives/Button';
import { ComponentDocs } from './_docs-layout';

const meta: Meta<typeof Dropdown> = {
  title: 'Components/Dropdown',
  component: Dropdown,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="Dropdown"
          summary="从触发器展开一组动作。用于行操作与工具栏的次要操作。"
          description={
            <>
              菜单项是<strong>动作</strong>而非导航；跳转用链接或左侧菜单。
              危险动作放在最后，并用分隔线隔开，避免误点。
              <code>closeOnSelect=false</code> 适合需要连续执行的批量操作。
            </>
          }
        />
      ),
    },
  },
};

export default meta;
type Story = StoryObj<typeof Dropdown>;

/** 行内「更多」菜单的典型形态。 */
export const BasicDropdown: Story = {
  name: 'basic dropdown',
  render: () => (
    <Dropdown
      trigger={<Button variant="secondary">更多操作</Button>}
      items={[
        { key: 'view', label: '查看 YAML' },
        { key: 'edit', label: '编辑配置' },
        { key: 'restart', label: '重启' },
        { key: 'delete', label: '删除', danger: true, dividerBefore: true },
      ]}
    />
  ),
};

/** 受控展开：由外部按钮或快捷键驱动。 */
export const Controlled: Story = {
  name: 'controlled',
  render: () => {
    const [open, setOpen] = React.useState(false);
    return (
      <div className="flex items-center gap-3">
        <Dropdown
          open={open}
          onOpenChange={setOpen}
          trigger={<Button variant="secondary">菜单（{open ? '已展开' : '已收起'}）</Button>}
          items={[
            { key: 'a', label: '第一项' },
            { key: 'b', label: '第二项' },
          ]}
        />
        <Button variant="ghost" onClick={() => setOpen((value) => !value)}>外部切换</Button>
      </div>
    );
  },
};
