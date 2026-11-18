import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { ResourceList, type ListSchema } from '../src/schema/ResourceList';
import { Badge } from '../src/primitives/Display';
import { ComponentDocs } from './_docs-layout';

/**
 * The general list.
 *
 * One story per capability rather than one per combination: a reader looking up
 * "how do I pin a column" should not have to read a story that also demonstrates
 * filters, selection and paging. The capabilities compose, and the last story shows
 * them together.
 */
const meta: Meta<typeof ResourceList> = {
  title: 'Schema/ResourceList',
  component: ResourceList,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="ResourceList"
          summary="资源列表：列定义、排序、筛选、列显隐、分页、行选择与批量操作。"
          description={
            <>
              列表是<strong>受控组件</strong>：排序、筛选、分页、列显隐与选中项都由宿主持有。
              资源列表几乎都按服务端分页，客户端排序会得到「第一页看着对、翻页就错」的顺序，
              所以组件只上报请求，不自己排。
              <br />
              排序由 <code>sortableKeys</code> + <code>sort</code> + <code>onSortChange</code> 驱动；
              筛选支持单选、多选、可搜索多选与关键词（<code>type: &apos;text&apos;</code>）；
              固定列用 <code>pin</code>，列口径说明用 <code>hint</code>。
              <br />
              <code>pin</code> 与 <code>hideable</code> 互斥：固定列是读者定位行的锚点，能隐藏就失去意义。
              同时写两者是编译错误，列选择器也不会列出固定列。
            </>
          }
        />
      ),
    },
  },
};
export default meta;

/* ---------------- Fixtures ---------------- */

type NodeRow = {
  name: string;
  ip: string;
  status: 'Ready' | 'Warning';
  role: 'master' | 'worker';
  vendor: 'nvidia' | 'cambricon' | 'CPU';
  model: string;
  gpu: number;
  gpuUsed: number;
  cpu: number;
  ntp: number;
};

const NODES: NodeRow[] = [
  { name: 'gpu01', ip: '172.16.1.11', status: 'Ready', role: 'master', vendor: 'CPU', model: '-', gpu: 0, gpuUsed: 0, cpu: 12, ntp: 0.4 },
  { name: 'gpu02', ip: '172.16.1.12', status: 'Ready', role: 'worker', vendor: 'nvidia', model: 'B200', gpu: 8, gpuUsed: 6, cpu: 74, ntp: -1.2 },
  { name: 'gpu03', ip: '172.16.1.13', status: 'Warning', role: 'worker', vendor: 'nvidia', model: 'B200', gpu: 8, gpuUsed: 7, cpu: 91, ntp: 138 },
  { name: 'mlu01', ip: '172.16.1.21', status: 'Ready', role: 'worker', vendor: 'cambricon', model: 'MLU370', gpu: 4, gpuUsed: 1, cpu: 33, ntp: 2.8 },
  { name: 'mlu02', ip: '172.16.1.22', status: 'Ready', role: 'worker', vendor: 'cambricon', model: 'MLU370', gpu: 4, gpuUsed: 4, cpu: 68, ntp: -0.3 },
  { name: 'cpu01', ip: '172.16.1.31', status: 'Ready', role: 'worker', vendor: 'CPU', model: '-', gpu: 0, gpuUsed: 0, cpu: 41, ntp: 1.1 },
];

const VENDOR_LABEL: Record<NodeRow['vendor'], string> = {
  nvidia: '英伟达',
  cambricon: '寒武纪',
  CPU: 'CPU',
};

const percent = (used: number, total: number) => (total > 0 ? `${Math.round((used / total) * 100)}%` : '-');

