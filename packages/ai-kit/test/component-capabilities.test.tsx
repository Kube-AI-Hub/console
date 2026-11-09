import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { Badge, Tag, Progress, resolveProgressTone } from '../src/primitives/Display';
import { RadioGroup, Slider, Switch } from '../src/primitives/Toggles';
import { Table, type TableColumn, type TableSortState } from '../src/primitives/Table';
import { Dropdown } from '../src/primitives/Navigation';
import { Tooltip } from '../src/primitives/Feedback';
import { Button } from '../src/primitives/Button';

/**
 * Capabilities added to close the gap with kube-design.
 *
 * These assert the behaviour the capability is for — a status dot plus label, a
 * clamped count, a threshold colour, a second thumb, an expandable row — rather
 * than the exact class names, so restyling does not break the suite.
 */

describe('Badge', () => {
  it('renders status text with a tone dot instead of a pill', () => {
    const { container } = render(<Badge text="运行中" tone="success" />);
    expect(screen.getByText('运行中')).toBeInTheDocument();
    // Status badges are plain text, so they must not pick up the pill padding.
    expect(container.firstElementChild?.className).not.toMatch(/rounded-ai-pill/);
  });

  it('clamps a count above max and keeps the real number in the title', () => {
    render(<Badge count={100} />);
    const node = screen.getByTitle('100');
    expect(node).toHaveTextContent('99+');
  });

  it('shows the exact count at and below max', () => {
    const { rerender } = render(<Badge count={99} />);
    expect(screen.getByText('99')).toBeInTheDocument();
    rerender(<Badge count={50} max={10} />);
    expect(screen.getByText('10+')).toBeInTheDocument();
  });
});

describe('Tag', () => {
  it('applies a tone class', () => {
    const { container } = render(<Tag tone="danger">critical</Tag>);
    expect(container.firstElementChild?.className).toMatch(/text-ai-danger/);
  });

  it('lets a custom colour override the tone', () => {
    const { container } = render(<Tag color="#8b5cf6">custom</Tag>);
    const node = container.firstElementChild as HTMLElement;
    expect(node.style.color).toBe('rgb(139, 92, 246)');
    expect(node.className).not.toMatch(/text-ai-/);
  });
});

describe('Progress thresholds', () => {
  it('resolves auto tone at the boundary, not only above it', () => {
    expect(resolveProgressTone(79)).toBe('accent');
    expect(resolveProgressTone(80)).toBe('warning');
    expect(resolveProgressTone(94)).toBe('warning');
    expect(resolveProgressTone(95)).toBe('danger');
    expect(resolveProgressTone(100)).toBe('danger');
  });

  it('honours custom thresholds', () => {
    expect(resolveProgressTone(50, [40, 60])).toBe('warning');
    expect(resolveProgressTone(60, [40, 60])).toBe('danger');
  });

  it('exposes the resolved tone on the bar for styling', () => {
    render(<Progress value={96} tone="auto" label="容量" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('data-tone', 'danger');
  });
});

describe('Switch text', () => {
  /** The label slot is the only span in flow; the rest are the thumb. */
  const labelSlot = (root: ParentNode) =>
    Array.from(root.querySelectorAll('span')).find(
      (el) => el.textContent && !el.className.includes('rounded-full'),
    );

  it('shows the inactive label with display, not opacity', () => {
    // A transparent element still painted on its own layer and left a clipped
    // glyph inside the track.
    const { container } = render(<Switch onText="ON" offText="OFF" aria-label="开关" />);
    const inner = Array.from(container.querySelectorAll('span')).filter((el) => el.textContent);
    expect(inner.length).toBeGreaterThan(0);
    for (const span of inner) expect(span.className).not.toMatch(/opacity-/);
  });

  it('marks the label decorative so the switch keeps its own name', () => {
    const { container } = render(<Switch onText="ON" offText="OFF" aria-label="开关" />);
    const slot = labelSlot(container);
    expect(slot).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('switch')).toHaveAccessibleName('开关');
  });

  it('widens the track when labels are present', () => {
    const { rerender } = render(<Switch aria-label="窄" />);
    const narrow = screen.getByRole('switch').className;
    rerender(<Switch onText="ON" offText="OFF" aria-label="宽" />);
    expect(screen.getByRole('switch').className).not.toBe(narrow);
  });
});

