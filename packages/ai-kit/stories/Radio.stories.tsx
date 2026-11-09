import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { RadioGroup, Radio } from '../src/primitives/Toggles';
import { ComponentDocs } from './_docs-layout';

const radioMeta: Meta<typeof RadioGroup> = {
  title: 'Components/Radio',
  component: RadioGroup,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="Radio"
          summary="一组互斥选项。选项 2–4 个且需要并列展示时用分段按钮形态。"
          description={
            <>
              <code>variant=&quot;radio&quot;</code> 是经典圆点，适合 5 个以上的纵向列表；
              <code>variant=&quot;button&quot;</code> 是分段控件，相邻项共享边框、选中项填充主色，
              适合更新策略、时间范围这类需要一眼看到全部选项的短列表。
              单个 <code>Radio</code> 只在 <code>RadioGroup</code> 内使用，选择状态由组管理。
            </>
          }
        />
      ),
    },
  },
};

export default radioMeta;

export const BasicRadio: StoryObj<typeof RadioGroup> = {
  name: 'basic radio',
  render: () => {
    const [value, setValue] = React.useState('x86');
    return (
      <RadioGroup
        value={value}
        onValueChange={setValue}
        options={[
          { value: 'x86', label: 'x86_64' },
          { value: 'arm', label: 'arm64' },
          { value: 'ppc', label: 'ppc64le（不支持）', disabled: true },
        ]}
      />
    );
  },
};

export const BasicRadioGroupButton: StoryObj<typeof RadioGroup> = {
  name: 'basic radio group button',
  render: () => {
    const [value, setValue] = React.useState('rolling');
    return (
      <div className="flex flex-col gap-3">
        <RadioGroup
          variant="button"
          value={value}
          onValueChange={setValue}
          options={[
            { value: 'rolling', label: '滚动更新' },
            { value: 'recreate', label: '重建' },
            { value: 'manual', label: '手动', disabled: true },
          ]}
        />
        <p className="text-xs text-ai-fg-muted">当前策略：{value}</p>
      </div>
    );
  },
};

/** 自定义布局时直接用 `Radio` 项，仍需包在 `RadioGroup` 内。 */
export const CustomLayout: StoryObj<typeof RadioGroup> = {
  name: 'custom layout',
  render: () => {
    const [value, setValue] = React.useState('a');
    return (
      <RadioGroup value={value} onValueChange={setValue} className="flex-col gap-2">
        <label className="flex items-start gap-2 rounded-ai-md border border-ai-line p-3">
          <Radio value="a" className="mt-0.5" />
          <span className="text-xs">
            <span className="block font-medium text-ai-fg">标准型</span>
            <span className="text-ai-fg-muted">4 核 8 GiB，适合开发与测试</span>
          </span>
        </label>
        <label className="flex items-start gap-2 rounded-ai-md border border-ai-line p-3">
          <Radio value="b" className="mt-0.5" />
          <span className="text-xs">
            <span className="block font-medium text-ai-fg">计算型</span>
            <span className="text-ai-fg-muted">16 核 32 GiB，适合训练前置处理</span>
          </span>
        </label>
      </RadioGroup>
    );
  },
};
