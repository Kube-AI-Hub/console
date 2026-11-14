import type { Meta, StoryObj } from '@storybook/react';
import { PasswordStrengthMeter, type PasswordStrengthCheck } from '../src/primitives/PasswordStrength';
import { ComponentDocs } from './_docs-layout';

const meta: Meta<typeof PasswordStrengthMeter> = {
  title: 'Components/PasswordStrength',
  component: PasswordStrengthMeter,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <ComponentDocs
          name="PasswordStrength"
          summary="密码强度面板：强度条 + 档位文字 + 规则 checklist。"
          description={
            <>
              纯展示组件：规则判定与档位推导留在调用方（console 用 api-client 的
              <code>passwordChecks</code>），文案全部通过 props 传入，库不内置 i18n。
              档位既有文字标签也有 <code>data-strength</code>，颜色不是唯一信号；
              进度条 <code>aria-hidden</code>，读屏读的是旁边的档位文字。
              <code>aiPrefix</code> 生成 <code>data-ai-id</code> 句柄（面板 / 强度条 / 每条
              checklist），省略则不渲染任何句柄。
            </>
          }
        />
      ),
    },
  },
};

export default meta;
type Story = StoryObj<typeof PasswordStrengthMeter>;

const CHECK_LABEL = {
  case: '包含大写与小写字母',
  digit: '包含数字',
  special: '包含特殊字符',
  length: '8–64 位',
};

function checks(met: { case: boolean; digit: boolean; special: boolean; length: boolean }): PasswordStrengthCheck[] {
  return [
    { key: 'case', label: CHECK_LABEL.case, met: met.case },
    { key: 'digit', label: CHECK_LABEL.digit, met: met.digit },
    { key: 'special', label: CHECK_LABEL.special, met: met.special },
    { key: 'length', label: CHECK_LABEL.length, met: met.length },
  ];
}

const PANEL_PROPS = {
  title: '密码强度',
  rule: '您的密码必须：',
  hint: '避免使用弱密码或其它账户的密码。',
  aiPrefix: 'demo',
};

/** 弱：还有规则未满足（这里缺数字与特殊字符）。 */
export const Weak: Story = {
  name: 'weak',
  render: () => (
    <div className="mx-auto max-w-md">
      <PasswordStrengthMeter
        {...PANEL_PROPS}
        level="weak"
        levelLabel="弱"
        ariaLabel="密码强度: 弱"
        checks={checks({ case: true, digit: false, special: false, length: true })}
      />
    </div>
  ),
};

/** 中：规则都满足但长度不足——所有 checklist 打勾，强度仍只是中。 */
export const Medium: Story = {
  name: 'medium',
  render: () => (
    <div className="mx-auto max-w-md">
      <PasswordStrengthMeter
        {...PANEL_PROPS}
        level="medium"
        levelLabel="中"
        ariaLabel="密码强度: 中"
        checks={checks({ case: true, digit: true, special: true, length: true })}
      />
    </div>
  ),
};

/** 强：满足规则且足够长（console 的实现里是 12 位以上）。 */
export const Strong: Story = {
  name: 'strong',
  render: () => (
    <div className="mx-auto max-w-md">
      <PasswordStrengthMeter
        {...PANEL_PROPS}
        level="strong"
        levelLabel="强"
        ariaLabel="密码强度: 强"
        checks={checks({ case: true, digit: true, special: true, length: true })}
      />
    </div>
  ),
};
