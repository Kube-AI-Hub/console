import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { Tabs, TabsContent } from '../src/primitives/Navigation';
import { DescriptionItem, DescriptionList } from '../src/primitives/DescriptionList';
import { PasswordStrengthMeter, type PasswordStrengthCheck } from '../src/primitives/PasswordStrength';
import { FormField } from '../src/primitives/FormField';
import { Input } from '../src/primitives/Input';

/**
 * The components and capabilities extracted for the user-settings migration.
 *
 * These assert the behaviour the page and its E2E tests depend on: stable tab
 * handles, the unsaved-changes hint, real dl semantics, the password meter's
 * machine-readable attributes, and the error handle FormField now carries.
 * Class names are not asserted, so restyling does not break the suite.
 */

describe('Tabs', () => {
  it('puts the aiId on the trigger as data-ai-id', () => {
    render(
      <Tabs
        defaultValue="profile"
        items={[
          { value: 'profile', label: '基本信息', aiId: 'user-settings:tab-profile' },
          { value: 'password', label: '密码设置', aiId: 'user-settings:tab-password' },
        ]}
      />,
    );
    expect(screen.getByRole('tab', { name: '基本信息' })).toHaveAttribute(
      'data-ai-id',
      'user-settings:tab-profile',
    );
    expect(screen.getByRole('tab', { name: '密码设置' })).toHaveAttribute(
      'data-ai-id',
      'user-settings:tab-password',
    );
  });

  it('renders a decorative badge alongside visually hidden badgeLabel text', () => {
    render(
      <Tabs
        defaultValue="profile"
        items={[
          {
            value: 'profile',
            label: '基本信息',
            badge: <span data-testid="dirty-dot" />,
            badgeLabel: '未保存的修改',
          },
        ]}
      />,
    );
    const tab = screen.getByRole('tab', { name: /基本信息/ });
    // The dot is decoration; the accessible name comes from the visible label
    // plus the visually hidden sentence.
    expect(tab).toHaveAccessibleName('基本信息 未保存的修改');

    const dot = within(tab).getByTestId('dirty-dot');
    expect(dot.parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(within(tab).getByText('未保存的修改')).toHaveClass('sr-only');
  });

  it('switches TabsContent panels with the selection', async () => {
    render(
      <Tabs
        defaultValue="profile"
        items={[
          { value: 'profile', label: '基本信息' },
          { value: 'password', label: '密码设置' },
        ]}
      >
        <TabsContent value="profile">账号信息</TabsContent>
        <TabsContent value="password">修改密码</TabsContent>
      </Tabs>,
    );
    expect(screen.getByText('账号信息')).toBeInTheDocument();
    expect(screen.queryByText('修改密码')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: '密码设置' }));
    expect(await screen.findByText('修改密码')).toBeInTheDocument();
    expect(screen.queryByText('账号信息')).not.toBeInTheDocument();
  });

  it('moves the selection with arrow keys', async () => {
    render(
      <Tabs
        defaultValue="profile"
        items={[
          { value: 'profile', label: '基本信息' },
          { value: 'password', label: '密码设置' },
        ]}
      />,
    );
    const profile = screen.getByRole('tab', { name: '基本信息' });
    // Click rather than calling focus() outside act(): a bare focus() updates
    // Radix's roving-focus state and React warns about the unwrapped update.
    await userEvent.click(profile);
    expect(profile).toHaveFocus();
    expect(profile).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: '密码设置' })).toHaveAttribute('aria-selected', 'true');
    expect(profile).toHaveAttribute('aria-selected', 'false');
  });
});

