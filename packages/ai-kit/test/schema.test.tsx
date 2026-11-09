import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResourceList, type ListSchema } from '../src/schema/ResourceList';
import { ResourceForm, validateForm, type FormSchema } from '../src/schema/ResourceForm';
import { ResourceDetail, type DetailSchema } from '../src/schema/ResourceDetail';
import { clearRendererRegistry, registerColumnType, registerFieldType } from '../src/schema/registry';

interface Row {
  name: string;
  status: string;
  restarts: number;
}

const rows: Row[] = [
  { name: 'pod-a', status: 'running', restarts: 0 },
  { name: 'pod-b', status: 'failed', restarts: 3 },
];

const listSchema: ListSchema<Row> = {
  rowKey: 'name',
  columns: [
    { key: 'name', title: '名称', type: 'link' },
    { key: 'status', title: '状态', type: 'status' },
    { key: 'restarts', title: '重启', type: 'number', align: 'right' },
  ],
  search: { placeholder: '搜索名称' },
  empty: { title: '暂无容器组' },
};

beforeEach(() => {
  clearRendererRegistry();
});

describe('ResourceList', () => {
  it('renders one row per record with its values', () => {
    render(<ResourceList schema={listSchema} rows={rows} />);
    expect(screen.getByText('pod-a')).toBeInTheDocument();
    expect(screen.getByText('pod-b')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows the empty state instead of an empty table body', () => {
    render(<ResourceList schema={listSchema} rows={[]} />);
    expect(screen.getByText('暂无容器组')).toBeInTheDocument();
  });

  it('reports search input changes so the host can filter', async () => {
    const onSearchChange = vi.fn();
    render(<ResourceList schema={listSchema} rows={rows} onSearchChange={onSearchChange} />);
    await userEvent.type(screen.getByLabelText('搜索名称'), 'pod');
    expect(onSearchChange).toHaveBeenCalled();
  });

  it('uses a registered column type instead of the built-in renderer', () => {
    registerColumnType<Row>('custom', ({ value }) => <em data-testid="custom">{String(value)}</em>);
    render(
      <ResourceList
        schema={{ ...listSchema, columns: [{ key: 'name', title: '名称', type: 'custom' }] }}
        rows={rows}
      />,
    );
    expect(screen.getAllByTestId('custom')).toHaveLength(2);
  });

  it('selects and reports rows through the selection column', async () => {
    const onSelectionChange = vi.fn();
    render(
      <ResourceList
        schema={{ ...listSchema, selection: 'multiple' }}
        rows={rows}
        selectedKeys={[]}
        onSelectionChange={onSelectionChange}
      />,
    );
    await userEvent.click(screen.getByLabelText('选择第 1 行'));
    expect(onSelectionChange).toHaveBeenCalledWith(['pod-a']);
  });
});

describe('ResourceForm', () => {
  interface Values extends Record<string, unknown> {
    name: string;
    replicas: number;
  }

  const formSchema: FormSchema<Values> = {
    fields: [
      { key: 'name', label: '名称', type: 'text', required: true },
      { key: 'replicas', label: '副本数', type: 'number', min: 1 },
    ],
    submit: { label: '创建' },
  };

  it('blocks submit and surfaces the error when a required field is empty', async () => {
    const onSubmit = vi.fn();
    render(<ResourceForm schema={formSchema} defaultValues={{ name: '', replicas: 1 }} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: '创建' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('名称 不能为空');
  });

  it('submits when the values satisfy the schema', async () => {
    const onSubmit = vi.fn();
    render(<ResourceForm schema={formSchema} defaultValues={{ name: 'ok', replicas: 2 }} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: '创建' }));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'ok', replicas: 2 });
  });

  it('skips validation for fields hidden by visible()', () => {
    const schema: FormSchema<Record<string, unknown>> = {
      fields: [
        { key: 'autoscale', label: '自动伸缩', type: 'switch' },
        { key: 'cpu', label: 'CPU', type: 'number', required: true, visible: (values) => Boolean(values.autoscale) },
      ],
    };
    expect(validateForm(schema, { autoscale: false })).toEqual({});
    expect(validateForm(schema, { autoscale: true })).toHaveProperty('cpu');
  });

  it('uses a registered field type', () => {
    registerFieldType('custom-field', () => <input aria-label="自定义字段" />);
    render(
      <ResourceForm
        schema={{ fields: [{ key: 'custom', label: '自定义', type: 'custom-field' }] }}
        defaultValues={{}}
        onSubmit={() => undefined}
      />,
    );
    expect(screen.getByLabelText('自定义字段')).toBeInTheDocument();
  });
});

describe('ResourceDetail', () => {
  const detailSchema: DetailSchema<Row> = {
    header: {
      title: (row) => row.name,
      status: (row) => ({ label: row.status, tone: row.status === 'running' ? 'success' : 'danger' }),
    },
    sections: [
      {
        id: 'basic',
        title: '基本信息',
        fields: [{ key: 'restarts', label: '重启次数' }],
      },
      {
        id: 'custom',
        title: '自定义',
        render: (row) => <span data-testid="custom-section">{row.name}</span>,
      },
    ],
  };

  it('renders the header, fields and custom sections', () => {
    render(<ResourceDetail schema={detailSchema} data={rows[0] as Row} />);
    expect(screen.getByRole('heading', { name: 'pod-a' })).toBeInTheDocument();
    expect(screen.getByText('重启次数')).toBeInTheDocument();
    expect(screen.getByTestId('custom-section')).toHaveTextContent('pod-a');
  });

  it('omits fields marked hideEmpty when the value is missing', () => {
    const schema: DetailSchema<Row> = {
      ...detailSchema,
      sections: [{ id: 's', title: 'S', fields: [{ key: 'missing', label: '缺失字段', hideEmpty: true }] }],
    };
    render(<ResourceDetail schema={schema} data={rows[0] as Row} />);
    expect(screen.queryByText('缺失字段')).not.toBeInTheDocument();
  });
});
