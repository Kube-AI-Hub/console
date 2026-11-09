import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { ResourceList, type ListSchema } from '../src/schema/ResourceList';
import { Button } from '../src/primitives/Button';

/**
 * Port of `console/src/pages/projects/containers/ConfigMaps/index.jsx`.
 *
 * The original is 147 lines: a mobx store, a decorator that injects list state,
 * a class component with getters for columns and actions, and a `ListPage` +
 * `Table` pair. What is actually ConfigMap-specific is the schema below — the
 * rest is framework plumbing the new library absorbs.
 *
 * This story exists to measure that difference. It does not import anything
 * from the console app.
 */

interface ConfigMapRow {
  name: string;
  description?: string;
  data: Record<string, string>;
  createTime: string;
  isFedManaged?: boolean;
}

const ROWS: ConfigMapRow[] = [
  { name: 'app-config', description: '应用主配置', data: { 'app.yaml': '', 'log.yaml': '' }, createTime: '2026-11-01T08:12:00Z' },
  { name: 'nginx-conf', description: '反向代理配置', data: { 'nginx.conf': '' }, createTime: '2026-11-02T11:40:00Z' },
  { name: 'db-secret-template', data: { 'db.env': '', 'pool.env': '', 'tls.env': '' }, createTime: '2026-11-03T09:05:00Z' },
  { name: 'feature-flags', description: '灰度开关', data: { 'flags.json': '' }, createTime: '2026-11-05T16:22:00Z', isFedManaged: true },
];

/** Everything ConfigMap-specific lives here. */
const schema: ListSchema<ConfigMapRow> = {
  title: '配置字典',
  description: '管理项目内的 ConfigMap 资源。',
  rowKey: 'name',
  search: { placeholder: '按名称搜索', keys: ['name'] },
  columns: [
    {
      key: 'name',
      title: '名称',
      type: 'link',
      width: 240,
      render: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-medium text-ai-fg">{row.name}</span>
            {row.isFedManaged ? (
              <span className="rounded-ai-pill bg-ai-info/15 px-1.5 text-[10px] text-ai-info">联邦</span>
            ) : null}
          </span>
          <span className="truncate text-[11px] text-ai-fg-muted">{row.description || '-'}</span>
        </span>
      ),
    },
    {
      key: 'data',
      title: '键',
      width: '33%',
      render: (row) => <span className="truncate text-ai-fg-secondary">{Object.keys(row.data).join(', ') || '-'}</span>,
    },
    {
      key: 'createTime',
      title: '创建时间',
      width: 170,
      hideBelow: 'md',
      render: (row) => (
        <span className="tabular-nums text-ai-fg-muted">
          {new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(row.createTime))}
        </span>
      ),
    },
  ],
  rowActions: [
    { key: 'edit', label: '编辑' },
    { key: 'editYaml', label: '编辑 YAML' },
    { key: 'delete', label: '删除', tone: 'danger', confirm: '确认删除该配置字典？' },
  ],
  selection: 'multiple',
  actions: [{ key: 'bulk-delete', label: '批量删除', tone: 'danger', confirm: '确认删除所选配置字典？' }],
  empty: { title: '暂无配置字典', description: '创建第一个配置字典以挂载到工作负载。' },
  pagination: { page: 1, pageSize: 20, total: ROWS.length },
};

const meta: Meta = {
  title: 'Schema/Port: ConfigMaps',
  parameters: { layout: 'fullscreen' },
};
export default meta;

export const PortedFromConsole: StoryObj = {
  render: () => {
    const [search, setSearch] = React.useState('');
    const [selected, setSelected] = React.useState<string[]>([]);
    const rows = search ? ROWS.filter((row) => row.name.includes(search)) : ROWS;
    return (
      <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-center justify-between">
            <p className="text-xs text-ai-fg-muted">
              原页面 147 行（含 mobx 装饰器样板）；此处的资源特定部分即下面的 schema。
            </p>
            <Button variant="primary" size="sm">创建</Button>
          </div>
          <ResourceList
            schema={{ ...schema, pagination: { ...schema.pagination!, total: rows.length } }}
            rows={rows}
            searchValue={search}
            onSearchChange={setSearch}
            selectedKeys={selected}
            onSelectionChange={setSelected}
            onPageChange={() => undefined}
            onAction={(action, row) => console.log(action, row.name)}
            onBulkAction={(action, keys) => console.log(action, keys)}
          />
      </div>
    );
  },
};