describe('DescriptionList', () => {
  it('renders dt/dd pairs inside a dl', () => {
    const { container } = render(
      <DescriptionList
        items={[
          { label: '节点名称', value: 'gpu01' },
          { label: '内网 IP', value: '10.0.0.14' },
        ]}
      />,
    );
    const dl = container.querySelector('dl');
    expect(dl).not.toBeNull();
    expect(dl!.querySelectorAll('dt')).toHaveLength(2);
    expect(dl!.querySelectorAll('dd')).toHaveLength(2);
    expect(screen.getByText('节点名称').tagName).toBe('DT');
    // The value is wrapped in a span so the aiId can carry exactly the value text.
    expect(screen.getByText('gpu01').closest('dd')).not.toBeNull();
  });

  it('renders DescriptionItem as a bare dt/dd fragment', () => {
    const { container } = render(
      <dl>
        <DescriptionItem label="名称" value="gpu01" />
      </dl>,
    );
    const dl = container.querySelector('dl')!;
    // No wrapper element, so the pair can drop into a caller's own grid.
    expect(dl.children).toHaveLength(2);
    expect(dl.children[0]!.tagName).toBe('DT');
    expect(dl.children[1]!.tagName).toBe('DD');
  });

  it('puts the hint under the value inside the dd', () => {
    render(<DescriptionList items={[{ label: '用户名', value: 'admin', hint: '登录账号，不能修改。' }]} />);
    const hint = screen.getByText('登录账号，不能修改。');
    expect(hint.tagName).toBe('SPAN');
    expect(hint.closest('dd')).not.toBeNull();
  });

  it('shows a dash for null, undefined and empty values but keeps 0', () => {
    render(
      <DescriptionList
        items={[
          { label: '邮箱', value: '' },
          { label: '角色', value: null },
          { label: '备注', value: undefined },
          { label: '副本数', value: 0 },
        ]}
      />,
    );
    expect(screen.getAllByText('-')).toHaveLength(3);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('puts the aiId on the value, not on the dd that may carry a hint', () => {
    const { container } = render(
      <DescriptionList
        className="grid-cols-2"
        items={[{ label: '用户名', value: 'admin', hint: '登录账号，不能修改。', aiId: 'user-settings:username' }]}
      />,
    );
    const value = container.querySelector('[data-ai-id="user-settings:username"]')!;
    expect(value.tagName).toBe('SPAN');
    // Exact text: the hint is around the value, not part of it. Automation asserts
    // on this node's text, so a hint inside it would break every such assertion.
    expect(value).toHaveTextContent(/^admin$/);
    expect(value.closest('dd')).not.toBeNull();
    const dl = container.querySelector('dl')!;
    expect(dl.className).toContain('grid');
    expect(dl.className).toContain('grid-cols-2');
    // The caller's column count must replace the default, not duplicate it.
    expect(dl.className).not.toContain('grid-cols-1');
  });

  /*
   * The dense variant exists because an overview panel is read like a specification
   * table: the reader finds the field in the left column, then reads its value on the
   * right. The label is therefore the larger half (14px medium, primary colour) and the
   * value the smaller one (12px, secondary colour). The failure it prevents is the
   * reverse — a 14px value against a 12px muted label, where the answer outshouted the
   * question and a row could not be scanned by field name.
   */
  it('makes the label the larger half in the dense variant', () => {
    const { container } = render(
      <DescriptionList variant="dense" items={[{ label: '供应者', value: 'E2E Provider' }]} />,
    );
    const dl = container.querySelector('dl')!;
    expect(dl.className).toContain('[&>dt]:text-sm');
    expect(dl.className).toContain('[&>dt]:font-medium');
    expect(dl.className).toContain('[&>dt]:text-ai-fg');
    expect(dl.className).toContain('[&>dd]:text-ai-fg-secondary');
    // The value must be visibly the smaller of the two, not merely a different colour:
    // 14px label against 12px value.
    expect(dl.className).toContain('text-xs');
    // Wide tracking belongs to the demoted-label version; with the label now the louder
    // half it would only make the left column look like small caps.
    expect(dl.className).not.toContain('[&>dt]:tracking-wide');
    // Two columns from `sm`; a phone stacks them because a 40% label column leaves the
    // value too narrow to read.
    expect(dl.className).toContain('sm:grid-cols-[minmax(5.5rem,7.5rem)_1fr]');
    // Start-aligned cells, not baseline: the rule is drawn on both halves of a row and
    // baseline alignment offsets them (measured 2.5px), splitting one line into two.
    expect(dl.className).toContain('sm:items-start');
    expect(dl.className).not.toContain('sm:items-baseline');
  });

  it('draws one rule per field, skipping the first row', () => {
    const { container } = render(
      <DescriptionList variant="dense" divided items={[{ label: 'a', value: '1' }, { label: 'b', value: '2' }]} />,
    );
    const dl = container.querySelector('dl')!;
    // `nth-child(n+3)` is the third cell — the label of the second pair. The first pair
    // must stay borderless or it doubles the panel header's own border.
    expect(dl.className).toContain('[&>dt:nth-child(n+3)]:border-t');
    expect(dl.className).toContain('sm:[&>dd:nth-child(n+4)]:border-t');
    expect(dl.className).toContain('border-ai-line');
    expect(dl.className).not.toContain('[&>dt:nth-child(n+1)]:border-t');
  });

  it('leaves the default variant untouched', () => {
    const { container } = render(<DescriptionList items={[{ label: '节点名称', value: 'gpu01' }]} />);
    const dl = container.querySelector('dl')!;
    expect(dl.className).toContain('gap-3');
    expect(dl.className).toContain('sm:grid-cols-[minmax(6rem,auto)_1fr]');
    expect(dl.className).not.toContain('text-xs [&>dt]');
    expect(dl.className).not.toContain('border-t');
  });
});

const CHECKS: PasswordStrengthCheck[] = [
  { key: 'case', label: '包含大写与小写字母', met: true },
  { key: 'digit', label: '包含数字', met: false },
  { key: 'special', label: '包含特殊字符', met: false },
  { key: 'length', label: '8–64 位', met: true },
];

const METER_TEXT = {
  title: '密码强度',
  rule: '您的密码必须：',
  hint: '避免使用弱密码或其它账户的密码。',
};

describe('PasswordStrengthMeter', () => {
  it('marks each level with data-strength and shows the readable word', () => {
    const { container, rerender } = render(
      <PasswordStrengthMeter {...METER_TEXT} level="weak" levelLabel="弱" checks={CHECKS} />,
    );
    expect(container.firstElementChild).toHaveAttribute('data-strength', 'weak');
    expect(screen.getByText('密码强度')).toBeInTheDocument();
    expect(screen.getByText('您的密码必须：')).toBeInTheDocument();
    expect(screen.getByText('弱')).toBeInTheDocument();

    const met = CHECKS.map((check) => ({ ...check, met: true }));
    rerender(<PasswordStrengthMeter {...METER_TEXT} level="medium" levelLabel="中" checks={met} />);
    expect(container.firstElementChild).toHaveAttribute('data-strength', 'medium');
    expect(screen.getByText('中')).toBeInTheDocument();

    rerender(<PasswordStrengthMeter {...METER_TEXT} level="strong" levelLabel="强" checks={met} />);
    expect(container.firstElementChild).toHaveAttribute('data-strength', 'strong');
    expect(screen.getByText('强')).toBeInTheDocument();
  });

  it('reports each check through data-met', () => {
    render(<PasswordStrengthMeter {...METER_TEXT} level="weak" levelLabel="弱" checks={CHECKS} />);
    expect(screen.getByText('包含大写与小写字母').closest('li')).toHaveAttribute('data-met', 'true');
    expect(screen.getByText('包含数字').closest('li')).toHaveAttribute('data-met', 'false');
    expect(screen.getByText('8–64 位').closest('li')).toHaveAttribute('data-met', 'true');
    expect(screen.getByText('包含特殊字符').closest('li')).toHaveAttribute('data-met', 'false');
  });

  it('builds data-ai-id handles from aiPrefix', () => {
    const { container } = render(
      <PasswordStrengthMeter
        {...METER_TEXT}
        level="weak"
        levelLabel="弱"
        checks={CHECKS}
        aiPrefix="user-settings"
      />,
    );
    expect(container.firstElementChild).toHaveAttribute('data-ai-id', 'user-settings:password-strength');

    const bar = container.querySelector('[data-ai-id="user-settings:password-strength-bar"]');
    expect(bar).not.toBeNull();
    // The bar is decoration; the level word beside it carries the meaning.
    expect(bar!.parentElement).toHaveAttribute('aria-hidden', 'true');

    expect(container.querySelector('[data-ai-id="user-settings:password-check-case"]')).not.toBeNull();
    expect(container.querySelector('[data-ai-id="user-settings:password-check-digit"]')).not.toBeNull();
  });

  it('renders no handles at all without aiPrefix', () => {
    const { container } = render(
      <PasswordStrengthMeter {...METER_TEXT} level="weak" levelLabel="弱" checks={CHECKS} />,
    );
    expect(container.querySelector('[data-ai-id]')).toBeNull();
  });

  it('exposes the caller-composed ariaLabel on the panel', () => {
    const { container } = render(
      <PasswordStrengthMeter
        {...METER_TEXT}
        level="weak"
        levelLabel="弱"
        checks={CHECKS}
        ariaLabel="密码强度: 弱"
      />,
    );
    expect(container.firstElementChild).toHaveAttribute('aria-label', '密码强度: 弱');
  });
});

describe('FormField', () => {
  it('puts errorAiId on the alert paragraph', () => {
    render(
      <FormField label="邮箱" error="请输入合法的邮箱地址。" errorAiId="user-settings:profile-error">
        <Input aria-label="邮箱" />
      </FormField>,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('data-ai-id', 'user-settings:profile-error');
    expect(alert).toHaveTextContent('请输入合法的邮箱地址。');
  });

  it('shows the hint when there is no error, and the error wins when both are set', () => {
    const { rerender } = render(
      <FormField label="邮箱" hint="邮箱地址可用于登录 Web 控制台。" errorAiId="user-settings:profile-error">
        <Input aria-label="邮箱" />
      </FormField>,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('邮箱地址可用于登录 Web 控制台。')).toBeInTheDocument();

    rerender(
      <FormField
        label="邮箱"
        hint="邮箱地址可用于登录 Web 控制台。"
        error="请输入合法的邮箱地址。"
        errorAiId="user-settings:profile-error"
      >
        <Input aria-label="邮箱" />
      </FormField>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('请输入合法的邮箱地址。');
    expect(screen.queryByText('邮箱地址可用于登录 Web 控制台。')).not.toBeInTheDocument();
  });
});
