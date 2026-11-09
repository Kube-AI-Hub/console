import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { InputPassword, InputSearch } from '../src/primitives/Input';
import { CheckboxGroup, RadioGroup, Radio, Switch } from '../src/primitives/Toggles';
import { Select } from '../src/primitives/Select';
import { Menu } from '../src/primitives/Menu';
import { DatePicker } from '../src/primitives/DatePicker';

/**
 * The kube-design parity gaps and the storybook-reported bugs from this round.
 *
 * Each test names the behaviour that was missing or broken, so a regression
 * reads as "the feature went away" rather than "a class name changed".
 */

describe('InputPassword', () => {
  it('masks by default and reveals on the eye button', async () => {
    const { container } = render(<InputPassword defaultValue="hunter2" aria-label="密码" />);
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('password');

    await userEvent.click(screen.getByRole('button', { name: '显示密码' }));
    expect(input.type).toBe('text');

    await userEvent.click(screen.getByRole('button', { name: '隐藏密码' }));
    expect(input.type).toBe('password');
  });

  it('announces the toggle state to assistive tech', async () => {
    render(<InputPassword defaultValue="x" aria-label="密码" />);
    const toggle = screen.getByRole('button', { name: '显示密码' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: '隐藏密码' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('supports starting visible', () => {
    const { container } = render(<InputPassword defaultValue="x" defaultVisible aria-label="密码" />);
    expect((container.querySelector('input') as HTMLInputElement).type).toBe('text');
  });
});

describe('InputSearch', () => {
  it('commits the query on the button, not on every keystroke', async () => {
    const onSearch = vi.fn();
    const onChange = vi.fn();
    render(<InputSearch value="" onChange={onChange} onSearch={onSearch} aria-label="搜索" />);

    await userEvent.type(screen.getByLabelText('搜索'), 'api');
    expect(onChange).toHaveBeenCalled();
    expect(onSearch).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: '搜索' }));
    expect(onSearch).toHaveBeenCalledWith('');
  });

  it('commits on Enter', async () => {
    const onSearch = vi.fn();
    function Harness(): React.ReactElement {
      const [value, setValue] = React.useState('');
      return <InputSearch value={value} onChange={setValue} onSearch={onSearch} aria-label="搜索" />;
    }
    render(<Harness />);
    const input = screen.getByLabelText('搜索');
    await userEvent.type(input, 'nginx{Enter}');
    expect(onSearch).toHaveBeenCalledWith('nginx');
  });

  it('hides the button when asked', () => {
    render(<InputSearch hideButton onSearch={() => undefined} aria-label="搜索" />);
    expect(screen.queryByRole('button', { name: '搜索' })).not.toBeInTheDocument();
  });
});

describe('CheckboxGroup', () => {
  const OPTIONS = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
    { value: 'c', label: 'C', disabled: true },
  ];

  it('renders one checkbox per option plus the select-all parent', () => {
    render(<CheckboxGroup options={OPTIONS} withSelectAll aria-label="组" />);
    expect(screen.getByRole('group')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
  });

  it('marks the parent indeterminate when only some children are selected', () => {
    render(<CheckboxGroup options={OPTIONS} value={['a']} withSelectAll aria-label="组" />);
    expect(screen.getByRole('checkbox', { name: '全选' })).toHaveAttribute('data-state', 'indeterminate');
  });

  it('select-all only touches selectable options', async () => {
    const onChange = vi.fn();
    render(<CheckboxGroup options={OPTIONS} value={[]} onChange={onChange} withSelectAll aria-label="组" />);
    await userEvent.click(screen.getByRole('checkbox', { name: '全选' }));
    // C is disabled, so only A and B are added.
    expect(onChange).toHaveBeenCalledWith(['a', 'b']);
  });

  it('does not offer a disabled option', async () => {
    const onChange = vi.fn();
    render(<CheckboxGroup options={OPTIONS} value={[]} onChange={onChange} aria-label="组" />);
    const disabled = screen.getByRole('checkbox', { name: 'C' });
    expect(disabled).toBeDisabled();
    await userEvent.click(disabled);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Radio inside a custom layout', () => {
  it('has a non-zero hit area so it can be seen and clicked', () => {
    // The bug: a raw RadioGroup.Item has no intrinsic size, so the dot rendered
    // as a zero-width element and the option could not be picked.
    const { container } = render(
      <RadioGroup defaultValue="a" options={undefined} aria-label="选择">
        <Radio value="a" aria-label="A" />
        <Radio value="b" aria-label="B" />
      </RadioGroup>,
    );
    const radio = container.querySelector('[role=radio]') as HTMLElement;
    expect(radio.className).toMatch(/size-4/);
  });

  it('selects when the radio itself is clicked', async () => {
    render(
      <RadioGroup defaultValue="a" options={undefined} aria-label="选择">
        <Radio value="a" aria-label="A" />
        <Radio value="b" aria-label="B" />
      </RadioGroup>,
    );
    const b = screen.getByRole('radio', { name: 'B' });
    await userEvent.click(b);
    await waitFor(() => expect(b).toHaveAttribute('data-state', 'checked'));
  });
});

describe('Switch labels', () => {
  it('hides the inactive label with display, not opacity', () => {
    // The label on the free side is the only one rendered; neither may rely on
    // opacity, which left a clipped glyph painted inside the track.
    const { container } = render(<Switch onText="ON" offText="OFF" aria-label="开关" />);
    const spans = Array.from(container.querySelectorAll('span'));
    expect(spans.some((el) => el.textContent === 'ON')).toBe(true);
    expect(spans.some((el) => el.textContent === 'OFF')).toBe(true);
    for (const span of spans) expect(span.className).not.toMatch(/opacity-/);
  });

  it('lets the track grow with the label text', () => {
    const { container: plain } = render(<Switch aria-label="无文字" />);
    const { container: labelled } = render(<Switch onText="开关" offText="停用" aria-label="有文字" />);
    const plainRoot = plain.querySelector('[role=switch]') as HTMLElement;
    const labelledRoot = labelled.querySelector('[role=switch]') as HTMLElement;
    expect(plainRoot.className).toMatch(/\bw-9\b/);
    // No fixed pixel width; the track sizes to its content.
    expect(labelledRoot.className).not.toMatch(/\bw-9\b/);
  });

  it('anchors the thumb to opposite sides instead of translating by pixels', () => {
    // The reported bug: the thumb stayed on the left when checked and covered the
    // label, because its position was expressed as a translate whose distance
    // assumed a fixed track width.
    const { container } = render(<Switch onText="ON" offText="OFF" aria-label="开关" />);
    const thumb = Array.from(container.querySelectorAll('span')).find((el) =>
      el.className.includes('rounded-full') && el.className.includes('absolute'),
    );
    expect(thumb?.className).toMatch(/left-0\.5/);
    expect(thumb?.className).toMatch(/group-data-\[state=checked\]:right-0\.5/);
    expect(thumb?.className).not.toMatch(/translate-x-\[calc/);
  });

  it('reserves horizontal padding so the label never sits under the thumb', () => {
    const { container } = render(<Switch onText="开" offText="关" aria-label="开关" />);
    const root = container.querySelector('[role=switch]') as HTMLElement;
    expect(root.className).toMatch(/px-5/);
  });

  it('centres the thumb vertically inside the border-box track', () => {
    // The reported bug: `top-0.5` measured from the padding box while the track
    // had a 2px border, so the thumb sat 2px low.
    const { container } = render(<Switch aria-label="普通" />);
    const thumb = Array.from(container.querySelectorAll('span')).find((el) =>
      el.className.includes('rounded-full'),
    );
    expect(thumb?.className).toMatch(/inset-y-0/);
    expect(thumb?.className).toMatch(/my-auto/);
    expect(thumb?.className).not.toMatch(/\btop-0\.5\b/);
  });

  it('insets the thumb equally on both sides in each state', () => {
    // The reported bug: the horizontal position used a pixel translate sized to
    // the thumb, so the checked thumb ended flush against the right border.
    const { container } = render(<Switch aria-label="普通" />);
    const thumb = Array.from(container.querySelectorAll('span')).find((el) =>
      el.className.includes('rounded-full'),
    );
    expect(thumb?.className).toMatch(/left-0\.5/);
    expect(thumb?.className).toMatch(/group-data-\[state=checked\]:right-0\.5/);
    expect(thumb?.className).not.toMatch(/translate-x-4/);
  });
});

describe('Select searchable', () => {
  const OPTIONS = [
    { value: 'default', label: 'default' },
    { value: 'kube-system', label: 'kube-system' },
    { value: 'monitoring', label: 'monitoring' },
  ];

  it('accepts typed input and filters the list', async () => {
    const onValueChange = vi.fn();
    render(<Select searchable options={OPTIONS} onValueChange={onValueChange} aria-label="命名空间" />);
    const input = screen.getByRole('combobox');

    expect(input.tagName).toBe('INPUT');
    await userEvent.click(input);
    await userEvent.type(input, 'kube');

    expect(await screen.findByRole('option', { name: 'kube-system' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'monitoring' })).not.toBeInTheDocument();
  });

  it('commits the chosen option', async () => {
    const onValueChange = vi.fn();
    render(<Select searchable options={OPTIONS} onValueChange={onValueChange} aria-label="命名空间" />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: 'monitoring' }));
    expect(onValueChange).toHaveBeenCalledWith('monitoring');
  });

  it('shows the empty text when nothing matches', async () => {
    render(<Select searchable options={OPTIONS} emptyText="无匹配项" aria-label="命名空间" />);
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    await userEvent.type(input, 'zzz');
    expect(await screen.findByText('无匹配项')).toBeInTheDocument();
  });

  it('still renders a native-style trigger when not searchable', () => {
    render(<Select options={OPTIONS} aria-label="命名空间" />);
    expect(screen.getByRole('combobox').tagName).toBe('BUTTON');
  });
});

describe('Menu alignment', () => {
  it('indents nested items by exactly one level each time', () => {
    const { container } = render(
      <Menu
        aria-label="导航"
        defaultOpenKeys={['group']}
        items={[
          {
            key: 'group',
            label: '分组',
            children: [
              { key: 'leaf', label: '子项' },
              { key: 'deep', label: '深层', children: [{ key: 'deeper', label: '更深' }] },
            ],
          },
        ]}
      />,
    );
    const leaf = Array.from(container.querySelectorAll('a, button')).find((el) => el.textContent === '子项') as HTMLElement;
    // Depth 1: base 8px + 1 * 16px. Previously `px-2` also applied, so the real
    // offset was 24 while the next level assumed 16, and levels drifted apart.
    expect(leaf.style.paddingLeft).toBe('24px');
  });

  it('uses a readable size for CJK labels', () => {
    const { container } = render(<Menu aria-label="导航" items={[{ key: 'a', label: '工作负载' }]} />);
    const item = container.querySelector('button') as HTMLElement;
    expect(item.className).toMatch(/text-\[13px\]/);
    expect(item.className).not.toMatch(/\btext-xs\b/);
  });
});

describe('DatePicker navigation and ranges', () => {
  /** Opens the panel from the trigger button. */
  async function open(): Promise<void> {
    await userEvent.click(screen.getByRole('button', { name: /选择日|\d{4}-\d{2}-\d{2}/ }));
  }

  it('switches to a month grid and then a year grid', async () => {
    render(<DatePicker value="2026-11-10" onChange={() => undefined} id="nav" />);
    await open();

    await userEvent.click(screen.getByRole('button', { name: /^切换月份或年份/ }));
    expect(screen.getByRole('button', { name: '3 月' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^切换年份（/ }));
    expect(screen.getByRole('button', { name: '2024' })).toBeInTheDocument();
  });

  it('jumps to a chosen month of a chosen year', async () => {
    const onChange = vi.fn();
    render(<DatePicker value="2026-11-10" onChange={onChange} id="jump" />);
    await open();

    await userEvent.click(screen.getByRole('button', { name: /^切换月份或年份/ }));
    await userEvent.click(screen.getByRole('button', { name: /^切换年份（/ }));
    await userEvent.click(screen.getByRole('button', { name: '2024' }));
    await userEvent.click(screen.getByRole('button', { name: '3 月' }));

    // Back on the day grid, showing the picked month.
    expect(screen.getByRole('button', { name: /^切换月份或年份/ })).toHaveTextContent('2024 年 3 月');
  });

  it('gives each range panel its own calendar', async () => {
    render(<DatePicker value="" onChange={() => undefined} range id="two" />);
    await open();

    // Each side has its own navigation, so the two ends can be in different
    // months and different years.
    const startHeader = screen.getByRole('button', { name: '切换月份或年份（开始日历）' });
    const endHeader = screen.getByRole('button', { name: '切换月份或年份（结束日历）' });
    expect(startHeader).toBeInTheDocument();
    expect(endHeader).toBeInTheDocument();

    // Paging the end panel must not move the start panel.
    const startBefore = startHeader.textContent;
    await userEvent.click(screen.getByRole('button', { name: /^下个月（结束日历）/ }));
    expect(startHeader.textContent).toBe(startBefore);
    expect(endHeader.textContent).not.toBe(startBefore);
  });

  it('lets the two ends land in different years', async () => {
    render(<DatePicker value="2026-11-10,2029-06-15" onChange={() => undefined} range id="cross" />);
    await open();

    expect(screen.getByRole('button', { name: '切换月份或年份（开始日历）' })).toHaveTextContent('2026 年 11 月');
    expect(screen.getByRole('button', { name: '切换月份或年份（结束日历）' })).toHaveTextContent('2029 年 6 月');
  });

  it('keeps the end panel where the user left it after picking a start', async () => {
    function Harness(): React.ReactElement {
      const [value, setValue] = React.useState('');
      return <DatePicker value={value} onChange={setValue} range id="keep" />;
    }
    render(<Harness />);
    await open();

    // Page the end panel forward, then pick the start.
    await userEvent.click(screen.getByRole('button', { name: /^下个月（结束日历）/ }));
    const endAfterJump = screen.getByRole('button', { name: '切换月份或年份（结束日历）' }).textContent;

    const startDay = screen.getAllByRole('button').filter((el) => el.textContent === '15')[0]!;
    await userEvent.click(startDay);

    // Picking a start rewrites the controlled value; that must not reset the
    // end panel the user had just navigated to.
    expect(screen.getByRole('button', { name: '切换月份或年份（结束日历）' }).textContent).toBe(endAfterJump);
  });

  it('selects a range that spans two months', async () => {
    function Harness(): React.ReactElement {
      const [value, setValue] = React.useState('');
      return (
        <>
          <DatePicker value={value} onChange={setValue} range id="span" />
          <output data-testid="out">{value}</output>
        </>
      );
    }
    render(<Harness />);
    await open();

    // First panel: the 20th. Second panel: the 10th of the following month.
    const grids = screen
      .getAllByRole('button')
      .filter((el) => /^\d+$/.test(el.textContent ?? ''));
    const leftGrid = grids.filter((el) => el.textContent === '20')[0]!;
    await userEvent.click(leftGrid);

    const afterStart = screen.getByTestId('out').textContent ?? '';
    // A half-finished range writes only the start.
    expect(afterStart).toMatch(/^\d{4}-\d{2}-20$/);

    const rightGrid = screen.getAllByRole('button').filter((el) => el.textContent === '10');
    await userEvent.click(rightGrid[rightGrid.length - 1]!);

    const out = screen.getByTestId('out').textContent ?? '';
    expect(out).toMatch(/^\d{4}-\d{2}-20,\d{4}-\d{2}-10$/);
    const [start, end] = out.split(',');
    expect(start! < end!).toBe(true);
  });

  it('keeps separate start and end times', async () => {
    const onChange = vi.fn();
    render(
      <DatePicker
        value="2026-11-01 00:00,2026-11-10 23:59"
        onChange={onChange}
        range
        withTime
        id="times"
      />,
    );
    await open();

    const start = screen.getByLabelText('开始时间');
    const end = screen.getByLabelText('结束时间');
    expect(start).toHaveValue('00:00');
    expect(end).toHaveValue('23:59');

    fireEvent.change(start, { target: { value: '08:30' } });
    expect(onChange).toHaveBeenLastCalledWith('2026-11-01 08:30,2026-11-10 23:59');

    fireEvent.change(end, { target: { value: '18:45' } });
    expect(onChange).toHaveBeenLastCalledWith('2026-11-01 08:30,2026-11-10 18:45');
  });

  it('omits the end time input when not in range mode', async () => {
    render(<DatePicker value="2026-11-10 09:00" onChange={() => undefined} withTime id="single" />);
    await open();

    expect(screen.getByLabelText('时间')).toBeInTheDocument();
    expect(screen.queryByLabelText('结束时间')).not.toBeInTheDocument();
  });
});
