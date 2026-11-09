import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import * as React from 'react';
import { ThemeProvider, useTheme, applyTheme, applyAccent } from '../src/theme/ThemeProvider';
import { Reveal } from '../src/motion/Reveal';
import { StreamText } from '../src/motion/StreamText';

/** Helper that exposes the theme context for assertions. */
function ThemeProbe(): React.ReactElement {
  const { theme, accent, setTheme, setAccent } = useTheme();
  return (
    <div>
      <span data-testid="mode">{theme}</span>
      <span data-testid="accent">{accent}</span>
      <button onClick={() => setTheme('light')}>light</button>
      <button onClick={() => setAccent('green')}>green</button>
    </div>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-accent');
  });

  it('writes both attributes onto <html> so portals are themed too', () => {
    applyTheme('light');
    applyAccent('green');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-accent')).toBe('green');
  });

  it('defaults to dark + violet and persists changes', async () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
    expect(screen.getByTestId('accent')).toHaveTextContent('violet');

    await act(async () => {
      screen.getByText('light').click();
      screen.getByText('green').click();
    });

    expect(screen.getByTestId('mode')).toHaveTextContent('light');
    expect(screen.getByTestId('accent')).toHaveTextContent('green');
    expect(window.localStorage.getItem('ai-kit-theme')).toBe('light');
    expect(window.localStorage.getItem('ai-kit-accent')).toBe('green');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-accent')).toBe('green');
  });

  it('restores a stored preference on mount', () => {
    window.localStorage.setItem('ai-kit-theme', 'light');
    window.localStorage.setItem('ai-kit-accent', 'green');
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('mode')).toHaveTextContent('light');
    expect(screen.getByTestId('accent')).toHaveTextContent('green');
  });

  it('keeps mode and accent independent', async () => {
    // Regression: the accent rules were scoped without a theme qualifier, so
    // the light palette leaked into dark mode for the same accent.
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    await act(async () => {
      screen.getByText('green').click();
    });
    expect(screen.getByTestId('accent')).toHaveTextContent('green');
    expect(screen.getByTestId('mode')).toHaveTextContent('dark');

    await act(async () => {
      screen.getByText('light').click();
    });
    expect(screen.getByTestId('mode')).toHaveTextContent('light');
    expect(screen.getByTestId('accent')).toHaveTextContent('green');
  });
});

describe('Reveal', () => {
  const originalIO = globalThis.IntersectionObserver;

  afterEach(() => {
    globalThis.IntersectionObserver = originalIO;
  });

  it('shows content immediately when IntersectionObserver is unavailable', () => {
    // @ts-expect-error deliberately removing the API
    delete globalThis.IntersectionObserver;
    render(<Reveal>内容</Reveal>);
    expect(screen.getByText('内容').closest('.ai-reveal')).toHaveAttribute('data-visible', 'true');
  });

  it('starts hidden and reveals when the observer fires', () => {
    const callbacks: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = [];
    globalThis.IntersectionObserver = class {
      constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
        callbacks.push(callback);
      }
      observe(): void {}
      disconnect(): void {}
      unobserve(): void {}
    } as unknown as typeof IntersectionObserver;

    render(<Reveal>内容</Reveal>);
    const node = screen.getByText('内容').closest('.ai-reveal');
    expect(node).toHaveAttribute('data-visible', 'false');

    act(() => {
      callbacks[0]?.([{ isIntersecting: true }]);
    });
    expect(node).toHaveAttribute('data-visible', 'true');
  });
});

describe('StreamText', () => {
  it('animates only the appended segment', () => {
    const { rerender } = render(<StreamText text="你好" />);
    expect(screen.getByText('你好')).toBeInTheDocument();

    rerender(<StreamText text="你好，世界" />);
    // Settled prefix stays in the parent, the new text is wrapped for animation.
    expect(screen.getByText('，世界')).toHaveClass('ai-stream-in');
  });

  it('replaces wholesale when the prefix is rewritten', () => {
    const { rerender } = render(<StreamText text="abc" />);
    rerender(<StreamText text="xyz" />);
    expect(screen.getByText('xyz')).toBeInTheDocument();
    expect(screen.queryByText('abc')).not.toBeInTheDocument();
  });
});
