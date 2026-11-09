import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { Button } from '../src/primitives/Button';
import { Input, Textarea } from '../src/primitives/Input';
import { Select } from '../src/primitives/Select';
import { Checkbox, RadioGroup, Slider, Switch } from '../src/primitives/Toggles';
import { InputNumber } from '../src/primitives/InputNumber';
import { DatePicker } from '../src/primitives/DatePicker';
import { FormField } from '../src/primitives/FormField';
import {
  Alert,
  Drawer,
  Loading,
  Modal,
  Popover,
  Tooltip,
} from '../src/primitives/Feedback';
import {
  Avatar,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  Divider,
  Empty,
  Panel,
  Progress,
  Skeleton,
  Tag,
  Text,
} from '../src/primitives/Display';
import {
  Accordion,
  Breadcrumb,
  Dropdown,
  Pagination,
  Tabs,
} from '../src/primitives/Navigation';
import { Reveal } from '../src/motion/Reveal';
import { ToastProvider, useToast } from '../src/primitives/Toast';
import { Menu, Collapse, type MenuNode } from '../src/primitives/Menu';

const meta: Meta = {
  title: 'Primitives/Overview',
  parameters: { layout: 'padded' },
};
export default meta;

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ai-fg-muted">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

function CardSection({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ai-fg-muted">{title}</h2>
      {children}
    </section>
  );
}