/** The columns the capability stories share, so each story only shows its own point. */
function nodeColumns(options: { hideable?: boolean } = {}): ListSchema<NodeRow>['columns'] {
  const hideable = options.hideable ? { hideable: true as const } : {};
  return [
    { key: 'name', title: '名称', width: 150, pin: 'start', render: (row) => (
      <span className="flex flex-col">
        <span className="font-medium text-ai-fg">{row.name}</span>
        <span className="text-[11px] text-ai-fg-muted">{row.ip}</span>
      </span>
    ) },
    { key: 'status', title: '状态', width: 96, ...hideable, render: (row) => (
      <Badge tone={row.status === 'Ready' ? 'success' : 'warning'}>{row.status}</Badge>
    ) },
    { key: 'role', title: '角色', width: 100, ...hideable, render: (row) => (row.role === 'master' ? '控制平面节点' : '工作节点') },
    { key: 'vendor', title: '算力卡类型', width: 120, ...hideable, render: (row) => VENDOR_LABEL[row.vendor] },
    { key: 'model', title: '型号', width: 110, ...hideable, render: (row) => row.model },
    { key: 'gpu', title: 'GPU 用量', width: 120, ...hideable,
      hint: '节点上所有加速卡的实时利用率之和；「已分配」是调度器口径，与实际用量不同。',
      render: (row) => percent(row.gpuUsed, row.gpu) },
    { key: 'cpu', title: 'CPU 使用率', width: 120, ...hideable, hint: '节点整体实时利用率。',
      render: (row) => `${row.cpu}%` },
    { key: 'ntp', title: '时间同步', width: 110, ...hideable,
      hint: '相对集群时钟源的偏移。超过 30 秒警告，超过 120 秒危险。',
      render: (row) => `${row.ntp > 0 ? '+' : ''}${row.ntp}s` },
  ];
}

/* ---------------- Capabilities ---------------- */

/**
 * Sorting.
 *
 * Clicking a header cycles asc → desc. Two states, not three: every consumer in the
 * console sorts server-side and always sends a key, so a "no sort" step would be a
 * control nothing honours.
 */
export const Sorting: StoryObj = {
  name: 'sorting',
  render: () => {
    const [sort, setSort] = React.useState<{ key: string; order: 'asc' | 'desc' }>({ key: 'name', order: 'asc' });
    const rows = React.useMemo(() => {
      const sorted = [...NODES].sort((left, right) => {
        const a = left[sort.key as keyof NodeRow];
        const b = right[sort.key as keyof NodeRow];
        return a < b ? -1 : a > b ? 1 : 0;
      });
      return sort.order === 'asc' ? sorted : sorted.reverse();
    }, [sort]);
    return (
      <ResourceList
        schema={{
          title: '节点',
          description: `点表头切换升序 / 降序。当前：${sort.key} ${sort.order}`,
          rowKey: 'name',
          columns: nodeColumns({ hideable: true }),
          sortableKeys: ['name', 'status', 'role', 'cpu'],
          sortAiPrefix: 'nodes',
          sort,
        }}
        rows={rows}
        onSortChange={(next) => next && setSort(next)}
      />
    );
  },
};

/**
 * Filters.
 *
 * Four shapes, because they answer different questions: a single select when one
 * value is the answer, a multi-select when several are, a searchable one when the
 * option list is longer than a screen, and a keyword field when the value is free
 * text.
 */
/**
 * Filters on the column headers.
 *
 * A field's own filter belongs at the field: clicking the header is how a reader
 * says "narrow this column", and the icon is tinted while the column is narrowed so
 * the state stays visible after the popover closes. The toolbar is left for controls
 * that are not a field — the row search here, a project scope or a time range on a
 * real page.
 *
 * `column` is what moves a filter from the toolbar to a header; omit it and the
 * filter stays in the toolbar, which is where a control that narrows several columns
 * at once belongs.
 */
