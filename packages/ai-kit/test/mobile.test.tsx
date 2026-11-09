import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { useIsMobile } from '../src/utils/useMediaQuery';
import { DatePicker } from '../src/primitives/DatePicker';
import { Table, type TableColumn } from '../src/primitives/Table';
import { Columns, Column } from '../src/primitives/Layout';
import { Modal } from '../src/primitives/Feedback';
import aiKitPreset from '../src/tailwind.preset';

/**
 * Mobile adaptation.
 *
 * jsdom has no layout engine, so these assert the responsive contract in the
 * markup — which branch is selected, which classes carry the breakpoint — while
 * the actual pixel results (panel fits 390px, 44px targets, sheet anchored to the
 * bottom) were measured in a real browser.
 */

/** Drive `matchMedia` so the mobile branch can be exercised. */
function mockViewport(matches: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useIsMobile', () => {
  it('reports true when the mobile query matches', () => {
    mockViewport(true);
    function Probe(): React.ReactElement {
      return <span>{useIsMobile() ? 'mobile' : 'desktop'}</span>;
    }
    render(<Probe />);
    expect(screen.getByText('mobile')).toBeInTheDocument();
  });

  it('reports false on a wide viewport', () => {
    mockViewport(false);
    function Probe(): React.ReactElement {
      return <span>{useIsMobile() ? 'mobile' : 'desktop'}</span>;
    }
    render(<Probe />);
    expect(screen.getByText('desktop')).toBeInTheDocument();
  });
});

describe('DatePicker on a phone', () => {
  beforeEach(() => mockViewport(true));

  it('replaces the two panels with start/end tabs', async () => {
    render(<DatePicker value="" onChange={() => undefined} range id="m" />);
    await userEvent.click(screen.getByRole('button', { name: /选择日期/ }));

    // Only one calendar is visible, reached through a tab per end.
    expect(screen.getByRole('tab', { name: '开始日期' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '结束日期' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^切换月份或年份/ })).toHaveLength(1);
  });

  it('advances to the end tab after picking a start', async () => {
    function Harness(): React.ReactElement {
      const [value, setValue] = React.useState('');
      return <DatePicker value={value} onChange={setValue} range id="adv" />;
    }
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: /选择日期/ }));

    const day = screen.getAllByRole('button').filter((el) => el.textContent === '15')[0]!;
    await userEvent.click(day);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: '结束日期' })).toHaveAttribute('aria-selected', 'true');
    });
  });
});

describe('DatePicker on a desktop', () => {
  beforeEach(() => mockViewport(false));

  it('keeps both panels visible without tabs', async () => {
    render(<DatePicker value="" onChange={() => undefined} range id="d" />);
    await userEvent.click(screen.getByRole('button', { name: /选择日期/ }));

    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^切换月份或年份/ })).toHaveLength(2);
  });
});

describe('Table responsive columns', () => {
  interface Row {
    name: string;
    detail: string;
  }
  const rows: Row[] = [{ name: 'a', detail: 'x' }];

  it('hides a mobile-flagged column below the breakpoint only', () => {
    const columns: Array<TableColumn<Row>> = [
      { key: 'name', title: '名称' },
      { key: 'detail', title: '详情', hideOnMobile: true },
      { key: 'never', title: '常显' },
    ];
    const { container } = render(<Table columns={columns} rows={rows} rowKey={(row) => row.name} />);

    const headers = Array.from(container.querySelectorAll('th'));
    const hidden = headers.filter((el) => el.className.includes('hidden sm:table-cell'));
    // Exactly one column opts out on small screens.
    expect(hidden).toHaveLength(1);
    expect(hidden[0]?.textContent).toContain('详情');
  });

  it('keeps the scroll container constrained to its own box', () => {
    const { container } = render(
      <Table columns={[{ key: 'a', title: 'A' }]} rows={rows} rowKey={(row) => row.name} />,
    );
    const scroller = container.firstElementChild as HTMLElement;
    expect(scroller.className).toMatch(/overflow-x-auto/);
    // Prevents the browser's back-swipe from hijacking a horizontal table drag.
    expect(scroller.className).toMatch(/overscroll-x-contain/);
  });
});

describe('Layout columns', () => {
  it('wraps columns on small screens even without multiline', () => {
    const { container } = render(<Columns><Column>a</Column></Columns>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/flex-wrap/);
    expect(root.className).toMatch(/sm:flex-nowrap/);
  });

  it('gives a sized column full width below the breakpoint', () => {
    const { container } = render(
      <Columns>
        <Column size={6}>a</Column>
      </Columns>,
    );
    // The outer Columns div, then its first child column.
    const column = container.firstElementChild?.firstElementChild as HTMLElement;
    expect(column.className).toMatch(/basis-full/);
    expect(column.className).toMatch(/sm:basis-6\/12/);
  });
});

describe('Modal on a phone', () => {
  beforeEach(() => mockViewport(true));

  it('uses a bottom sheet layout below the breakpoint', () => {
    render(<Modal open onOpenChange={() => undefined} title="t">body</Modal>);
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toMatch(/bottom-0/);
    expect(dialog.className).toMatch(/rounded-t-ai-xl/);
    // The centred desktop placement is restored at `sm`.
    expect(dialog.className).toMatch(/sm:left-1\/2/);
  });

  it('keeps the sheet settled after the entrance animation ends', () => {
    // Regression: the animation shorthand omitted `both`, so the browser
    // discarded the final keyframe and the sheet fell back to the element's
    // pre-animation transform, settling a full height below the viewport.
    render(<Modal open onOpenChange={() => undefined} title="t">body</Modal>);
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toMatch(/animate-ai-sheet-in/);
    expect(aiKitPreset.theme.extend.animation['ai-sheet-in']).toMatch(/\bboth$/);
  });
});

describe('Docs pages', () => {
  /**
   * Storybook renders the docs frame outside the story decorator, so the frame
   * was never inside `.ai-root`: titles and the prop table kept Storybook's
   * fixed light palette and the theme toggles were missing entirely. These guard
   * the two contract points that fix it.
   */
  it('routes docs pages through a themed container', async () => {
    const { default: preview } = await import('../.storybook/preview');
    expect(preview.parameters?.docs?.container).toBeTypeOf('function');
  });

  it('does not nest a second provider inside the docs canvas', async () => {
    // The container owns the theme in docs mode; a second provider there made
    // the toggles at the top of the page leave the canvases unchanged.
    const { default: preview } = await import('../.storybook/preview');
    const decorator = preview.decorators?.[0] as (story: () => React.ReactElement, ctx: { viewMode: string }) => React.ReactElement;
    expect(decorator).toBeTypeOf('function');

    const { container } = render(decorator(() => <span>example</span>, { viewMode: 'docs' }));
    // No toggle row and no provider in the canvas branch.
    expect(screen.queryByRole('button', { name: /主题/ })).not.toBeInTheDocument();
    expect(container.querySelector('.ai-docs-story')).not.toBeNull();
  });
});
