import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatisticsGroup } from '../src/primitives/Statistics';

/**
 * Grouped statistics.
 *
 * The node page groups its vendor tiles so "how many of each accelerator" reads as a
 * different question from "how many nodes, and are they well". The grouping is
 * deliberately structural — a wrapper plus a rule — because a visible heading cost
 * ~100px and pushed the vendor run onto a second line at real widths.
 *
 * These pin the two things that would silently regress: consecutive grouping, and
 * that an ungrouped caller still gets a flat row.
 */
const items = (spec: Array<{ key: string; group?: string; groupLabel?: string }>) =>
  spec.map((entry) => ({ key: entry.key, label: entry.key, value: 1, ...entry }));

describe('StatisticsGroup grouping', () => {
  it('renders a flat row when no item declares a group', () => {
    const { container } = render(
      <StatisticsGroup unknownLabel="-" items={items([{ key: 'a' }, { key: 'b' }])} />,
    );
    // Two tiles, no wrapper between them: the DOM the other call sites already have.
    expect(container.querySelectorAll('[data-stat-group]')).toHaveLength(0);
    const dl = container.querySelector('dl')!;
    // Direct children only: a read-only tile carries `data-stat-key` on its `<dd>`
    // too, which is the markup it has always had.
    expect([...dl.children].every((child) => child.getAttribute('data-stat-key') !== null)).toBe(true);
    expect(dl.children).toHaveLength(2);
  });

  it('wraps consecutive items that share a group, and keeps the order', () => {
    const { container } = render(
      <StatisticsGroup unknownLabel="-" items={items([
        { key: 'total' },
        { key: 'nvidia', group: 'vendors', groupLabel: '按算力卡类型' },
        { key: 'ascend', group: 'vendors', groupLabel: '按算力卡类型' },
      ])} />,
    );
    const groups = container.querySelectorAll('[data-stat-group]');
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveAttribute('data-stat-group', 'vendors');
    // Direct children again, so the `<dd>` inside each read-only tile is not counted.
    expect([...groups[0]!.children].map((node) => node.getAttribute('data-stat-key')))
      .toEqual(['nvidia', 'ascend']);
    // The label is the group's accessible name, not visible text.
    expect(groups[0]).toHaveAttribute('aria-label', '按算力卡类型');
    expect(groups[0]!.textContent).not.toContain('按算力卡类型');
  });

  it('splits non-adjacent items into separate runs', () => {
    // Consecutive, not "collect every item with this group": merging across an
    // ungrouped tile would move it away from where the caller put it.
    const { container } = render(
      <StatisticsGroup unknownLabel="-" items={items([
        { key: 'nvidia', group: 'vendors', groupLabel: 'V' },
        { key: 'total' },
        { key: 'ascend', group: 'vendors', groupLabel: 'V' },
      ])} />,
    );
    expect(container.querySelectorAll('[data-stat-group]')).toHaveLength(2);
  });

  it('draws no rule before the first run', () => {
    // A leading group has nothing to its left; a border there reads as a stray mark.
    const { container } = render(
      <StatisticsGroup unknownLabel="-" items={items([
        { key: 'nvidia', group: 'vendors', groupLabel: 'V' },
      ])} />,
    );
    const group = container.querySelector('[data-stat-group]')!;
    expect(group.className).not.toContain('border-l');
  });
});
