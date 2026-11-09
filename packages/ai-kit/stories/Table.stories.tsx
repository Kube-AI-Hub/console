import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { Table, type TableColumn, type TableSortState } from '../src/primitives/Table';
import { Badge } from '../src/primitives/Display';
import { ComponentDocs } from './_docs-layout';

const meta: Meta<typeof Table> = {
  title: 'Components/Table',
  component: Table,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="Table"
          summary="展示结构化数据。表格本身不排序、不筛选，只把请求交给调用方。"
          description={
            <>
              Table 是<strong>受控的呈现层</strong>：排序通过 <code>sorter</code> + <code>onSortChange</code> 上报，
              数据由调用方（或 schema 层）处理。这样同一套组件既能用于前端排序的小表，
              也能用于服务端分页排序的大表。需要开箱即用的筛选与分页时，用 <code>ResourceList</code>。
            </>
          }
        />
      ),
    },
  },
};

export default meta;
type Story = StoryObj<typeof Table<Pod>>;

interface Pod {
  name: string;
  namespace: string;
  status: string;
  restarts: number;
}

const ROWS: Pod[] = [
  { name: 'api-server-7d8f9', namespace: 'kube-system', status: 'Running', restarts: 0 },
  { name: 'worker-5c6b8', namespace: 'default', status: 'Pending', restarts: 0 },
  { name: 'scheduler-9a4e1', namespace: 'kube-system', status: 'CrashLoopBackOff', restarts: 12 },
];

const COLUMNS: Array<TableColumn<Pod>> = [
  { key: 'name', title: '名称', render: (row) => <span className="font-medium text-ai-fg">{row.name}</span> },
  { key: 'namespace', title: '命名空间' },
  {
    key: 'status',
    title: '状态',
    render: (row) => (
      <Badge
        dot
        tone={row.status === 'Running' ? 'success' : row.status === 'Pending' ? 'warning' : 'danger'}
      >
        {row.status}
      </Badge>
    ),
  },
  { key: 'restarts', title: '重启次数', align: 'right' },
];

export const BasicTable: Story = {
  name: 'basic table',
  render: () => <Table columns={COLUMNS} rows={ROWS} rowKey={(row) => row.name} />,
};

/** 表头点击在升序 / 降序 / 无序之间循环，`aria-sort` 同步给读屏。 */
export const SortableTable: Story = {
  name: 'sortable table',
  render: () => {
    const [sorter, setSorter] = React.useState<TableSortState | undefined>(undefined);
    const columns = COLUMNS.map((column) => ({ ...column, sortable: true }));
    const ordered = React.useMemo(() => {
      if (!sorter) return ROWS;
      const direction = sorter.order === 'asc' ? 1 : -1;
      return [...ROWS].sort((a, b) => (a[sorter.key as keyof Pod] > b[sorter.key as keyof Pod] ? direction : -direction));
    }, [sorter]);
    return (
      <Table
        columns={columns}
        rows={ordered}
        rowKey={(row) => row.name}
        sorter={sorter}
        onSortChange={setSorter}
      />
    );
  },
};

/** 行展开把次要信息收起来，避免表格横向变宽。 */
export const ExpandableRows: Story = {
  name: 'expandable rows',
  render: () => (
    <Table
      columns={COLUMNS}
      rows={ROWS}
      rowKey={(row) => row.name}
      expandedRow={(row) => (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[11px]">
          <dt className="text-ai-fg-muted">命名空间</dt>
          <dd className="m-0 text-ai-fg-secondary">{row.namespace}</dd>
          <dt className="text-ai-fg-muted">重启次数</dt>
          <dd className="m-0 text-ai-fg-secondary">{row.restarts}</dd>
        </dl>
      )}
    />
  ),
};

/** 选择列配合批量操作使用，禁用行的复选框不可点。 */
export const WithSelection: Story = {
  name: 'with selection',
  render: () => {
    const [keys, setKeys] = React.useState<string[]>([]);
    return (
      <div className="flex flex-col gap-2">
        <Table
          columns={COLUMNS}
          rows={ROWS}
          rowKey={(row) => row.name}
          selection={{
            selectedKeys: keys,
            onChange: setKeys,
            // A pod that is already broken should not be selectable for restart.
            isRowSelectable: (row) => row.status !== 'CrashLoopBackOff',
          }}
        />
        <p className="text-xs text-ai-fg-muted">已选 {keys.length} 项</p>
      </div>
    );
  },
};

/** 加载中用骨架行占位，保持表格结构与列宽不变。 */
export const LoadingAndEmpty: Story = {
  name: 'loading and empty',
  render: () => (
    <div className="flex flex-col gap-4">
      <Table columns={COLUMNS} rows={[]} rowKey={(row) => row.name} loading />
      <Table
        columns={COLUMNS}
        rows={[]}
        rowKey={(row) => row.name}
        empty="当前筛选条件下没有 Pod"
      />
    </div>
  ),
};