export const AllPrimitives: StoryObj = {
  render: () => (
    <div className="mx-auto max-w-5xl">
      <Section title="Button">
        <Button variant="primary">主要操作</Button>
        <Button variant="secondary">次要操作</Button>
        <Button variant="ghost">幽灵</Button>
        <Button variant="danger">危险</Button>
        <Button variant="link">链接</Button>
        <Button variant="primary" loading>加载中</Button>
        <Button variant="primary" disabled>禁用</Button>
        <Button variant="secondary" size="sm">小号</Button>
        <Button variant="secondary" size="lg">大号</Button>
      </Section>

      <Section title="Input / Textarea / Number / Date">
        <Input className="w-56" placeholder="普通输入" />
        <Input
          className="w-56"
          placeholder="带图标"
          leading={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="size-3.5">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          }
        />
        <Input className="w-56" placeholder="校验失败" aria-invalid />
        <InputNumber className="w-32" defaultValue={3} min={1} max={10} />
        <DatePicker className="w-44" />
      </Section>

      <Section title="Select / Toggles">
        <Select
          className="w-44"
          options={[
            { value: 'a', label: '选项 A' },
            { value: 'b', label: '选项 B' },
            { value: 'c', label: '选项 C', disabled: true },
          ]}
        />
        <Checkbox defaultChecked />
        <Switch defaultChecked />
        <RadioGroup
          defaultValue="x"
          options={[
            { value: 'x', label: '单选 X' },
            { value: 'y', label: '单选 Y' },
          ]}
        />
        <div className="w-40">
          <Slider defaultValue={[40]} max={100} />
        </div>
      </Section>

      <Section title="Badge / Tag / Avatar / Progress">
        <Badge tone="neutral">中性</Badge>
        <Badge tone="accent" dot>强调</Badge>
        <Badge tone="success" dot>运行中</Badge>
        <Badge tone="warning" dot>等待中</Badge>
        <Badge tone="danger" dot>失败</Badge>
        <Tag>标签</Tag>
        <Tag onRemove={() => undefined}>可移除</Tag>
        <Avatar fallback="AK" />
        <Avatar fallback="B" size="lg" />
        <div className="w-40"><Progress value={62} label="进度" /></div>
      </Section>

      <Section title="Alert / Loading">
        <Alert tone="info" title="提示">这是一条信息提示。</Alert>
        <Alert tone="warning" title="注意">这是一条警告。</Alert>
        <Alert tone="danger" title="错误">这是一条错误。</Alert>
      </Section>

      <CardSection title="Card（悬停抬升 + 聚光）">
        <div className="grid gap-3 sm:grid-cols-3">
          {['节点概览', 'GPU 使用率', '存储水位'].map((title, index) => (
            <Reveal key={title} delay={index * 70}>
              <Card interactive>
                <CardContent className="pt-4">
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>悬停查看抬升与指针聚光效果。</CardDescription>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </CardSection>

      <CardSection title="Panel">
        <Panel title="基本信息" description="两列字段布局" actions={<Button size="sm" variant="secondary">编辑</Button>}>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <div><dt className="text-[11px] text-ai-fg-muted">内网 IP</dt><dd className="text-xs text-ai-fg-secondary">10.0.0.12</dd></div>
            <div><dt className="text-[11px] text-ai-fg-muted">操作系统</dt><dd className="text-xs text-ai-fg-secondary">Ubuntu 22.04</dd></div>
            <div><dt className="text-[11px] text-ai-fg-muted">容器运行时</dt><dd className="text-xs text-ai-fg-secondary">containerd 1.7</dd></div>
            <div><dt className="text-[11px] text-ai-fg-muted">创建时间</dt><dd className="text-xs text-ai-fg-secondary">2026-11-09</dd></div>
          </dl>
        </Panel>
      </CardSection>

      <CardSection title="Tabs / Accordion / Breadcrumb / Pagination">
        <div className="mb-4"><Tabs items={[{ value: 'a', label: '概览' }, { value: 'b', label: '监控', count: 3 }, { value: 'c', label: '事件' }]} defaultValue="a" /></div>
        <div className="mb-4">
          <Accordion items={[{ value: '1', title: '展开第一项', content: '内容一' }, { value: '2', title: '展开第二项', content: '内容二' }]} />
        </div>
        <div className="mb-4"><Breadcrumb items={[{ label: '集群' }, { label: '节点' }, { label: 'node-01' }]} /></div>
        <Pagination page={2} pageSize={20} total={95} onChange={() => undefined} />
      </CardSection>

      <Section title="Dropdown / Tooltip / Popover / Modal / Drawer">
        <Dropdown
          trigger={<Button variant="secondary">更多操作</Button>}
          items={[
            { key: 'edit', label: '编辑' },
            { key: 'delete', label: '删除', danger: true, dividerBefore: true },
          ]}
        />
        <Tooltip content="这是提示"><Button variant="ghost">悬停提示</Button></Tooltip>
        <Popover trigger={<Button variant="secondary">弹出面板</Button>}>
          <Text size="sm">弹出层内容。</Text>
        </Popover>
        <ModalTrigger />
        <DrawerTrigger />
      </Section>

      <Section title="Toast">
        <ToastDemo />
      </Section>

      <CardSection title="Menu（含折叠态）">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-ai-lg border border-ai-line bg-ai-surface-1 p-2">
            <Menu
              items={DEMO_MENU}
              activeKey="nodes"
              aria-label="主导航（展开）"
            />
          </div>
          <div className="w-16 rounded-ai-lg border border-ai-line bg-ai-surface-1 p-2">
            <Menu items={DEMO_MENU} activeKey="nodes" collapsed aria-label="主导航（折叠）" />
          </div>
        </div>
      </CardSection>

      <CardSection title="Collapse">
        <Collapse
          items={[
            { key: '1', title: '调度策略', content: '默认按资源可用性调度，可指定节点亲和性。' },
            { key: '2', title: '存储卷', content: '支持本地卷、NFS 与 JuiceFS 挂载。' },
          ]}
          defaultOpenKeys={['1']}
        />
      </CardSection>

      <Section title="Text / Divider / Skeleton / Empty">
        <Text tone="muted" size="sm">次要文本</Text>
        <Text tone="accent" size="sm">强调文本</Text>
        <div className="w-40"><Divider /></div>
        <div className="w-40"><Skeleton className="h-3 w-full" /></div>
      </Section>

      <CardSection title="Empty / Loading">
        <Empty title="暂无数据" description="当前筛选条件下没有匹配的资源。" />
        <Loading />
      </CardSection>

      <Section title="FormField">
        <div className="w-64">
          <FormField label="名称" required hint="小写字母、数字与连字符">
            <Input placeholder="my-resource" />
          </FormField>
        </div>
        <div className="w-64">
          <FormField label="副本数" error="必须大于 0">
            <InputNumber defaultValue={0} aria-invalid />
          </FormField>
        </div>
        <div className="w-64">
          <FormField label="说明">
            <Textarea placeholder="可选说明" />
          </FormField>
        </div>
      </Section>
    </div>
  ),
};

function ToastDemo(): React.ReactElement {
  // A local provider keeps each demo isolated: a toast raised here must not
  // persist while the reader scrolls to another section.
  return (
    <ToastProvider position="bottom-right">
      <ToastButtons />
    </ToastProvider>
  );
}

function ToastButtons(): React.ReactElement {
  const { push } = useToast();
  return (
    <>
      <Button variant="secondary" onClick={() => push({ title: '保存成功', description: '配置已更新', tone: 'success' })}>成功提示</Button>
      <Button variant="secondary" onClick={() => push({ title: '节点不可达', description: 'a100-04 心跳超时', tone: 'danger' })}>错误提示</Button>
      <Button variant="secondary" onClick={() => push({ title: '批量删除', description: '3 个资源将被移除', tone: 'warning', action: { label: '撤销', onClick: () => undefined } })}>带操作</Button>
    </>
  );
}

const DEMO_MENU: MenuNode[] = [
  { key: 'overview', label: '概览', href: '#overview' },
  {
    key: 'cluster',
    label: '集群',
    children: [
      { key: 'nodes', label: '节点', href: '#nodes' },
      { key: 'storage', label: '存储', href: '#storage' },
      { key: 'network', label: '网络', href: '#network' },
    ],
  },
  { key: 'alerts', label: '告警', href: '#alerts', badge: <span className="rounded-ai-pill bg-ai-danger/15 px-1.5 text-[10px] text-ai-danger">3</span> },
];

function ModalTrigger(): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>打开弹窗</Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="确认操作"
        description="这个动作不可撤销。"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
            <Button variant="danger" onClick={() => setOpen(false)}>确认删除</Button>
          </>
        }
      >
        <Text size="sm" tone="muted">删除后相关分片与向量会一并清理。</Text>
      </Modal>
    </>
  );
}

function DrawerTrigger(): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>打开抽屉</Button>
      <Drawer open={open} onOpenChange={setOpen} title="详情" description="从右侧滑出">
        <Text size="sm" tone="muted">抽屉内容。</Text>
      </Drawer>
    </>
  );
}
