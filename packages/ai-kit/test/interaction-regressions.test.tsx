import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { AutoComplete } from '../src/primitives/AutoComplete';
import { Notify } from '../src/primitives/Notify';

/**
 * Regressions found while reviewing the components in Storybook.
 *
 * Scope note: the AutoComplete dropdown-flicker bug came from Radix reporting
 * the input's own click as an outside click. jsdom does not reproduce that
 * because it has no real hit-testing, so the assertions here cover the contract
 * this component owns — open on first click, filter, select, dismiss, reopen —
 * while the Radix interaction itself was verified in a real browser.
 */

const OPTIONS = ['default', 'kube-system', 'kubesphere-system'].map((value) => ({ value }));

describe('AutoComplete', () => {
  it('opens on the very first click, not only after typing', async () => {
    render(<AutoComplete options={OPTIONS} placeholder="命名空间" aria-label="命名空间" />);
    const input = screen.getByLabelText('命名空间');

    await userEvent.click(input);

    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(OPTIONS.length);
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps focus on the input while open', async () => {
    render(<AutoComplete options={OPTIONS} placeholder="命名空间" aria-label="命名空间" />);
    const input = screen.getByLabelText('命名空间');

    await userEvent.click(input);

    // Moving focus into the list on open was the second half of the flicker:
    // the input blurred and the deferred close shut the list again.
    expect(document.activeElement).toBe(input);
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('cancels a pending close when the input is re-focused', async () => {
    render(<AutoComplete options={OPTIONS} placeholder="命名空间" aria-label="命名空间" />);
    const input = screen.getByLabelText('命名空间');

    await userEvent.click(input);
    expect(await screen.findByRole('listbox')).toBeInTheDocument();

    // The original implementation queued an uncancellable `setTimeout`, so a
    // reopened list was closed again by the stale timer.
    await userEvent.tab();
    await userEvent.click(input);

    expect(await screen.findByRole('listbox')).toBeInTheDocument();
  });

  it('filters as the user types', async () => {
    render(<AutoComplete options={OPTIONS} placeholder="命名空间" aria-label="命名空间" />);
    const input = screen.getByLabelText('命名空间');

    await userEvent.click(input);
    await userEvent.type(input, 'kube');

    expect(screen.getByRole('option', { name: 'kube-system' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'default' })).not.toBeInTheDocument();
  });

  it('selects an option and closes', async () => {
    const onSelect = vi.fn();
    render(<AutoComplete options={OPTIONS} onSelect={onSelect} placeholder="命名空间" aria-label="命名空间" />);
    const input = screen.getByLabelText('命名空间');

    await userEvent.click(input);
    await userEvent.type(input, 'kube');
    await userEvent.click(screen.getByRole('option', { name: 'kube-system' }));

    expect(onSelect).toHaveBeenCalledWith('kube-system');
    expect(input).toHaveValue('kube-system');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  });

  it('ignores the open request Radix sends when the field is clicked', async () => {
    render(<AutoComplete options={OPTIONS} placeholder="命名空间" aria-label="命名空间" />);
    const input = screen.getByLabelText('命名空间');

    await userEvent.click(input);
    // Clicking a focused input fires no focus event; the mousedown path must
    // still keep the list open rather than toggling it shut.
    await userEvent.click(input);

    expect(await screen.findByRole('listbox')).toBeInTheDocument();
  });
});

describe('Notify host lifecycle', () => {
  beforeEach(() => {
    Notify.clear();
  });

  afterEach(() => {
    Notify.clear();
  });

  it('leaves no full-viewport layer covering the page', async () => {
    Notify.info('同步中', '正在拉取资源');
    await screen.findByText('同步中');

    const host = document.getElementById('__ai-kit-notify__');
    expect(host).not.toBeNull();

    // A `fixed inset-0` wrapper here is what made every page opened after a
    // notification look blank.
    const fullScreen = Array.from(host!.querySelectorAll('*')).filter((element) => {
      const style = getComputedStyle(element);
      return style.position === 'fixed' && style.top === '0px' && style.left === '0px' && style.right === '0px';
    });
    expect(fullScreen).toHaveLength(0);
  });

  it('removes the host once the last notice closes', async () => {
    Notify.info('唯一的一条');
    await screen.findByText('唯一的一条');

    await userEvent.click(await screen.findByLabelText('关闭通知'));

    await waitFor(() => {
      expect(document.getElementById('__ai-kit-notify__')).toBeNull();
    });
  });

  it('removes the host on clear()', async () => {
    Notify.info('a');
    Notify.info('b');
    await screen.findByText('a');

    Notify.clear();

    await waitFor(() => {
      expect(document.getElementById('__ai-kit-notify__')).toBeNull();
    });
  });

  it('tears the host down when the last notice times out', async () => {
    vi.useFakeTimers();
    try {
      Notify.info({ title: '自动过期', duration: 1000 });
      await vi.advanceTimersByTimeAsync(1200);
      expect(document.getElementById('__ai-kit-notify__')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('creates a fresh host after being torn down', async () => {
    Notify.info('第一条');
    await screen.findByText('第一条');
    Notify.clear();
    await waitFor(() => expect(document.getElementById('__ai-kit-notify__')).toBeNull());

    Notify.success('第二条');
    expect(await screen.findByText('第二条')).toBeInTheDocument();
  });
});
