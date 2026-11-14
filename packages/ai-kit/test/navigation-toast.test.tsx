import { describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { ToastProvider, useToast } from '../src/primitives/Toast';
import { Menu, Collapse, type MenuNode } from '../src/primitives/Menu';
import { Pagination } from '../src/primitives/Navigation';

describe('Toast', () => {
  function Emitter({ onReady }: { onReady: (api: ReturnType<typeof useToast>) => void }): null {
    const api = useToast();
    React.useEffect(() => onReady(api), [api, onReady]);
    return null;
  }

  it('shows a queued toast and dismisses it', async () => {
    let api: ReturnType<typeof useToast> | null = null;
    render(
      <ToastProvider>
        <Emitter onReady={(value) => { api = value; }} />
      </ToastProvider>,
    );
    await act(async () => {
      api!.push({ title: '保存成功', tone: 'success' });
    });
    expect(await screen.findByText('保存成功')).toBeInTheDocument();
  });

  it('keeps several toasts instead of overwriting the previous one', async () => {
    // A batch failure must surface每一条; a single-slot implementation would
    // silently drop all but the last.
    let api: ReturnType<typeof useToast> | null = null;
    render(
      <ToastProvider>
        <Emitter onReady={(value) => { api = value; }} />
      </ToastProvider>,
    );
    await act(async () => {
      api!.push({ title: '第一条' });
      api!.push({ title: '第二条' });
      api!.push({ title: '第三条' });
    });
    expect(screen.getByText('第一条')).toBeInTheDocument();
    expect(screen.getByText('第二条')).toBeInTheDocument();
    expect(screen.getByText('第三条')).toBeInTheDocument();
  });

  it('drops the oldest toast past the limit', async () => {
    let api: ReturnType<typeof useToast> | null = null;
    render(
      <ToastProvider limit={2}>
        <Emitter onReady={(value) => { api = value; }} />
      </ToastProvider>,
    );
    await act(async () => {
      api!.push({ title: 'a' });
      api!.push({ title: 'b' });
      api!.push({ title: 'c' });
    });
    expect(screen.queryByText('a')).not.toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
    expect(screen.getByText('c')).toBeInTheDocument();
  });

  it('throws when used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Emitter onReady={() => {}} />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});

describe('Menu', () => {
  const items: MenuNode[] = [
    { key: 'overview', label: '概览' },
    {
      key: 'cluster',
      label: '集群',
      children: [
        { key: 'nodes', label: '节点' },
        { key: 'storage', label: '存储' },
      ],
    },
  ];

  it('opens the group containing the active leaf', () => {
    // Losing the highlight after a refresh is a common navigation bug.
    render(<Menu items={items} activeKey="nodes" aria-label="主导航" />);
    expect(screen.getByText('节点')).toBeInTheDocument();
    expect(screen.getByText('节点').closest('a,button')).toHaveAttribute('aria-current', 'page');
  });

  it('shows a badge and marks the active leaf', () => {
    render(
      <Menu
        items={[{ key: 'a', label: '告警', badge: <span>3</span> }]}
        activeKey="a"
      />,
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('告警').closest('button')).toHaveAttribute('aria-current', 'page');
  });

  it('hides labels when collapsed but keeps an accessible title', () => {
    render(<Menu items={[{ key: 'a', label: '概览', icon: <span>i</span>, href: '/overview' }]} collapsed />);
    const link = screen.getByTitle('概览');
    expect(link).toBeInTheDocument();
    expect(screen.queryByText('概览')).not.toBeInTheDocument();
  });

  it('names a collapsed icon button that is not a link', () => {
    render(<Menu items={[{ key: 'a', label: '监控告警', icon: <span>i</span> }]} collapsed />);
    expect(screen.getByTitle('监控告警')).toBeInTheDocument();
    expect(screen.queryByText('监控告警')).not.toBeInTheDocument();
  });

  it('keeps the label on a collapsed row that has no icon', () => {
    render(<Menu items={[{ key: 'a', label: '监控告警' }, { key: 'b', label: '配置' }]} collapsed aria-label="主导航" />);
    expect(screen.getByText('监控告警')).toBeInTheDocument();
    expect(screen.getByText('配置')).toBeInTheDocument();
  });

  it('left-aligns every row, and indents a child by one text step when nothing has an icon', () => {
    render(
      <Menu
        aria-label="主导航"
        defaultOpenKeys={['group']}
        items={[
          { key: 'group', label: '工作负载', children: [{ key: 'pod', label: 'Pod' }] },
          { key: 'monitor', label: '监控告警' },
        ]}
      />,
    );
    const group = screen.getByRole('button', { name: '工作负载' });
    const leaf = screen.getByRole('button', { name: '监控告警' });
    const child = screen.getByRole('button', { name: 'Pod' });
    for (const row of [group, leaf, child]) {
      expect(row.className).toContain('text-left');
      expect(row.querySelector('[data-ai-menu-icon]')).toBeNull();
    }
    // 8px row pad + one 16px step. No icon column, so the child does not jump further.
    expect(child).toHaveStyle({ paddingLeft: '24px' });
  });

  it('reserves an icon slot on a row that has none, once any row has an icon', () => {
    render(
      <Menu
        aria-label="主导航"
        defaultOpenKeys={['group']}
        items={[
          { key: 'group', label: '配置', children: [{ key: 'cm', label: '配置字典', icon: <span>i</span> }] },
          { key: 'overview', label: '概览' },
        ]}
      />,
    );
    const group = screen.getByRole('button', { name: '配置' });
    const overview = screen.getByRole('button', { name: '概览' });
    const child = screen.getByRole('button', { name: '配置字典' });
    expect(group.querySelector('[data-ai-menu-icon]')).not.toBeNull();
    expect(overview.querySelector('[data-ai-menu-icon]')).not.toBeNull();
    expect(child.querySelector('[data-ai-menu-icon]')).not.toBeNull();
    // 8px row pad + one 24px step (slot + gap), so the child icon sits under the parent label.
    expect(child).toHaveStyle({ paddingLeft: '32px' });
  });

  it('toggles a group open and closed', async () => {
    render(<Menu items={items} />);
    const groupButton = screen.getByRole('button', { name: /集群/ });
    await userEvent.click(groupButton);
    expect(screen.getByText('节点')).toBeInTheDocument();
    await userEvent.click(groupButton);
    expect(screen.queryByText('节点')).not.toBeInTheDocument();
  });
});

describe('Collapse', () => {
  const items = [
    { key: 'a', title: '第一项', content: '内容一' },
    { key: 'b', title: '第二项', content: '内容二' },
  ];

  it('opens the keys listed in defaultOpenKeys', () => {
    render(<Collapse items={items} defaultOpenKeys={['a']} />);
    expect(screen.getByText('内容一')).toBeInTheDocument();
  });

  it('keeps several sections open when not in accordion mode', async () => {
    render(<Collapse items={items} />);
    await userEvent.click(screen.getByText('第一项'));
    await userEvent.click(screen.getByText('第二项'));
    expect(screen.getByText('内容一')).toBeInTheDocument();
    expect(screen.getByText('内容二')).toBeInTheDocument();
  });

  it('closes the previous section in accordion mode', async () => {
    render(<Collapse items={items} accordion />);
    await userEvent.click(screen.getByText('第一项'));
    await userEvent.click(screen.getByText('第二项'));
    expect(screen.queryByText('内容一')).not.toBeInTheDocument();
    expect(screen.getByText('内容二')).toBeInTheDocument();
  });
});

describe('Pagination', () => {
  it('paints the current page with the accent fill and contrasting text', () => {
    render(<Pagination page={1} pageSize={20} total={95} onChange={() => undefined} />);
    const current = screen.getByRole('button', { current: 'page' });
    expect(current.className).toContain('bg-ai-accent');
    expect(current.className).toContain('text-ai-accent-fg');
    expect(current.className).not.toContain('bg-ai-accent-soft');
    expect(current.className).not.toContain('text-ai-accent ');
  });

  it('opens the page-size list with the same popup as Select', async () => {
    render(
      <Pagination
        page={1}
        pageSize={20}
        total={95}
        pageSizeOptions={[10, 20, 50, 100]}
        onChange={() => undefined}
        onPageSizeChange={() => undefined}
      />,
    );
    await userEvent.click(screen.getByRole('combobox', { name: '每页条数' }));
    const list = await screen.findByRole('listbox');
    const popup = list.closest('[class*="bg-ai-bg-overlay"]');
    expect(popup).not.toBeNull();
    expect(popup?.className).toMatch(/shadow-ai-pop/);
    expect(popup?.className).toMatch(/min-w-\[12rem\]/);
    expect(screen.getByRole('option', { name: '10' }).className).toMatch(/text-sm/);
    expect(document.querySelector('select')).toBeNull();
  });
});
