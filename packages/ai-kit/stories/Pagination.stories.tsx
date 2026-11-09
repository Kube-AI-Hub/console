import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { Pagination } from '../src/primitives/Navigation';
import { ComponentDocs } from './_docs-layout';

const paginationMeta: Meta<typeof Pagination> = {
  title: 'Components/Pagination',
  component: Pagination,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="Pagination"
          summary="大列表的分页控制。总数少于两页时不应出现。"
          description={
            <>
              分页只在结果确实超出一页时显示，否则它会暗示还有更多数据。
              切换页时保持滚动位置在列表顶部，而不是停在原来的偏移。
            </>
          }
        />
      ),
    },
  },
};

export default paginationMeta;

type PaginationStory = StoryObj<typeof Pagination>;

export const BasicPagination: PaginationStory = {
  name: 'basic pagination',
  render: () => {
    const [page, setPage] = React.useState(1);
    return (
      <div className="flex flex-col gap-3">
        <Pagination page={page} pageSize={20} total={95} onChange={setPage} />
        <p className="text-xs text-ai-fg-muted">第 {page} 页，每页 20 条，共 95 条</p>
      </div>
    );
  },
};
