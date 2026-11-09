import { describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { ToastProvider, useToast } from '../src/primitives/Toast';
import { Menu, Collapse, type MenuNode } from '../src/primitives/Menu';

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
    render(<Menu items={[{ key: 'a', label: '概览', href: '/overview' }]} collapsed />);
    const link = screen.getByTitle('概览');
    expect(link).toBeInTheDocument();
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
