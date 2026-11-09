import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { Switch } from '../src/primitives/Toggles';
import { ComponentDocs } from './_docs-layout';

const switchMeta: Meta<typeof Switch> = {
  title: 'Components/Toggle',
  component: Switch,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="Toggle"
          summary="二元开关，切换立即生效。需要点「保存」才提交的用 Checkbox。"
          description={
            <>
              导出名为 <code>Switch</code>，对应 kube-design 的 <code>Toggle</code>。
              轨道内可以显示短标签（<code>onText</code> / <code>offText</code>），
              标签会出现在滑块<strong>未占用</strong>的那一侧，最多两个字。
            </>
          }
        />
      ),
    },
  },
};

export default switchMeta;

export const BasicToggle: StoryObj<typeof Switch> = {
  name: 'basic toggle',
  render: () => {
    const [checked, setChecked] = React.useState(false);
    return (
      <div className="flex flex-col gap-4">
        <label className="flex items-center gap-2 text-sm text-ai-fg-secondary">
          <Switch checked={checked} onCheckedChange={setChecked} aria-label="自动伸缩" />
          启用自动伸缩
        </label>
        <label className="flex items-center gap-2 text-sm text-ai-fg-faint">
          <Switch disabled aria-label="禁用" />
          禁用状态
        </label>
      </div>
    );
  },
};

/**
 * 轨道内标签：轨道随文字宽度增长，所以两个字的中文不会被裁掉。
 *
 * 标签显示在滑块<strong>未占用</strong>的那一侧——开启时显示 `offText`，
 * 因为滑块此时在右侧，左侧才是空位。
 */
export const WithInnerText: StoryObj<typeof Switch> = {
  name: 'with inner text',
  render: () => {
    const [a, setA] = React.useState(true);
    const [b, setB] = React.useState(false);
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Switch checked={a} onCheckedChange={setA} onText="ON" offText="OFF" aria-label="英文标签" />
          <span className="text-xs text-ai-fg-muted">开启时轨道显示 OFF（写的是对侧状态）</span>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={b} onCheckedChange={setB} onText="开" offText="关" aria-label="中文标签" />
          <span className="text-xs text-ai-fg-muted">中文两字同样完整显示</span>
        </div>
        <div className="flex items-center gap-3">
          <Switch defaultChecked onText="启用" offText="停用" aria-label="两字动词" />
          <span className="text-xs text-ai-fg-muted">「启用 / 停用」</span>
        </div>
      </div>
    );
  },
};

/** 标签只适用于很短的状态词；更长的说明放在开关旁边。 */
export const TextBeside: StoryObj<typeof Switch> = {
  name: 'text beside',
  render: () => {
    const [checked, setChecked] = React.useState(true);
    return (
      <label className="flex items-center gap-3 text-sm text-ai-fg-secondary">
        <Switch checked={checked} onCheckedChange={setChecked} aria-label="启用 GPU 共享" />
        <span>
          启用 GPU 共享
          <span className="block text-xs text-ai-fg-muted">多个 Pod 可复用同一张卡</span>
        </span>
      </label>
    );
  },
};
