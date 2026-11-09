import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { Badge, Tag, Progress, resolveProgressTone, Text } from '../src/primitives/Display';
import { Switch, Slider, RadioGroup } from '../src/primitives/Toggles';
import { DatePicker } from '../src/primitives/DatePicker';
import { Table, type TableColumn, type TableSortState } from '../src/primitives/Table';
import { Dropdown } from '../src/primitives/Navigation';
import { Tooltip } from '../src/primitives/Feedback';
import { Button } from '../src/primitives/Button';

const meta: Meta = { title: 'Components/Capabilities', parameters: { layout: 'padded' } };
export default meta;

/**
 * Capabilities carried over from kube-design that the earlier port had missed.
 *
 * Each story is a side-by-side of the states that were previously impossible to
 * express, so a regression in any one of them is visible without clicking.
 */

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section className="mb-6">
      <h2 className="mb-1 text-xs font-semibold text-ai-fg">{title}</h2>
      {hint ? <Text size="xs" tone="muted" className="mb-2">{hint}</Text> : null}
      {children}
    </section>
  );
}

/* ---------------- Badge / Tag / Progress ---------------- */

export const StatusAndCounts: StoryObj = {
  render: () => (
    <div className="mx-auto max-w-3xl">
      <Section title="Badge: 状态文字" hint="色点 + 文字，适合表格的状态列，不使用胶囊底色。">
        <div className="flex flex-wrap gap-5">
          <Badge text="运行中" tone="success" />
          <Badge text="等待调度" tone="warning" />
          <Badge text="失败" tone="danger" />
          <Badge text="已停止" tone="neutral" />
          <Badge text="同步中" tone="info" />
        </div>
      </Section>

      <Section title="Badge: 计数与溢出截断" hint="超出 max（默认 99）显示 99+，原始数字保留在 title 中。">
        <div className="flex items-center gap-3">
          <Badge count={0} />
          <Badge count={7} tone="accent" />
          <Badge count={99} tone="info" />
          <Badge count={100} tone="danger" />
          <Badge count={1284} tone="danger" />
          <Badge count={50} max={10} tone="warning" />
        </div>
      </Section>

      <Section title="Tag: 语义色与自定义颜色">
        <div className="flex flex-wrap items-center gap-2">
          {(['neutral', 'accent', 'info', 'success', 'warning', 'danger'] as const).map((tone) => (
            <Tag key={tone} tone={tone}>{tone}</Tag>
          ))}
          <Tag color="#8b5cf6">color=#8b5cf6</Tag>
          <Tag color="#22c55e" onRemove={() => undefined}>可移除</Tag>
        </div>
      </Section>

      <Section title="Progress: 阈值自动判色" hint="tone='auto'，默认阈值 [80, 95]。">
        <div className="flex flex-col gap-3">
          {[30, 79, 80, 94, 95, 100].map((value) => (
            <div key={value} className="flex items-center gap-3">
              <span className="w-10 shrink-0 font-ai-mono text-[11px] text-ai-fg-muted">{value}%</span>
              <Progress value={value} tone="auto" label={`容量 ${value}%`} className="flex-1" />
              <span className="w-20 shrink-0 text-right text-[11px] text-ai-fg-secondary">
                {resolveProgressTone(value)}
              </span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  ),
};

/* ---------------- Switch / Radio / Slider ---------------- */

export const FormControls: StoryObj = {
  render: () => {
    const [withText, setWithText] = React.useState(true);
    const [strategy, setStrategy] = React.useState('rolling');
    const [plain, setPlain] = React.useState('a');
    const [single, setSingle] = React.useState([40]);
    const [ranged, setRanged] = React.useState([20, 70]);
    const [unit, setUnit] = React.useState([8]);
    return (
      <div className="mx-auto max-w-3xl">
        <Section title="Switch: 轨道内文字" hint="开启后轨道变宽，标签显示在当前未被滑块占用的那一侧。">
          <div className="flex flex-wrap items-center gap-6">
            <Switch checked={withText} onCheckedChange={setWithText} onText="ON" offText="OFF" aria-label="带文字开关" />
            <Switch defaultChecked onText="开" offText="关" aria-label="中文字开关" />
            <Switch disabled defaultChecked aria-label="禁用" />
          </div>
          <Text size="xs" tone="muted" className="mt-2">
            {/* One shared caption instead of a label glued to each switch: the
                duplicate text read as a stray glyph leaking out of the track. */}
            当前状态：{withText ? '开启' : '关闭'}；最右侧为禁用态
          </Text>
        </Section>

        <Section title="RadioGroup: 分段按钮形态" hint="相邻项合并边框，选中项填充主色。适合 2–4 个互斥模式。">
          <div className="flex flex-col gap-3">
            <RadioGroup
              variant="button"
              value={strategy}
              onValueChange={setStrategy}
              options={[
                { value: 'rolling', label: '滚动更新' },
                { value: 'recreate', label: '重建' },
                { value: 'manual', label: '手动', disabled: true },
              ]}
            />
            <RadioGroup
              value={plain}
              onValueChange={setPlain}
              options={[
                { value: 'a', label: '普通单选 A' },
                { value: 'b', label: '普通单选 B' },
              ]}
            />
            <Text size="xs" tone="muted">当前策略：{strategy} / 当前单选：{plain}</Text>
          </div>
        </Section>

        <Section title="Slider: 刻度、范围与单位">
          <div className="flex flex-col gap-7">
            <div>
              <Text size="xs" tone="muted" className="mb-1">单值 + marks + unit</Text>
              <Slider
                value={unit}
                onValueChange={setUnit}
                min={0}
                max={16}
                marks={{ 0: '0', 4: '4', 8: '8', 12: '12', 16: '16' }}
                unit=" Gi"
                hasTooltip
              />
            </div>
            <div>
              <Text size="xs" tone="muted" className="mb-1">范围选择</Text>
              <Slider
                value={ranged}
                onValueChange={setRanged}
                range
                marks={{ 0: '0', 25: '25', 50: '50', 75: '75', 100: '100' }}
                hasTooltip
              />
              <Text size="xs" tone="muted">区间：{ranged[0]} – {ranged[1]}</Text>
            </div>
            <div>
              <Text size="xs" tone="muted" className="mb-1">单值（无刻度）</Text>
              <Slider value={single} onValueChange={setSingle} />
            </div>
          </div>
        </Section>
      </div>
    );
  },
};

/* ---------------- DatePicker ---------------- */

export const DatePickerModes: StoryObj = {
  render: () => {
    const [date, setDate] = React.useState('2026-11-10');
    const [withTime, setWithTime] = React.useState('2026-11-10 09:30');
    const [limited, setLimited] = React.useState('');
    const today = React.useMemo(() => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }, []);
    return (
      <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
        <Section title="日期 + 清除按钮">
          <DatePicker value={date} onChange={setDate} id="dp-date" />
          <Text size="xs" tone="muted" className="mt-1">当前值：{date || '（空）'}</Text>
        </Section>
        <Section title="日期 + 时间">
          <DatePicker value={withTime} onChange={setWithTime} withTime id="dp-time" />
          <Text size="xs" tone="muted" className="mt-1">当前值：{withTime || '（空）'}</Text>
        </Section>
        <Section title="禁用过去日期" hint="disabledDate 返回 true 的日期不可选。">
          <DatePicker
            value={limited}
            onChange={setLimited}
            id="dp-limited"
            disabledDate={(candidate) => candidate < today}
          />
          <Text size="xs" tone="muted" className="mt-1">当前值：{limited || '（空）'}</Text>
        </Section>
        <Section title="不可清除">
          <DatePicker value={date} onChange={setDate} clearable={false} id="dp-noclear" />
        </Section>
      </div>
    );
  },
};

/* ---------------- Table ---------------- */

interface NodeRow {
  name: string;
  role: string;
  cpu: number;
  status: string;
}

const NODE_ROWS: NodeRow[] = [
  { name: 'gpu01', role: 'worker', cpu: 62, status: 'Ready' },
  { name: 'gpu02', role: 'worker', cpu: 91, status: 'Ready' },
  { name: 'master-0', role: 'control-plane', cpu: 34, status: 'Ready' },
  { name: 'gpu03', role: 'worker', cpu: 12, status: 'NotReady' },
];

export const SortableExpandableTable: StoryObj = {
  render: () => {
    const [sorter, setSorter] = React.useState<TableSortState | undefined>({ key: 'cpu', order: 'desc' });
    const [selected, setSelected] = React.useState<string[]>(['gpu02']);

    // Sorting lives here because the table only reports the requested order.
    const ordered = React.useMemo(() => {
      if (!sorter) return NODE_ROWS;
      const direction = sorter.order === 'asc' ? 1 : -1;
      return [...NODE_ROWS].sort((a, b) => (a[sorter.key as keyof NodeRow] > b[sorter.key as keyof NodeRow] ? direction : -direction));
    }, [sorter]);

    const columns: Array<TableColumn<NodeRow>> = [
      { key: 'name', title: '名称', sortable: true, render: (row) => <span className="font-medium text-ai-fg">{row.name}</span> },
      { key: 'role', title: '角色', sortable: true },
      { key: 'cpu', title: 'CPU', sortable: true, align: 'right', render: (row) => `${row.cpu}%` },
      {
        key: 'status',
        title: '状态',
        render: (row) => <Badge text={row.status} tone={row.status === 'Ready' ? 'success' : 'danger'} />,
      },
    ];

    return (
      <div className="mx-auto max-w-3xl">
        <Section title="排序 + 行展开 + 选择" hint="点表头在升序 / 降序 / 无序之间循环；展开按钮的箭头旋转 90°，展开行跨列合并。">
          <Table
            columns={columns}
            rows={ordered}
            rowKey={(row) => row.name}
            sorter={sorter}
            onSortChange={setSorter}
            selection={{ selectedKeys: selected, onChange: setSelected }}
            expandedRow={(row) => (
              <div className="grid gap-1 text-[11px] text-ai-fg-secondary">
                <span>角色：{row.role}</span>
                <span>CPU 使用率：{row.cpu}%</span>
                <span>状态：{row.status}</span>
              </div>
            )}
          />
          <Text size="xs" tone="muted" className="mt-2">
            当前排序：{sorter ? `${sorter.key} ${sorter.order}` : '无'}；已选：{selected.length} 项
          </Text>
        </Section>
      </div>
    );
  },
};

/* ---------------- Dropdown / Tooltip ---------------- */

export const OverlayTriggers: StoryObj = {
  render: () => {
    const [open, setOpen] = React.useState(false);
    return (
      <div className="mx-auto max-w-3xl">
        <Section title="Dropdown: 受控展开" hint="open / onOpenChange 完全由外部控制，适合由键盘快捷键或工具栏按钮驱动。">
          <div className="flex flex-wrap items-center gap-3">
            <Dropdown
              open={open}
              onOpenChange={setOpen}
              trigger={<Button variant="secondary">受控菜单（{open ? '已展开' : '已收起'}）</Button>}
              items={[
                { key: 'reveal', label: '查看 YAML' },
                { key: 'edit', label: '编辑配置' },
              ]}
            />
            <Button variant="ghost" onClick={() => setOpen((value) => !value)}>外部切换</Button>
          </div>
        </Section>

        <Section title="Dropdown: 选择后不关闭" hint="closeOnSelect=false，适合连续勾选类操作。">
          <Dropdown
            closeOnSelect={false}
            trigger={<Button variant="secondary">保持展开</Button>}
            items={[
              { key: 'a', label: '第一项' },
              { key: 'b', label: '第二项' },
              { key: 'c', label: '第三项' },
            ]}
          />
        </Section>

        <Section title="Tooltip: hover 与 click">
          <div className="flex flex-wrap items-center gap-3">
            <Tooltip content="悬停 200ms 后出现">
              <Button variant="ghost">hover 触发</Button>
            </Tooltip>
            <Tooltip content="点击才出现，再点一次才消失" trigger="click">
              <Button variant="secondary">click 触发</Button>
            </Tooltip>
          </div>
        </Section>
      </div>
    );
  },
};