export const ColumnFilters: StoryObj = {
  name: 'column filters',
  render: () => {
    const [filters, setFilters] = React.useState<Record<string, string>>({});
    const [search, setSearch] = React.useState('');
    const rows = NODES.filter((row) => {
      if (filters.role && row.role !== filters.role) return false;
      if (filters.vendor && !filters.vendor.split(',').includes(row.vendor)) return false;
      if (filters.model && !row.model.toLowerCase().includes(filters.model.toLowerCase())) return false;
      if (search && !row.name.includes(search)) return false;
      return true;
    });
    return (
      <ResourceList
        schema={{
          title: '节点',
          description: '状态、角色、算力卡类型、型号的筛选在各自的列头；搜索框留在工具栏。',
          rowKey: 'name',
          columns: nodeColumns(),
          search: { placeholder: '按名称搜索' },
          filters: [
            { key: 'status', column: 'status', title: '状态', allLabel: '全部状态', aiId: 'demo:filter:status',
              options: [{ value: 'Ready', label: 'Ready' }, { value: 'Warning', label: 'Warning' }] },
            { key: 'role', column: 'role', title: '角色', allLabel: '全部角色', aiId: 'demo:filter:role',
              options: [{ value: 'master', label: '控制平面节点' }, { value: 'worker', label: '工作节点' }] },
            { key: 'vendor', column: 'vendor', title: '算力卡类型', multiple: true, searchable: true, aiId: 'demo:filter:vendor',
              emptyText: '没有匹配的厂商',
              options: (['nvidia', 'cambricon', 'CPU'] as const).map((value) => ({ value, label: VENDOR_LABEL[value] })) },
            { key: 'model', column: 'model', title: '型号', type: 'text', aiId: 'demo:filter:model' },
          ],
          labels: {
            clearFilters: '清除全部条件',
            clearFilter: (title) => `清除${title}`,
            clearSearch: '清除搜索',
          },
        }}
        rows={rows}
        filters={filters}
        onFiltersChange={setFilters}
        searchValue={search}
        onSearchChange={setSearch}
      />
    );
  },
};

/**
 * Filters in the toolbar.
 *
 * The shape for a control that is not a field — a project scope, a time range, a
 * "needs attention" toggle that looks at several columns at once. `column` is
 * omitted, so these render beside the search box.
 */
export const Filters: StoryObj = {
  name: 'toolbar filters',
  render: () => {
    const [filters, setFilters] = React.useState<Record<string, string>>({});
    const [search, setSearch] = React.useState('');
    const rows = NODES.filter((row) => {
      if (filters.role && row.role !== filters.role) return false;
      if (filters.vendor && !filters.vendor.split(',').includes(row.vendor)) return false;
      if (filters.model && !row.model.toLowerCase().includes(filters.model.toLowerCase())) return false;
      if (search && !row.name.includes(search)) return false;
      return true;
    });
    return (
      <ResourceList
        schema={{
          title: '节点',
          description: '角色单选、算力卡类型多选且可搜索、型号关键词。',
          rowKey: 'name',
          columns: nodeColumns(),
          search: { placeholder: '按名称搜索' },
          filters: [
            { key: 'role', title: '角色', allLabel: '全部角色', aiId: 'demo:filter:role',
              options: [{ value: 'master', label: '控制平面节点' }, { value: 'worker', label: '工作节点' }] },
            // `searchable` matters once the option list is longer than a screen.
            { key: 'vendor', title: '算力卡类型', multiple: true, searchable: true, aiId: 'demo:filter:vendor',
              emptyText: '没有匹配的厂商',
              options: (['nvidia', 'cambricon', 'CPU'] as const).map((value) => ({ value, label: VENDOR_LABEL[value] })) },
            { key: 'model', title: '型号', type: 'text', aiId: 'demo:filter:model' },
          ],
          labels: {
            clearFilters: '清除全部条件',
            clearFilter: (title) => `清除${title}`,
            clearSearch: '清除搜索',
          },
        }}
        rows={rows}
        filters={filters}
        onFiltersChange={setFilters}
        searchValue={search}
        onSearchChange={setSearch}
      />
    );
  },
};

/**
 * Column visibility.
 *
 * Only columns declared `hideable` appear in the chooser. The pinned name column is
 * not offered — hiding it while the metrics scroll would leave nothing to orient
 * against.
 */
