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

export const FiltersAndColumns: StoryObj = {
  render: () => {
    const [filters, setFilters] = React.useState<Record<string, string>>({});
    const [search, setSearch] = React.useState('');
    const [columns, setColumns] = React.useState(['name', 'vendor', 'model']);
    const rows = [{ name: 'node-a', vendor: 'NVIDIA', model: 'B200' }, { name: 'node-b', vendor: 'CPU', model: '-' }]
      .filter((row) => row.name.includes(search) && (!filters.vendor || filters.vendor.split(',').includes(row.vendor)) && row.model.includes(filters.model ?? ''));
    return <ResourceList schema={{
      rowKey: 'name', search: { placeholder: '搜索名称' },
      filters: [{ key: 'vendor', title: '厂商', multiple: true, options: [{ value: 'NVIDIA', label: '英伟达' }, { value: 'CPU', label: 'CPU' }] },
        { key: 'model', title: '型号', type: 'text' }],
      columns: [{ key: 'name', title: '名称' }, { key: 'vendor', title: '厂商', hideable: true }, { key: 'model', title: '型号', hideable: true }],
      columnVisibility: { label: '显示列', resetLabel: '恢复默认列' },
      labels: { clearFilters: '清除全部条件', clearFilter: (label) => `清除${label}`, clearSearch: '清除搜索' },
      empty: { title: '没有匹配的数据' },
    }} rows={rows} filters={filters} onFiltersChange={setFilters} searchValue={search} onSearchChange={setSearch}
      visibleColumnKeys={columns} onVisibleColumnsChange={setColumns} />;
  },
};
