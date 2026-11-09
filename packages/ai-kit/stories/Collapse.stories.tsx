import type { Meta, StoryObj } from '@storybook/react';
import { Collapse } from '../src/primitives/Menu';
import { ComponentDocs } from './_docs-layout';

const collapseMeta: Meta<typeof Collapse> = {
  title: 'Components/Collapse',
  component: Collapse,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="Collapse"
          summary="把次要内容折叠起来。同时展开多项；只允许一项时用 accordion。"
          description={
            <>
              折叠面板适合<strong>页内可选的补充信息</strong>（高级设置、排查细节）。
              需要用户主动查看才展示的内容才折叠；影响决策的信息必须默认可见。
            </>
          }
        />
      ),
    },
  },
};

export default collapseMeta;

type CollapseStory = StoryObj<typeof Collapse>;

const COLLAPSE_ITEMS = [
  { key: '1', title: '调度策略', content: '默认按资源可用性调度，可指定节点亲和性。' },
  { key: '2', title: '存储卷', content: '支持本地卷、NFS 与 JuiceFS 挂载。' },
  { key: '3', title: '网络', content: '使用 Calico 提供 Pod 网络与网络策略。' },
];

export const BasicCollapse: CollapseStory = {
  name: 'basic collapse',
  render: () => (
    <div className="max-w-xl">
      <Collapse items={COLLAPSE_ITEMS} defaultOpenKeys={['1']} />
    </div>
  ),
};

export const AccordionCollapse: CollapseStory = {
  name: 'accordion',
  render: () => (
    <div className="max-w-xl">
      <Collapse items={COLLAPSE_ITEMS} accordion defaultOpenKeys={['1']} />
    </div>
  ),
};