export const ColumnVisibility: StoryObj = {
  name: 'column visibility',
  render: () => {
    const [visible, setVisible] = React.useState(['name', 'status', 'vendor', 'gpu', 'cpu']);
    return (
      <ResourceList
        schema={{
          title: '节点',
          description: '「名称」固定在左侧，因此不出现在显示列里。',
          rowKey: 'name',
          columns: nodeColumns({ hideable: true }),
          columnVisibility: { label: '显示列', resetLabel: '恢复默认列', aiId: 'demo:columns' },
        }}
        rows={NODES}
        visibleColumnKeys={visible}
        onVisibleColumnsChange={setVisible}
      />
    );
  },
};

/**
 * Pinned columns.
 *
 * The name column stays at the left edge and the row actions at the right while the
 * middle scrolls. Give a pinned column a `width`: without one it changes width as
 * content changes, which makes the pin more distracting than useful.
 */
export const PinnedColumns: StoryObj = {
  name: 'pinned columns',
  render: () => (
    /*
     * The wrapper is narrower than the table on purpose: a pinned column only
     * demonstrates anything when there is something to scroll past, and the story
     * canvas is wide enough that the columns would otherwise fit.
     */
    <div className="max-w-xl">
      <ResourceList
        schema={{
          title: '节点',
          description: '把表格横向滚到底：名称停在左侧，行操作停在右侧。',
          rowKey: 'name',
          columns: nodeColumns({ hideable: true }),
          rowActions: [
            { key: 'terminal', label: '打开终端', aiId: 'demo:terminal' },
            { key: 'cordon', label: '禁止调度', aiId: 'demo:cordon' },
          ],
          labels: { moreActions: '更多操作' },
        }}
        rows={NODES}
        onAction={() => undefined}
      />
    </div>
  ),
};

/**
 * Column hints.
 *
 * An info control beside the header, not a `title` attribute: a tooltip that only
 * appears on hover is unreachable by keyboard and by touch, and the hint is the only
 * place a column's unit is written down. Pressing it does not sort.
 */
export const ColumnHints: StoryObj = {
  name: 'column hints',
  render: () => (
    <ResourceList
      schema={{
        title: '节点',
        description: '「GPU 用量」「CPU 使用率」「时间同步」表头右侧有信息按钮。',
        rowKey: 'name',
        columns: nodeColumns(),
        sortableKeys: ['name', 'cpu'],
        sort: { key: 'name', order: 'asc' },
      }}
      rows={NODES}
      onSortChange={() => undefined}
    />
  ),
};

/**
 * Selection and bulk actions.
 *
 * `isRowSelectable` keeps a row out of select-all when acting on it would fail — a
 * control that cannot succeed is a trap. `confirm` puts a real dialog in front of a
 * destructive action instead of a native `window.confirm`.
 */
export const SelectionAndBulkActions: StoryObj = {
  name: 'selection and bulk actions',
  render: () => {
    const [selected, setSelected] = React.useState<string[]>([]);
    const [deleted, setDeleted] = React.useState<string[]>([]);
    const rows = NODES.filter((row) => !deleted.includes(row.name));
    return (
      <ResourceList
        schema={{
          title: '节点',
          description: selected.length ? `已选 ${selected.length} 个` : '勾选任意行查看批量操作。控制平面节点不可选。',
          rowKey: 'name',
          columns: nodeColumns(),
          selection: 'multiple',
          // Acting on the control plane is not what this demo is about; excluding it
          // also shows the "not every row is selectable" case.
          isRowSelectable: (row) => row.role !== 'master',
          actions: [
            { key: 'drain', label: '驱逐', aiId: 'demo:drain', aiNeeds: ['selection'],
              confirm: `驱逐选中的 ${selected.length} 个节点上的工作负载？` },
            { key: 'delete', label: '删除', tone: 'danger', aiId: 'demo:delete', aiNeeds: ['selection'],
              confirm: `删除选中的 ${selected.length} 个节点？` },
          ],
          selectAiId: 'demo:select',
          labels: { selectAll: '全选', selectRow: (index) => `选择第 ${index} 行` },
        }}
        rows={rows}
        selectedKeys={selected}
        onSelectionChange={setSelected}
        onBulkAction={(action, keys) => { if (action === 'delete') setDeleted((current) => [...current, ...keys]); }}
      />
    );
  },
};