describe('RadioGroup button variant', () => {
  it('marks the selected option and switches on click', async () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroup
        variant="button"
        value="rolling"
        onValueChange={onValueChange}
        options={[
          { value: 'rolling', label: '滚动更新' },
          { value: 'recreate', label: '重建' },
        ]}
      />,
    );
    const selected = screen.getByRole('radio', { name: '滚动更新' });
    expect(selected).toHaveAttribute('data-state', 'checked');

    await userEvent.click(screen.getByRole('radio', { name: '重建' }));
    expect(onValueChange).toHaveBeenCalledWith('recreate');
  });

  it('keeps the plain variant rendering radio items', () => {
    render(<RadioGroup value="a" onValueChange={() => undefined} options={[{ value: 'a', label: 'A' }]} />);
    expect(screen.getByRole('radiogroup')).toHaveClass('gap-4');
  });

  it('disables an option without blocking the others', async () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroup
        variant="button"
        value="a"
        onValueChange={onValueChange}
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B', disabled: true },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole('radio', { name: 'B' }));
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe('Slider', () => {
  it('renders one thumb by default', () => {
    render(<Slider defaultValue={[40]} />);
    expect(screen.getAllByRole('slider')).toHaveLength(1);
  });

  it('renders two thumbs when range is set', () => {
    render(<Slider defaultValue={[20, 70]} range />);
    expect(screen.getAllByRole('slider')).toHaveLength(2);
  });

  it('keeps two thumbs even when both start at the same value', () => {
    // Length-based thumb counting would collapse this to one.
    render(<Slider defaultValue={[50, 50]} range />);
    expect(screen.getAllByRole('slider')).toHaveLength(2);
  });

  it('places mark labels by percentage of the range', () => {
    render(<Slider defaultValue={[0]} min={0} max={100} marks={{ 25: '25', 50: '50' }} />);
    const mark = screen.getByText('25') as HTMLElement;
    expect(mark.style.left).toBe('25%');
  });

  it('appends the unit to mark labels', () => {
    render(<Slider defaultValue={[0]} min={0} max={16} marks={{ 8: '8' }} unit=" Gi" />);
    expect(screen.getByText('8 Gi')).toBeInTheDocument();
  });
});

interface Row {
  name: string;
  cpu: number;
}

const ROWS: Row[] = [
  { name: 'gpu01', cpu: 62 },
  { name: 'gpu02', cpu: 91 },
];

const COLUMNS: Array<TableColumn<Row>> = [
  { key: 'name', title: '名称', sortable: true },
  { key: 'cpu', title: 'CPU', sortable: true },
];

describe('Table sorting', () => {
  it('cycles asc, desc then none and reports each step', async () => {
    const onSortChange = vi.fn();
    const { rerender } = render(
      <Table columns={COLUMNS} rows={ROWS} rowKey={(row) => row.name} onSortChange={onSortChange} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /名称/ }));
    expect(onSortChange).toHaveBeenLastCalledWith({ key: 'name', order: 'asc' });

    rerender(
      <Table
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.name}
        sorter={{ key: 'name', order: 'asc' }}
        onSortChange={onSortChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /名称/ }));
    expect(onSortChange).toHaveBeenLastCalledWith({ key: 'name', order: 'desc' });

    rerender(
      <Table
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.name}
        sorter={{ key: 'name', order: 'desc' }}
        onSortChange={onSortChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /名称/ }));
    expect(onSortChange).toHaveBeenLastCalledWith(undefined);
  });

  it('exposes aria-sort on the sorted column only', () => {
    render(
      <Table
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.name}
        sorter={{ key: 'cpu', order: 'desc' }}
        onSortChange={() => undefined}
      />,
    );
    const headers = screen.getAllByRole('columnheader');
    const cpuHeader = headers.find((header) => header.textContent?.includes('CPU'));
    const nameHeader = headers.find((header) => header.textContent?.includes('名称'));
    expect(cpuHeader).toHaveAttribute('aria-sort', 'descending');
    expect(nameHeader).toHaveAttribute('aria-sort', 'none');
  });
});

