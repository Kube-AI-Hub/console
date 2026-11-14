import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ResourceList } from '../src/schema/ResourceList';
import { StatisticsGroup, MetricCell } from '../src/primitives/Statistics';
import { Modal } from '../src/primitives/Feedback';

function Demo({ action = vi.fn() }: { action?: (key: string) => void }) {
  const [filters, setFilters] = React.useState<Record<string, string>>({});
  const [search, setSearch] = React.useState('');
  const [columns, setColumns] = React.useState(['name', 'value']);
  return <ResourceList schema={{
    rowKey: 'name', columns: [{ key: 'name', title: 'Name' }, { key: 'value', title: 'Value', hideable: true }],
    search: { placeholder: 'Name search', aiId: 'demo:search' },
    filters: [
      { key: 'vendor', title: 'Vendor', multiple: true, options: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }] },
      { key: 'model', title: 'Model', type: 'text' },
    ],
    columnVisibility: { label: 'Columns', resetLabel: 'Reset columns', aiId: 'demo:columns' },
    labels: { clearSearch: 'Clear search', clearFilter: (name) => `Clear ${name}`, clearFilters: 'Clear all' },
    rowActions: [{ key: 'open', label: 'Open', aiId: 'demo:open' }],
  }} rows={[{ name: 'node', value: '42' }]} filters={filters} onFiltersChange={setFilters}
    searchValue={search} onSearchChange={setSearch} visibleColumnKeys={columns} onVisibleColumnsChange={setColumns}
    onAction={(key) => action(key)} />;
}
describe('shared list capabilities', () => {
  it('selects multiple options and clears conditions without losing search focus', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    await user.click(screen.getByRole('button', { name: 'Vendor' }));
    await user.click(screen.getByRole('checkbox', { name: 'Alpha' }));
    await user.click(screen.getByRole('checkbox', { name: 'Beta' }));
    expect(screen.getByRole('checkbox', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('checkbox', { name: 'Beta' })).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('checkbox', { name: 'Alpha' })).toHaveFocus();
    await user.keyboard('{Escape}');
    await user.type(screen.getByRole('textbox', { name: 'Model' }), 'B200');
    await user.type(screen.getByRole('searchbox', { name: 'Name search' }), 'gpu');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByRole('searchbox', { name: 'Name search' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.getByRole('textbox', { name: 'Model' })).toHaveValue('');
  });
  it('hides optional columns, preserves locked columns, restores defaults and exposes row handles', async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    render(<Demo action={action} />);
    await user.click(screen.getByRole('button', { name: 'Columns' }));
    await user.click(screen.getByRole('menuitem', { name: 'Value' }));
    expect(screen.queryByRole('columnheader', { name: 'Value', hidden: true })).toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Name', hidden: true })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Reset columns' }));
    expect(screen.getByRole('columnheader', { name: 'Value', hidden: true })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: '更多操作' }));
    expect(document.querySelector('[data-ai-id="demo:open"]')).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Open' }));
    expect(action).toHaveBeenCalledWith('open');
  });
  it('distinguishes zero statistics from unknown and presents multiple metric facts', () => {
    render(<><StatisticsGroup unknownLabel="Unknown" items={[
      { key: 'zero', label: 'Zero', value: 0 }, { key: 'unknown', label: 'Unknown', value: 0, state: 'unknown' },
    ]} /><MetricCell value="0%" detail="0 / 8 cards" allocation="Allocated: 6 cards" /></>);
    expect(document.querySelector('[data-stat-key="zero"]')).toHaveTextContent('0');
    expect(document.querySelector('[data-stat-key="unknown"]')).toHaveTextContent('-');
    expect(screen.getByText('Allocated: 6 cards')).toBeInTheDocument();
  });
  it('blocks closing a submitting dialog while preserving the default behavior', async () => {
    const changed = vi.fn();
    const { rerender } = render(<Modal open title="Saving" closeLabel="Close" closeDisabled onOpenChange={changed}>Draft</Modal>);
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    expect(changed).not.toHaveBeenCalled();
    rerender(<Modal open title="Saving" closeLabel="Close" onOpenChange={changed}>Draft</Modal>);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(changed).toHaveBeenCalledWith(false);
  });
});