/**
 * Toolbar.
 *
 * The primary action, the search box, the refresh control and the bulk actions all
 * live on one row. `primaryAction.disabled` keeps the button mounted with an
 * explanation — an absent control reads as a missing feature.
 */
export const Toolbar: StoryObj = {
  name: 'toolbar',
  render: () => {
    const [selected, setSelected] = React.useState<string[]>([]);
    const [busy, setBusy] = React.useState(false);
    const [revision, setRevision] = React.useState(0);
    React.useEffect(() => {
      if (!busy) return undefined;
      const timer = window.setTimeout(() => { setRevision((value) => value + 1); setBusy(false); }, 700);
      return () => window.clearTimeout(timer);
    }, [busy]);
    return (
      <ResourceList
        schema={{
          title: '节点',
          description: `刷新次数 ${revision}。刷新按钮保留当前条件。`,
          rowKey: 'name',
          columns: nodeColumns(),
          search: { placeholder: '按名称搜索', aiId: 'demo:search' },
          refresh: { label: '刷新', aiId: 'demo:refresh', busy },
          primaryAction: { key: 'add', label: '添加节点', aiId: 'demo:add', disabled: true,
            disabledHint: '当前账号没有添加节点的权限。' },
          selection: 'multiple',
          actions: [{ key: 'delete', label: '删除', tone: 'danger', aiId: 'demo:delete', aiNeeds: ['selection'],
            confirm: '删除选中的节点？' }],
          labels: { selectAll: '全选', selectRow: (index) => `选择第 ${index} 行`, clearSearch: '清除搜索' },
        }}
        rows={NODES}
        selectedKeys={selected}
        onSelectionChange={setSelected}
        onRefresh={() => setBusy(true)}
        onBulkAction={() => undefined}
        onAction={() => undefined}
      />
    );
  },
};

/**
 * Empty states.
 *
 * "Nothing here yet" and "nothing matches what you typed" are different answers, and
 * a reader who typed a query needs the second one. The component picks the right one
 * from the search box; a page that narrows by a real filter passes `narrowed`.
 */
export const EmptyStates: StoryObj = {
  name: 'empty states',
  render: () => (
    <div className="flex flex-col gap-6">
      <ResourceList
        schema={{
          title: '还没有节点',
          description: '列表本身是空的。',
          rowKey: 'name',
          columns: nodeColumns(),
          empty: { title: '还没有节点', description: '添加节点后会出现在这里。' },
          primaryAction: { key: 'add', label: '添加节点', aiId: 'demo:empty-add' },
        }}
        rows={[]}
      />
      <ResourceList
        schema={{
          title: '搜索没有结果',
          description: '搜索词排除了全部行。',
          rowKey: 'name',
          columns: nodeColumns(),
          search: { placeholder: '按名称搜索' },
          empty: { title: '还没有节点' },
        }}
        rows={[]}
        searchValue="no-such-node"
        onSearchChange={() => undefined}
      />
      {/*
        * Narrowed by a filter rather than by the search box.
        *
        * The component infers "narrowed" from the search box alone, because many
        * pages put their *scope* in `filters` (the project a route points at) and
        * treating that as narrowing made every empty project list claim "nothing
        * matches" when the truth was "nothing here yet". A page that narrows by a
        * real filter says so explicitly.
        */}
      <ResourceList
        schema={{
          title: '筛选没有结果',
          description: '被「算力卡类型」收窄，因此空态说的是「没有匹配」。',
          rowKey: 'name',
          columns: nodeColumns(),
          filters: [{ key: 'vendor', title: '算力卡类型', multiple: true,
            options: (['nvidia', 'cambricon', 'CPU'] as const).map((value) => ({ value, label: VENDOR_LABEL[value] })) }],
          narrowed: true,
          empty: { title: '还没有节点', noMatchTitle: '没有匹配的节点', noMatchDescription: '换个算力卡类型再试。' },
        }}
        rows={[]}
        filters={{ vendor: 'nvidia' }}
        onFiltersChange={() => undefined}
      />
    </div>
  ),
};

