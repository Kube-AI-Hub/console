import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { ResourceList } from '../src/schema/ResourceList';

const meta: Meta<typeof ResourceList> = {
  title: 'Schema/ResourceList',
  component: ResourceList,
  parameters: { layout: 'padded' },
};
export default meta;

export const RefreshAndPaging: StoryObj = {
  render: () => {
    const [page, setPage] = React.useState(1);
    const [pageSize, setPageSize] = React.useState(20);
    const [search, setSearch] = React.useState('');
    const [revision, setRevision] = React.useState(0);
    const [busy, setBusy] = React.useState(false);
    React.useEffect(() => {
      if (!busy) return;
      const timer = window.setTimeout(() => {
        setRevision((value) => value + 1);
        setBusy(false);
      }, 800);
      return () => window.clearTimeout(timer);
    }, [busy]);
    const rows = Array.from({ length: 73 }, (_, index) => ({
      name: `workload-${String(index + 1).padStart(2, '0')}`,
      revision,
    })).filter((row) => row.name.includes(search));
    return (
      <ResourceList
        schema={{
          title: '工作负载',
          description: '刷新保留当前条件；切换每页条数回到第一页。',
          rowKey: 'name',
          search: { placeholder: '按名称搜索' },
          refresh: { label: '刷新', aiId: 'list-demo:refresh', busy },
          sortAiPrefix: 'list-demo',
          columns: [
            { key: 'name', title: '名称' },
            { key: 'revision', title: '刷新次数', type: 'number' },
          ],
          empty: { title: '没有匹配的工作负载' },
          pagination: { page, pageSize, pageSizeOptions: [10, 20, 50, 100], total: rows.length },
        }}
        rows={rows.slice((page - 1) * pageSize, page * pageSize)}
        searchValue={search}
        onSearchChange={(value) => { setSearch(value); setPage(1); }}
        onRefresh={() => setBusy(true)}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
      />
    );
  },
};
