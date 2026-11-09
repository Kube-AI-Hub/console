import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { Button } from '../src/primitives/Button';
import { Input, Textarea } from '../src/primitives/Input';
import { Select } from '../src/primitives/Select';
import { Checkbox, RadioGroup, Slider, Switch } from '../src/primitives/Toggles';
import { InputNumber } from '../src/primitives/InputNumber';
import { DatePicker } from '../src/primitives/DatePicker';
import { Text } from '../src/primitives/Display';
import { Columns, Column, Level, LevelLeft, LevelRight, LevelItem } from '../src/primitives/Layout';
import { AutoComplete } from '../src/primitives/AutoComplete';

const meta: Meta = { title: 'Components/Forms', parameters: { layout: 'padded' } };
export default meta;

const SELECT_OPTIONS = [
  { value: 'a', label: '选项 A' },
  { value: 'b', label: '选项 B' },
  { value: 'c', label: '选项 C（禁用）', disabled: true },
];

/** Each form control in its normal, invalid and disabled state. */
export const Controls: StoryObj = {
  render: () => {
    const [checked, setChecked] = React.useState(true);
    const [radio, setRadio] = React.useState('x');
    const [slider, setSlider] = React.useState([40]);
    const [number, setNumber] = React.useState<number | null>(3);
    const [date, setDate] = React.useState('');
    const [select, setSelect] = React.useState('');
    return (
      <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ai-fg-secondary">Input</span>
          <Input placeholder="普通输入" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ai-fg-secondary">Input（校验失败）</span>
          <Input placeholder="必填项" aria-invalid />
        </label>
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs font-medium text-ai-fg-secondary">Textarea</span>
          <Textarea placeholder="多行文本" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ai-fg-secondary">Select</span>
          <Select options={SELECT_OPTIONS} value={select} onValueChange={setSelect} placeholder="请选择" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ai-fg-secondary">InputNumber</span>
          <InputNumber value={number} onChange={setNumber} min={1} max={50} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ai-fg-secondary">DatePicker</span>
          <DatePicker value={date} onChange={setDate} />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ai-fg-secondary">Switch / Checkbox</span>
          <div className="flex items-center gap-4">
            <Switch checked={checked} onCheckedChange={setChecked} aria-label="启用自动伸缩" />
            <Checkbox checked={checked} onCheckedChange={setChecked} aria-label="同意条款" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs font-medium text-ai-fg-secondary">RadioGroup</span>
          <RadioGroup
            value={radio}
            onValueChange={setRadio}
            options={[
              { value: 'x', label: '滚动更新' },
              { value: 'y', label: '重建' },
              { value: 'z', label: '手动（禁用）', disabled: true },
            ]}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs font-medium text-ai-fg-secondary">Slider</span>
          <Slider value={slider} onValueChange={setSlider} min={0} max={100} />
          <Text size="xs" tone="muted">当前值：{slider[0]}</Text>
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs font-medium text-ai-fg-secondary">禁用态</span>
          <div className="flex flex-wrap items-center gap-3">
            <Input placeholder="禁用输入" disabled className="w-40" />
            <Select options={SELECT_OPTIONS} disabled placeholder="禁用选择" className="w-40" />
            <Button disabled>禁用按钮</Button>
          </div>
        </div>
      </div>
    );
  },
};

/** Free-text input that suggests values; the value is not constrained. */
export const AutoCompleteDemo: StoryObj = {
  render: () => {
    const [value, setValue] = React.useState('');
    const options = ['default', 'kube-system', 'kubesphere-system', 'agent-platform', 'monitoring'].map((item) => ({ value: item }));
    return (
      <div className="mx-auto max-w-sm">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ai-fg-secondary">命名空间</span>
          <AutoComplete value={value} onChange={setValue} options={options} placeholder="输入或选择命名空间" />
        </label>
        <Text size="xs" tone="muted" className="mt-2">当前值：{value || '（空）'}</Text>
      </div>
    );
  },
};

/** Layout primitives carried over from kube-design. */
export const LayoutGrid: StoryObj = {
  render: () => (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <section>
        <Text size="xs" tone="muted" className="mb-2">Columns / Column（三列）</Text>
        <Columns gap={3}>
          {[1, 2, 3].map((index) => (
            <Column key={index}>
              <div className="rounded-ai-md border border-ai-line bg-ai-surface-1 p-3 text-center text-xs text-ai-fg-secondary">
                列 {index}
              </div>
            </Column>
          ))}
        </Columns>
      </section>

      <section>
        <Text size="xs" tone="muted" className="mb-2">Column size（1:2 比例）</Text>
        <Columns gap={3}>
          <Column size={4}>
            <div className="rounded-ai-md border border-ai-line bg-ai-surface-1 p-3 text-center text-xs text-ai-fg-secondary">4/12</div>
          </Column>
          <Column size={8}>
            <div className="rounded-ai-md border border-ai-line bg-ai-surface-1 p-3 text-center text-xs text-ai-fg-secondary">8/12</div>
          </Column>
        </Columns>
      </section>

      <section>
        <Text size="xs" tone="muted" className="mb-2">Level（标题 + 操作）</Text>
        <Level>
          <LevelLeft>
            <LevelItem heading>节点列表</LevelItem>
            <LevelItem>共 12 个</LevelItem>
          </LevelLeft>
          <LevelRight>
            <Button size="sm" variant="secondary">刷新</Button>
            <Button size="sm" variant="primary">创建</Button>
          </LevelRight>
        </Level>
      </section>
    </div>
  ),
};