/**
 * Sequential paging.
 *
 * A cursor-paged collection can only walk forward, so page numbers would be dead
 * controls. `mode: 'sequential'` renders previous / next only.
 */
export const SequentialPaging: StoryObj = {
  name: 'sequential paging',
  render: () => {
    const [page, setPage] = React.useState(1);
    const pageSize = 2;
    return (
      <ResourceList
        schema={{
          title: '审计日志',
          description: '游标分页：只能前进或后退，不能跳到第 N 页。',
          rowKey: 'name',
          columns: nodeColumns(),
          pagination: { page, pageSize, total: NODES.length, mode: 'sequential' },
          labels: { previous: '上一页', next: '下一页', range: (from, to, total) => `${from}-${to} / ${total}` },
        }}
        rows={NODES.slice((page - 1) * pageSize, page * pageSize)}
        onPageChange={setPage}
      />
    );
  },
};

/**
 * A failed request that keeps the controls usable.
 *
 * `errorContent` replaces the rows and the pager, but not the search box or the
 * filters — a reader whose query caused the failure has to be able to correct it.
 * Swapping the whole toolbar for an error panel is how a list becomes a dead end.
 */
export const RecoverableError: StoryObj = {
  name: 'recoverable error',
  render: () => {
    const [search, setSearch] = React.useState('bad selector');
    const [failing, setFailing] = React.useState(true);
    return (
      <ResourceList
        schema={{
          title: '节点',
          description: failing ? '请求失败；搜索框仍然可编辑，改掉条件再试。' : '请求已恢复。',
          rowKey: 'name',
          columns: nodeColumns(),
          search: { placeholder: '按名称搜索', aiId: 'demo:error-search' },
          labels: { clearSearch: '清除搜索' },
        }}
        rows={failing ? [] : NODES}
        searchValue={search}
        onSearchChange={setSearch}
        {...(failing ? {
          errorContent: (
            <div className="flex flex-col gap-2 rounded-ai-md border border-ai-danger/40 bg-ai-danger/5 p-4" role="alert">
              <p className="text-sm font-medium text-ai-danger">查询被拒绝：选择器无法解析。</p>
              <p className="text-xs text-ai-fg-muted">把搜索词换成节点名再试；条件不会因为失败而丢失。</p>
              <button
                type="button"
                className="w-fit rounded-ai-sm border border-ai-line px-2 py-1 text-xs text-ai-fg hover:bg-ai-surface-2"
                onClick={() => { setFailing(false); setSearch(''); }}
              >
                清除条件并重试
              </button>
            </div>
          ),
        } : {})}
      />
    );
  },
};

/**
 * Everything at once.
 *
 * The shape a real resource list takes: pinned name, sortable headers, three filter
 * shapes, a column chooser, refresh, a primary action, row selection with a
 * confirmed bulk delete, and numbered paging.
 */
