import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../src/primitives/Button';
import { Icon } from '../src/primitives/Icon';
import { ComponentDocs } from './_docs-layout';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'danger', 'link'] },
    size: { control: 'select', options: ['sm', 'md', 'lg', 'icon'] },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="Button"
          summary="触发一个动作。一屏内只应有一个 primary。"
          description={
            <>
              <strong>primary</strong> 用于当前区域的主要动作（提交、创建），它是页面上最亮的东西；
              <strong>secondary</strong> 用于次要动作（刷新、导出）；<strong>ghost</strong> 用于工具栏与行内操作；
              <strong>danger</strong> 只用于删除、停止这类不可逆动作。
              处于 <code>loading</code> 时按钮自动禁用，避免重复提交。
            </>
          }
        />
      ),
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const BasicButtons: Story = {
  name: 'basic buttons',
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary">创建实例</Button>
      <Button variant="secondary">刷新</Button>
      <Button variant="ghost">取消</Button>
      <Button variant="danger">删除</Button>
      <Button variant="link">查看文档</Button>
    </div>
  ),
};

/** 图标与文字并排时，图标默认随文字继承颜色。仅图标的按钮必须带 `aria-label`。 */
export const ButtonsWithIcon: Story = {
  name: 'buttons with icon',
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary"><Icon name="add" /> 新建</Button>
      <Button variant="secondary"><Icon name="refresh" /> 刷新</Button>
      <Button variant="ghost" size="icon" aria-label="更多操作"><Icon name="more" /></Button>
      <Button variant="ghost" size="icon" aria-label="设置"><Icon name="cogwheel" /></Button>
    </div>
  ),
};

/** 加载中会禁用点击并保留原宽度，避免布局跳动。 */
export const ButtonLoading: Story = {
  name: 'button loading',
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary" loading>部署中</Button>
      <Button variant="secondary" loading>同步中</Button>
      <Button variant="primary" disabled>已禁用</Button>
    </div>
  ),
};

/** 三种尺寸覆盖工具栏、常规表单与强调操作。 */
export const Sizes: Story = {
  name: 'sizes',
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm" variant="secondary">小</Button>
      <Button size="md" variant="secondary">中</Button>
      <Button size="lg" variant="secondary">大</Button>
    </div>
  ),
};
