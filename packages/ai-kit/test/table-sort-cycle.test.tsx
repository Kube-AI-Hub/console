import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Table } from '../src/primitives/Table';

/**
 * The header sort cycle must never ask for the state it is already in.
 *
 * `Table` cycles ascending → descending → `sortFallback`. When a host's default is
 * already `{ key: 'name', order: 'desc' }`, the third step asked for `desc` again:
 * same value, no re-render, no request, and the header read as a dead control. The
 * node list hit exactly that — its default order was `desc` while the cycle expects
 * to start at ascending.
 *
 * These pin the cycle itself, so a host that picks an unusual default still gets a
 * control that visibly responds on every click.
 */
const columns = [{ key: 'name', title: '名称', sortable: true }];
const rows = [{ id: '1', name: 'a' }, { id: '2', name: 'b' }];

function mountCycle(props: {
  order: 'asc' | 'desc';
  fallback?: { key: string; order: 'asc' | 'desc' };
  onSortChange: (next: { key: string; order: 'asc' | 'desc' }) => void;
}) {
  return render(
    <Table
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      sorter={{ key: 'name', order: props.order }}
      {...(props.fallback ? { sortFallback: props.fallback } : {})}
      onSortChange={props.onSortChange}
    />,
  );
}

describe('Table sort cycle', () => {
  it('advances ascending → descending → fallback', async () => {
    const calls: Array<{ key: string; order: string }> = [];
    mountCycle({ order: 'asc', fallback: { key: 'name', order: 'asc' }, onSortChange: (next) => calls.push(next) });

    const header = screen.getByRole('button', { name: '名称' });
    await userEvent.click(header);
    expect(calls.at(-1)).toEqual({ key: 'name', order: 'desc' });
  });

  it('never asks for the state it is already in when the fallback matches', async () => {
    // The bug: default `desc` plus a `desc` fallback made the first click a no-op.
    const calls: Array<{ key: string; order: string }> = [];
    mountCycle({ order: 'desc', fallback: { key: 'name', order: 'desc' }, onSortChange: (next) => calls.push(next) });

    await userEvent.click(screen.getByRole('button', { name: '名称' }));
    expect(calls.at(-1)).toEqual({ key: 'name', order: 'asc' });
  });

  it('still returns the fallback when it is a different state', async () => {
    // `desc` on the column, `asc` fallback: the third step is meaningful and must
    // not be swallowed by the guard above.
    const calls: Array<{ key: string; order: string }> = [];
    mountCycle({ order: 'desc', fallback: { key: 'name', order: 'asc' }, onSortChange: (next) => calls.push(next) });

    await userEvent.click(screen.getByRole('button', { name: '名称' }));
    expect(calls.at(-1)).toEqual({ key: 'name', order: 'asc' });
  });

  it('starts an inactive column ascending', async () => {
    const calls: Array<{ key: string; order: string }> = [];
    render(
      <Table
        columns={[{ key: 'name', title: '名称', sortable: true }, { key: 'age', title: '年龄', sortable: true }]}
        rows={rows}
        rowKey={(row) => row.id}
        sorter={{ key: 'name', order: 'desc' }}
        sortFallback={{ key: 'name', order: 'asc' }}
        onSortChange={(next) => calls.push(next)}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: '年龄' }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ key: 'age', order: 'asc' }));
  });
});
