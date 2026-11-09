import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { Badge, Tag, Avatar, Card, CardContent, CardTitle, CardDescription, Divider, Progress, Skeleton, Empty, Text } from '../src/primitives/Display';
import { Alert, Loading, Modal, Drawer, Tooltip, Popover } from '../src/primitives/Feedback';
import { Table, type TableColumn } from '../src/primitives/Table';
import { Pagination, Tabs, Breadcrumb, Dropdown } from '../src/primitives/Navigation';
import { Button } from '../src/primitives/Button';
import { Icon } from '../src/primitives/Icon';

const meta: Meta = { title: 'Components/Display', parameters: { layout: 'padded' } };
export default meta;

export const BadgesAndTags: StoryObj = {
  render: () => (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {(['neutral', 'accent', 'info', 'success', 'warning', 'danger'] as const).map((tone) => (
          <Badge key={tone} tone={tone} dot>{tone}</Badge>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Tag>普通标签</Tag>
        <Tag onRemove={() => undefined}>可移除</Tag>
        <Tag onRemove={() => undefined}>app=nginx</Tag>
      </div>
      <div className="flex items-center gap-3">
        <Avatar fallback="AK" size="sm" />
        <Avatar fallback="KS" />
        <Avatar fallback="AD" size="lg" />
      </div>
    </div>
  ),
};

export const CardsAndPanels: StoryObj = {
  render: () => (
    <div className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-3">
      {[
        { title: '节点概览', desc: '12 个节点，全部就绪', icon: 'kubernetes' as const },
        { title: 'GPU 使用率', desc: '平均 62%，峰值 94%', icon: 'gpu' as const },
        { title: '存储水位', desc: 'JuiceFS 已用 3.2 TiB', icon: 'storage' as const },
      ].map((item) => (
        <Card key={item.title} interactive>
          <CardContent className="pt-4">
            <Icon name={item.icon} size={18} className="mb-2 text-ai-accent" />
            <CardTitle>{item.title}</CardTitle>
            <CardDescription>{item.desc}</CardDescription>
          </CardContent>
        </Card>
      ))}
    </div>
  ),
};

export const FeedbackStates: StoryObj = {
  render: () => (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      <Alert tone="info" title="提示">这是一条信息提示。</Alert>
      <Alert tone="success" title="成功">配置已保存。</Alert>
      <Alert tone="warning" title="注意">节点磁盘使用率超过 80%。</Alert>
      <Alert tone="danger" title="错误">无法连接到集群 API。</Alert>
      <Divider />
      <div className="grid gap-3 sm:grid-cols-2">
        <Loading />
        <Empty title="暂无告警" description="当前筛选条件下没有匹配的告警。" />
      </div>
      <div className="flex flex-col gap-2">
        <Text size="xs" tone="muted">进度 62%</Text>
        <Progress value={62} label="部署进度" />
        <div className="flex gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  ),
};

export const Overlays: StoryObj = {
  render: () => {
    const [modal, setModal] = React.useState(false);
    const [drawer, setDrawer] = React.useState(false);
    return (
      <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-3">
        <DialogTriggerButton label="打开弹窗" onClick={() => setModal(true)} />
        <Button variant="secondary" onClick={() => setDrawer(true)}>打开抽屉</Button>
        <Tooltip content="两秒后出现"><Button variant="ghost">悬停提示</Button></Tooltip>
        <Popover trigger={<Button variant="secondary">弹出面板</Button>}>
          <Text size="sm">弹出层内容，可放任意组件。</Text>
        </Popover>
        <Modal
          open={modal}
          onOpenChange={setModal}
          title="确认重启"
          description="重启会中断正在运行的实例。"
          footer={
            <>
              <Button variant="ghost" onClick={() => setModal(false)}>取消</Button>
              <Button variant="primary" onClick={() => setModal(false)}>确认重启</Button>
            </>
          }
        >
          <Text size="sm" tone="muted">受影响的实例：3 个</Text>
        </Modal>
        <Drawer open={drawer} onOpenChange={setDrawer} title="详情" description="从右侧滑出">
          <Text size="sm" tone="muted">抽屉内容。</Text>
        </Drawer>
      </div>
    );
  },
};

function DialogTriggerButton({ label, onClick }: { label: string; onClick: () => void }): React.ReactElement {
  return <Button variant="primary" onClick={onClick}>{label}</Button>;
}

interface Row {
  name: string;
  status: string;
  age: string;
}

const ROWS: Row[] = [
  { name: 'nginx-7d8f9', status: 'Running', age: '3d' },
  { name: 'api-5c6b8', status: 'Pending', age: '12m' },
  { name: 'worker-9a4e1', status: 'Failed', age: '1h' },
];

const COLUMNS: Array<TableColumn<Row>> = [
  { key: 'name', title: '名称', render: (row) => <span className="font-medium text-ai-fg">{row.name}</span> },
  { key: 'status', title: '状态', render: (row) => <Badge tone={row.status === 'Running' ? 'success' : row.status === 'Pending' ? 'warning' : 'danger'} dot>{row.status}</Badge> },
  { key: 'age', title: '运行时长', align: 'right' },
];

export const DataTable: StoryObj = {
  render: () => {
    const [selected, setSelected] = React.useState<string[]>([]);
    return (
      <div className="mx-auto max-w-3xl">
        <Table
          columns={COLUMNS}
          rows={ROWS}
          rowKey={(row) => row.name}
          selection={{ selectedKeys: selected, onChange: setSelected }}
        />
        <div className="mt-3">
          <Pagination page={1} pageSize={20} total={95} onChange={() => undefined} />
        </div>
      </div>
    );
  },
};

export const NavigationBits: StoryObj = {
  render: () => (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Tabs
        items={[
          { value: 'overview', label: '概览' },
          { value: 'monitor', label: '监控', count: 3 },
          { value: 'events', label: '事件' },
        ]}
        defaultValue="overview"
      />
      <Breadcrumb items={[{ label: '集群' }, { label: 'default' }, { label: '节点' }]} />
      <Dropdown
        trigger={<Button variant="secondary">更多操作</Button>}
        items={[
          { key: 'edit', label: '编辑' },
          { key: 'yaml', label: '查看 YAML' },
          { key: 'delete', label: '删除', danger: true, dividerBefore: true },
        ]}
      />
    </div>
  ),
};
