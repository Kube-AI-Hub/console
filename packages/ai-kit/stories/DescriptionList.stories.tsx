import type { Meta, StoryObj } from '@storybook/react';
import { DescriptionList } from '../src/primitives/DescriptionList';
import { Panel } from '../src/primitives/Display';
import { ComponentDocs } from './_docs-layout';

const meta: Meta<typeof DescriptionList> = {
  title: 'Components/DescriptionList',
  component: DescriptionList,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="DescriptionList"
          summary="只读的 label / value 清单，用于详情页与设置弹窗。"
          description={
            <>
              详情页和设置弹窗都要展示「一个对象的若干事实」，但各页手写的行已经出现漂移：
              有的值用主色、有的用次色，换行规则也不一致。<code>DescriptionList</code> 用
              <code>&lt;dl&gt; / &lt;dt&gt; / &lt;dd&gt;</code> 语义把它们统一起来；空值统一显示
              <code>-</code>；需要让自动化精确读取的字段可以给 <code>aiId</code>，句柄落在
              值节点（<code>&lt;span&gt;</code>）上——不是 <code>&lt;dd&gt;</code>，因为
              <code>&lt;dd&gt;</code> 里还可能有 hint，精确文本断言不该把说明文字算进去。
              <code>DescriptionItem</code> 只渲染 <code>dt/dd</code> 片段、不带外层容器，
              所以可以直接放进页面自己的网格（详情页的两列或单列布局都不受影响）。
            </>
          }
        />
      ),
    },
  },
};

export default meta;
type Story = StoryObj<typeof DescriptionList>;

const DETAIL_ITEMS = [
  { label: '节点名称', value: 'a100-04', aiId: 'detail:node-name' },
  { label: '内网 IP', value: '10.0.0.14', aiId: 'detail:ip' },
  { label: '操作系统', value: 'Ubuntu 22.04.3 LTS' },
  { label: '容器运行时', value: 'containerd 1.7.13' },
  { label: 'GPU', value: '8 × NVIDIA A100 80GB' },
];

/** 详情页的典型形态：面板里一组两列的事实清单。 */
export const DetailList: Story = {
  name: 'detail list',
  render: () => (
    <div className="mx-auto max-w-2xl">
      <Panel title="基本信息">
        <DescriptionList items={DETAIL_ITEMS} />
      </Panel>
    </div>
  ),
};

/** hint 放值下方的小字，用来解释「这个字段是什么 / 为什么不能改」。 */
export const WithHints: Story = {
  name: 'items with hints',
  render: () => (
    <div className="mx-auto max-w-2xl">
      <Panel title="账号">
        <DescriptionList
          items={[
            { label: '用户名', value: 'admin', hint: '登录账号，不能修改。' },
            { label: '平台角色', value: '平台管理员', hint: '由平台管理员分配，不能自行修改。' },
            { label: '邮箱', value: 'admin@example.com', hint: '邮箱地址可用于登录 Web 控制台。' },
          ]}
        />
      </Panel>
    </div>
  ),
};

/** 空值（null / undefined / 空串）统一显示为短横线，而不是留白。 */
export const EmptyValue: Story = {
  name: 'empty value',
  render: () => (
    <div className="mx-auto max-w-2xl">
      <Panel title="基本信息" description="没有值的字段仍占位，避免读者以为少了一行。">
        <DescriptionList
          items={[
            { label: '邮箱', value: '' },
            { label: '平台角色', value: null },
            { label: '备注', value: undefined },
            { label: '内网 IP', value: '10.0.0.14' },
          ]}
        />
      </Panel>
    </div>
  ),
};