export const FullList: StoryObj = {
  name: 'full list',
  render: () => {
    const [filters, setFilters] = React.useState<Record<string, string>>({});
    const [search, setSearch] = React.useState('');
    const [sort, setSort] = React.useState<{ key: string; order: 'asc' | 'desc' }>({ key: 'name', order: 'asc' });
    const [visible, setVisible] = React.useState(nodeColumns({ hideable: true }).map((column) => column.key));
    const [selected, setSelected] = React.useState<string[]>([]);
    const [page, setPage] = React.useState(1);
    const [pageSize, setPageSize] = React.useState(10);
    const [busy, setBusy] = React.useState(false);
    const [deleted, setDeleted] = React.useState<string[]>([]);

    const rows = React.useMemo(() => {
      const filtered = NODES.filter((row) => {
        if (deleted.includes(row.name)) return false;
        if (filters.role && row.role !== filters.role) return false;
        if (filters.vendor && !filters.vendor.split(',').includes(row.vendor)) return false;
        if (filters.model && !row.model.toLowerCase().includes(filters.model.toLowerCase())) return false;
        if (search && !row.name.includes(search)) return false;
        return true;
      });
      const sorted = [...filtered].sort((left, right) => {
        const a = left[sort.key as keyof NodeRow];
        const b = right[sort.key as keyof NodeRow];
        return a < b ? -1 : a > b ? 1 : 0;
      });
      return sort.order === 'asc' ? sorted : sorted.reverse();
    }, [filters, search, sort, deleted]);

    React.useEffect(() => { setPage(1); }, [filters, search, sort]);

    return (
      <ResourceList
        schema={{
          title: '节点',
          description: '所有能力合在一起的样子。',
          rowKey: 'name',
          rowAttributes: (row) => ({ 'data-ai-row': row.name }),
          columns: nodeColumns({ hideable: true }),
          search: { placeholder: '按名称或 IP 搜索', aiId: 'nodes:search' },
          filters: [
            { key: 'role', title: '角色', allLabel: '全部角色', aiId: 'nodes:filter:role',
              options: [{ value: 'master', label: '控制平面节点' }, { value: 'worker', label: '工作节点' }] },
            { key: 'vendor', title: '算力卡类型', multiple: true, searchable: true, aiId: 'nodes:filter:vendor',
              emptyText: '没有匹配的厂商',
              options: (['nvidia', 'cambricon', 'CPU'] as const).map((value) => ({ value, label: VENDOR_LABEL[value] })) },
            { key: 'model', title: '型号', type: 'text', aiId: 'nodes:filter:model' },
          ],
          columnVisibility: { label: '显示列', resetLabel: '恢复默认列', aiId: 'nodes:columns' },
          refresh: { label: '刷新', aiId: 'nodes:refresh', busy },
          primaryAction: { key: 'add', label: '添加节点', aiId: 'nodes:add' },
          sortableKeys: ['name', 'status', 'role', 'cpu'],
          sortAiPrefix: 'nodes',
          sort,
          selection: 'multiple',
          isRowSelectable: (row) => row.role !== 'master',
          actions: [{ key: 'delete', label: '删除', tone: 'danger', aiId: 'nodes:delete', aiNeeds: ['selection'],
            confirm: `删除选中的 ${selected.length} 个节点？` }],
          rowActions: [
            { key: 'terminal', label: '打开终端', aiId: 'nodes:terminal-open' },
            { key: 'cordon', label: '禁止调度', aiId: 'nodes:cordon', visible: (row) => row.status === 'Ready' },
          ],
          selectAiId: 'nodes:select',
          pagination: { page, pageSize, total: rows.length, pageSizeOptions: [10, 20, 50] },
          empty: { title: '还没有节点', noMatchTitle: '没有匹配的节点' },
          labels: {
            selectAll: '全选', selectRow: (index) => `选择第 ${index} 行`, moreActions: '更多操作',
            previous: '上一页', next: '下一页', goToPage: '跳转页码', jumpTo: '跳至',
            pageSize: '每页条数', pageSizeSuffix: '条/页',
            range: (from, to, total) => `第 ${from}-${to} 条，共 ${total} 条`,
            clearSearch: '清除搜索', clearFilters: '清除全部条件', clearFilter: (title) => `清除${title}`,
            confirmCancel: '取消', confirmOk: '确认',
          },
        }}
        rows={rows.slice((page - 1) * pageSize, page * pageSize)}
        filters={filters}
        onFiltersChange={setFilters}
        searchValue={search}
        onSearchChange={setSearch}
        onSortChange={(next) => next && setSort(next)}
        visibleColumnKeys={visible}
        onVisibleColumnsChange={setVisible}
        selectedKeys={selected}
        onSelectionChange={setSelected}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        onRefresh={() => setBusy(true)}
        onBulkAction={(action, keys) => { if (action === 'delete') setDeleted((current) => [...current, ...keys]); }}
        onAction={() => undefined}
      />
    );
  },
};
