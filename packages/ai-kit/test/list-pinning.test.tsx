import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ResourceList } from '../src/schema/ResourceList';

/**
 * Pinned columns and column hints.
 *
 * A pinned column is a layout behaviour, and jsdom has no layout — so these assert the
 * classes that make the behaviour, not the visual result. The classes are the contract:
 * `sticky` without an offset pins to nothing, an offset without an opaque background
 * lets the scrolled columns show through, and `border-collapse` means the seam has to
 * be a shadow rather than a border.
 *
 * The other half is what must NOT happen: a pinned column cannot be hidden, a second
 * pin on the same side is ignored, and a hint must not fire the column's sort.
 */

type Row = { name: string; value: string };

function mount(schema: Parameters<typeof ResourceList<Row>>[0]['schema'], props: Record<string, unknown> = {}) {
  return render(
    <ResourceList<Row> schema={schema} rows={[{ name: 'a', value: '1' }]} {...props} />,
  );
}

/** The header cell for a column, by its visible title. */
const header = (title: string) => screen.getByRole('columnheader', { name: new RegExp(title) });

describe('pinned columns', () => {
  it('pins a start column to the left with an opaque background', () => {
    mount({
      rowKey: 'name',
      columns: [
        { key: 'name', title: 'Name', width: 170, pin: 'start' },
        { key: 'value', title: 'Value', width: 100 },
      ],
    });

    const th = header('Name');
    expect(th.className).toContain('sticky');
    expect(th.className).toContain('left-0');
    // Without a background the scrolled columns paint through the pinned cell.
    expect(th.className).toContain('bg-ai-th-bg');

    const cell = screen.getByText('a').closest('td')!;
    expect(cell.className).toContain('sticky');
    expect(cell.className).toContain('left-0');
    // The body cell paints the start-pin surface, not a generic one: the three-step
    // weight scale is what makes the identity column read as the anchor.
    expect(cell.className).toContain('bg-ai-pin-start');
  });

  it('pins row actions to the right edge automatically', () => {
    // The actions column is generated, not declared: a reader who has scrolled past
    // the metrics must still be able to act on the row.
    mount({
      rowKey: 'name',
      columns: [{ key: 'name', title: 'Name', width: 170 }],
      rowActions: [{ key: 'delete', label: 'Delete', aiId: 'demo:delete' }],
      labels: { moreActions: 'More' },
    });

    const headers = screen.getAllByRole('columnheader');
    const actions = headers[headers.length - 1]!;
    expect(actions.className).toContain('sticky');
    expect(actions.className).toContain('right-0');
  });

  it('leaves a table with no pins exactly as it was', () => {
    // 73 call sites do not pin anything; their DOM must not change.
    mount({
      rowKey: 'name',
      columns: [
        { key: 'name', title: 'Name', width: 170 },
        { key: 'value', title: 'Value', width: 100 },
      ],
    });

    for (const th of screen.getAllByRole('columnheader')) {
      expect(th.className).not.toContain('sticky');
    }
    expect(screen.getByText('a').closest('td')!.className).not.toContain('sticky');
  });

  it('ignores a second pin on the same side', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mount({
      rowKey: 'name',
      columns: [
        { key: 'name', title: 'Name', width: 170, pin: 'start' },
        { key: 'value', title: 'Value', width: 100, pin: 'start' },
      ],
    });

    // Offsets are not accumulated, so a second left pin would sit on top of the
    // first. The first wins and the reader is told why.
    expect(header('Name').className).toContain('left-0');
    expect(header('Value').className).not.toContain('sticky');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('only the first start'));
    warn.mockRestore();
  });

  it('drops a pin when the column has no width', () => {
    // A pinned column whose width follows its content shifts while scrolling, which
    // reads as a rendering fault rather than as a feature.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mount({
      rowKey: 'name',
      columns: [
        { key: 'name', title: 'Name', pin: 'start' },
        { key: 'value', title: 'Value', width: 100 },
      ],
    });

    expect(header('Name').className).not.toContain('sticky');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('without a width'));
    warn.mockRestore();
  });

  it('keeps a pinned column even when visibleColumnKeys omits it', async () => {
    // The chooser never offers a pinned column, but a key list saved before the pin
    // existed would exclude it. Losing the anchor is worse than ignoring stale state.
    const onVisibleColumnsChange = vi.fn();
    mount({
      rowKey: 'name',
      columns: [
        { key: 'name', title: 'Name', width: 170, pin: 'start' },
        { key: 'value', title: 'Value', width: 100, hideable: true },
      ],
      columnVisibility: { label: 'Columns', resetLabel: 'Reset' },
    }, { visibleColumnKeys: ['value'], onVisibleColumnsChange });

    expect(screen.getByRole('columnheader', { name: /Name/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Value/ })).toBeInTheDocument();
  });

  it('does not offer a pinned column in the chooser', async () => {
    const user = userEvent.setup();
    mount({
      rowKey: 'name',
      columns: [
        { key: 'name', title: 'Name', width: 170, pin: 'start' },
        { key: 'value', title: 'Value', width: 100, hideable: true },
      ],
      columnVisibility: { label: 'Columns', resetLabel: 'Reset' },
    }, { visibleColumnKeys: ['name', 'value'], onVisibleColumnsChange: vi.fn() });

    await user.click(screen.getByRole('button', { name: 'Columns' }));
    // The chooser lists hideable columns only; the pinned one is not offered, so the
    // reader cannot remove the anchor they scroll back to.
    const items = screen.getAllByRole('menuitem').map((item) => item.textContent);
    expect(items).toContain('Value');
    expect(items).not.toContain('Name');
  });

  it('opens the chooser from an icon trigger, and hints on hover', async () => {
    /*
     * The trigger is an icon button, so its label is only in `aria-label` and the
     * tooltip. Both have to survive the menu being attached to the same element:
     * Radix merges a trigger's handlers into its child, so a tooltip built as a
     * second Radix tree on the same button overwrote the menu's click handler and
     * the menu stopped opening at all. That is why the hint is driven by local
     * state rather than a nested `Tooltip.Trigger`.
     */
    const user = userEvent.setup();
    mount({
      rowKey: 'name',
      columns: [
        { key: 'name', title: 'Name', width: 170 },
        { key: 'value', title: 'Value', width: 100, hideable: true },
      ],
      columnVisibility: { label: 'Columns', resetLabel: 'Reset' },
    }, { visibleColumnKeys: ['name', 'value'], onVisibleColumnsChange: vi.fn() });

    const trigger = screen.getByRole('button', { name: 'Columns' });
    // No visible label: the accessible name comes from `aria-label`, and the only
    // child is the icon.
    expect(trigger.querySelector('svg')).not.toBeNull();
    expect(trigger.textContent?.trim()).toBe('');

    await user.hover(trigger);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Columns');

    // The menu still opens — the regression this guards against.
    await user.click(trigger);
    expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(0);
  });
});

