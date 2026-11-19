import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TimeRangePicker } from '../src/charts/TimeRangePicker';
import type { TimeRangePickerLabels } from '../src/charts/TimeRangePicker';
import { presetRange, type TimeRange } from '../src/charts/timeRange';

const LABELS: TimeRangePickerLabels = {
  placeholder: '选择时间范围',
  custom: '自定义',
  rangePlaceholder: '选择起止时间',
  step: '采样间隔',
  stepHint: '采样间隔会随范围自动调整。',
  stepOptions: [{ value: '60s', label: '1 分钟' }],
  cancel: '取消',
  confirm: '确定',
  invalid: '结束时间必须晚于开始时间。',
};

const PRESETS = [
  { key: '10m', ms: 600_000, label: '最近 10 分钟' },
  { key: '1h', ms: 3_600_000, label: '最近 1 小时' },
  { key: '1d', ms: 86_400_000, label: '最近 1 天' },
  { key: '7d', ms: 604_800_000, label: '最近 7 天' },
];

function mount(value: TimeRange = presetRange('1h'), onChange = vi.fn()) {
  const view = render(
    <TimeRangePicker value={value} onChange={onChange} presets={PRESETS} labels={LABELS} aiId="probe" />,
  );
  return { view, onChange };
}

/** Open the panel with a real pointer sequence: Radix listens on `pointerdown`. */
function openPanel(trigger: HTMLElement): void {
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
  fireEvent.pointerUp(trigger, { button: 0, pointerType: 'mouse' });
  fireEvent.click(trigger);
}

describe('TimeRangePicker', () => {
  it('shows the presets first, with no heading above them', () => {
    const { view } = mount();
    openPanel(view.getByRole('button', { name: '最近 1 小时' }));

    // Every preset is offered directly; the reader picks a period without first
    // reading a group title.
    for (const preset of PRESETS) {
      expect(view.getByRole('option', { name: preset.label })).toBeInTheDocument();
    }
    expect(view.queryByText('选择时间范围')).toBeNull();
  });

  it('marks the active preset and closes on pick', () => {
    const onChange = vi.fn();
    const { view } = mount(presetRange('1h'), onChange);
    openPanel(view.getByRole('button', { name: '最近 1 小时' }));

    expect(view.getByRole('option', { name: '最近 1 小时' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(view.getByRole('option', { name: '最近 1 天' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ kind: 'relative', ms: 86_400_000 }));
    // The panel is gone: a preset is a complete answer, there is nothing left to set.
    expect(view.queryByRole('option', { name: '最近 1 天' })).toBeNull();
  });

  it('keeps the custom range collapsed until asked for', () => {
    // A date field beside the presets pulls the eye away from the twelve periods,
    // and the calendar needs the full panel width once it opens.
    const { view } = mount();
    openPanel(view.getByRole('button', { name: '最近 1 小时' }));

    const toggle = view.getByRole('button', { name: /自定义/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // Collapsed means no calendar field is mounted at all, not merely hidden.
    // The popover portals into `document.body`, so the query is document-wide.
    expect(document.querySelector('[id="probe:range"]')).toBeNull();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    // The shared DatePicker renders its trigger with this id; its presence is what
    // "the custom section is open" means.
    expect(document.querySelector('[id="probe:range"]')).not.toBeNull();
  });

  it('opens the custom section when the current selection is a custom span', () => {
    // Otherwise the trigger reads "11-06 10:01 – 11-21 23:59" and the panel shows
    // neither that span nor which preset it replaced.
    const value: TimeRange = { kind: 'absolute', start: 1_700_000_000_000, end: 1_700_003_600_000 };
    const { view } = mount(value);
    openPanel(view.container.querySelector('[data-ai-id="probe"]') as HTMLElement);

    expect(view.getByRole('button', { name: /自定义/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('names the presets list separately from the custom control', () => {
    // A listbox announced as "自定义" reads as part of the control below it.
    const { view } = mount();
    openPanel(view.getByRole('button', { name: '最近 1 小时' }));
    const listbox = view.getByRole('listbox');
    expect(listbox.getAttribute('aria-label')).not.toBe('自定义');
  });
});
