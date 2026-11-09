import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { Slider } from '../src/primitives/Toggles';
import { ComponentDocs } from './_docs-layout';

const sliderMeta: Meta<typeof Slider> = {
  title: 'Components/Slider',
  component: Slider,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="Slider"
          summary="在一个连续区间内取值。适合能容忍粗调的场景，精确值请配 InputNumber。"
          description={
            <>
              支持刻度（<code>marks</code>）、双端范围（<code>range</code>）、单位后缀（<code>unit</code>）
              与悬停数值提示。刻度标签按百分比定位，首尾锚定在轨道两端，不会溢出。
              需要精确输入时，Slider 旁边配一个 <code>InputNumber</code> 是更好的组合。
            </>
          }
        />
      ),
    },
  },
};

export default sliderMeta;

export const BasicSlider: StoryObj<typeof Slider> = {
  name: 'basic slider',
  render: () => {
    const [single, setSingle] = React.useState([40]);
    const [ranged, setRanged] = React.useState([20, 70]);
    return (
      <div className="flex max-w-lg flex-col gap-8">
        <div>
          <p className="mb-1 text-xs text-ai-fg-muted">单值</p>
          <Slider value={single} onValueChange={setSingle} />
          <p className="mt-1 text-xs text-ai-fg-muted">当前值：{single[0]}</p>
        </div>
        <div>
          <p className="mb-1 text-xs text-ai-fg-muted">双端范围</p>
          <Slider value={ranged} onValueChange={setRanged} range hasTooltip />
          <p className="mt-1 text-xs text-ai-fg-muted">区间：{ranged[0]} – {ranged[1]}</p>
        </div>
        <div>
          <p className="mb-1 text-xs text-ai-fg-muted">带刻度与单位</p>
          <Slider
            defaultValue={[8]}
            min={0}
            max={16}
            marks={{ 0: '0', 4: '4', 8: '8', 12: '12', 16: '16' }}
            unit=" Gi"
            hasTooltip
          />
        </div>
      </div>
    );
  },
};