describe('column hints', () => {
  it('renders an info control beside the title', () => {
    mount({
      rowKey: 'name',
      columns: [{ key: 'name', title: 'Name', width: 170, hint: 'Measured on the card' }],
    });

    // Reachable by keyboard and screen reader, not just hover.
    const info = screen.getByRole('button', { name: 'Measured on the card' });
    expect(info).toBeInTheDocument();
  });

  it('does not trigger the sort when the hint is pressed', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    mount({
      rowKey: 'name',
      columns: [{ key: 'name', title: 'Name', width: 170, sortable: true, hint: 'Unit: cores' }],
      sortableKeys: ['name'],
    }, { onSortChange, sort: undefined });

    await user.click(screen.getByRole('button', { name: 'Unit: cores' }));
    expect(onSortChange).not.toHaveBeenCalled();

    // The sort control itself still works.
    await user.click(screen.getByRole('button', { name: /Name/ }));
    expect(onSortChange).toHaveBeenCalled();
  });

  it('renders no info control when there is no hint', () => {
    mount({
      rowKey: 'name',
      columns: [{ key: 'name', title: 'Name', width: 170 }],
    });

    expect(screen.queryByRole('button', { name: /Unit/ })).toBeNull();
  });
});

/**
 * Column filters.
 *
 * A filter that lives on its column opens the choices directly — the panel is the
 * place the reader asked for, so a nested select would cost a second click. A
 * single-select then closes on choice: one value is the whole answer, and leaving the
 * panel open makes the reader dismiss it to see the result.
 */
describe('column filters', () => {
  const schema = {
    rowKey: 'name',
    columns: [
      { key: 'name', title: 'Name', width: 170 },
      { key: 'vendor', title: 'Vendor', width: 120 },
      { key: 'tags', title: 'Tags', width: 120 },
    ],
    filters: [
      { key: 'vendor', column: 'vendor', title: 'Vendor', allLabel: 'All vendors',
        options: [{ value: 'nvidia', label: 'NVIDIA' }, { value: 'cpu', label: 'CPU' }] },
      { key: 'tags', column: 'tags', title: 'Tags', multiple: true,
        options: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }] },
    ],
  } as const;

  it('shows the options on the first click', async () => {
    const user = userEvent.setup();
    mount(schema, { filters: {}, onFiltersChange: vi.fn() });

    await user.click(screen.getByRole('button', { name: 'Vendor' }));

    // No second click: the list is in the panel the reader just opened.
    expect(screen.getByRole('option', { name: 'NVIDIA' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'All vendors' })).toHaveAttribute('aria-selected', 'true');
  });

  it('closes a single-select filter once a value is chosen', async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    mount(schema, { filters: {}, onFiltersChange });

    await user.click(screen.getByRole('button', { name: 'Vendor' }));
    await user.click(screen.getByRole('option', { name: 'NVIDIA' }));

    expect(onFiltersChange).toHaveBeenCalledWith({ vendor: 'nvidia' });
    // The panel is gone; the reader can see the result of their click.
    expect(screen.queryByRole('option', { name: 'NVIDIA' })).toBeNull();
  });

  it('keeps a multi-select filter open across several choices', async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    mount(schema, { filters: {}, onFiltersChange });

    await user.click(screen.getByRole('button', { name: 'Tags' }));
    await user.click(screen.getByRole('checkbox', { name: 'Alpha' }));

    // Choosing three vendors is one visit, not three.
    expect(screen.getByRole('checkbox', { name: 'Beta' })).toBeInTheDocument();
  });
});
