import type { Meta, StoryObj } from '@storybook/react';
import { Breadcrumb } from '../src/primitives/Navigation';
import { ComponentDocs } from './_docs-layout';

const breadcrumbMeta: Meta<typeof Breadcrumb> = {
  title: 'Components/Breadcrumb',
  component: Breadcrumb,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="Breadcrumb"
          summary="显示当前页面在层级中的位置，并提供向上的快捷跳转。"
          description={
            <>
              最后一项是当前页，不可点击。层级超过四层时，中间层折叠为省略号，
              保留首尾两项——用户需要知道自己在哪、能回到哪。
            </>
          }
        />
      ),
    },
  },
};

export default breadcrumbMeta;

type BreadcrumbStory = StoryObj<typeof Breadcrumb>;

export const BasicBreadcrumb: BreadcrumbStory = {
  name: 'basic breadcrumb',
  render: () => (
    <Breadcrumb
      items={[
        { label: '集群', href: '#' },
        { label: 'default', href: '#' },
        { label: '工作负载', href: '#' },
        { label: 'api-server-7d8f9' },
      ]}
    />
  ),
};