describe('Table row expansion', () => {
  const expanded = (row: Row): React.ReactNode => <div>详情:{row.name}</div>;

  it('toggles a detail row and reports state on the button', async () => {
    render(<Table columns={COLUMNS} rows={ROWS} rowKey={(row) => row.name} expandedRow={expanded} />);

    const [first] = screen.getAllByRole('button', { name: '展开' });
    expect(first).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('详情:gpu01')).not.toBeInTheDocument();

    await userEvent.click(first!);
    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('详情:gpu01')).toBeInTheDocument();
  });

  it('spans the expanded row across every column', async () => {
    render(
      <Table
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.name}
        selection={{ selectedKeys: [], onChange: () => undefined }}
        expandedRow={expanded}
      />,
    );
    await userEvent.click(screen.getAllByRole('button', { name: '展开' })[0]!);
    const cell = screen.getByText('详情:gpu01').closest('td');
    // Two data columns plus the disclosure and selection columns.
    expect(cell).toHaveAttribute('colspan', '4');
  });

  it('reserves the heading column so header and body line up', () => {
    render(<Table columns={COLUMNS} rows={ROWS} rowKey={(row) => row.name} expandedRow={expanded} />);
    const headerRow = screen.getAllByRole('row')[0]!;
    expect(within(headerRow).getAllByRole('columnheader')).toHaveLength(3);
  });
});

describe('Dropdown control', () => {
  it('opens when the host says so', () => {
    const { rerender } = render(
      <Dropdown open={false} onOpenChange={() => undefined} trigger={<Button>菜单</Button>} items={[{ key: 'a', label: '第一项' }]} />,
    );
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();

    rerender(
      <Dropdown open onOpenChange={() => undefined} trigger={<Button>菜单</Button>} items={[{ key: 'a', label: '第一项' }]} />,
    );
    expect(screen.getByRole('menuitem', { name: '第一项' })).toBeInTheDocument();
  });

  it('stays open after a selection when closeOnSelect is false', async () => {
    const onSelect = vi.fn();
    const handleOpenChange = vi.fn();
    render(
      <Dropdown
        open
        onOpenChange={handleOpenChange}
        closeOnSelect={false}
        trigger={<Button>菜单</Button>}
        items={[{ key: 'a', label: '第一项', onSelect }]}
      />,
    );
    await userEvent.click(screen.getByRole('menuitem', { name: '第一项' }));
    expect(onSelect).toHaveBeenCalled();
    expect(handleOpenChange).not.toHaveBeenCalledWith(false);
  });
});

describe('Tooltip trigger', () => {
  it('keeps hover tooltips out of the DOM until focused', async () => {
    render(
      <Tooltip content="悬停提示">
        <Button>触发器</Button>
      </Tooltip>,
    );
    expect(screen.queryByText('悬停提示')).not.toBeInTheDocument();
    await userEvent.tab();
    expect(await screen.findByText('悬停提示')).toBeInTheDocument();
  });

  it('opens a click tooltip on click rather than on focus', async () => {
    render(
      <Tooltip content="点击提示" trigger="click">
        <Button>点击触发器</Button>
      </Tooltip>,
    );
    await userEvent.click(screen.getByRole('button', { name: '点击触发器' }));
    expect(await screen.findByText('点击提示')).toBeInTheDocument();
  });
});

describe('Table sort state type', () => {
  it('accepts a widened sort state', () => {
    const state: TableSortState = { key: 'cpu', order: 'asc' };
    expect(state.order).toBe('asc');
  });
});
