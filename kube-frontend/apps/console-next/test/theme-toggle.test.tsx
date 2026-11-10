import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, ThemeToggle } from '@kube-ai-hub/ui';

/**
 * The switch itself, and the provider it talks to.
 *
 * Asserted through `document.documentElement` rather than a returned value: the
 * theme lives on `<html>` so portalled content (dialogs, menus) inherits it, and
 * a provider that only updated component-local state would pass a naive test and
 * still leave every modal unstyled.
 */

/*
 * Each case starts from no preference. Without this the previous case's stored
 * choice becomes the next one's default, and the toggle test depends on which
 * test ran before it.
 */
beforeEach(() => {
  window.localStorage.removeItem('ai-kit-theme');
  window.localStorage.removeItem('ai-kit-accent');
});

afterEach(() => {
  cleanup();
});

function renderToggle(): void {
  render(
    <ThemeProvider defaultTheme="dark" defaultAccent="violet">
      <ThemeToggle label="切换深浅色主题" />
    </ThemeProvider>,
  );
}

describe('ThemeToggle', () => {
  it('flips the attribute on the document element', async () => {
    document.documentElement.removeAttribute('data-theme');
    renderToggle();

    const button = screen.getByRole('button', { name: '切换深浅色主题' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(button.getAttribute('aria-pressed')).toBe('true');

    await userEvent.click(button);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    // The label is fixed, so assistive tech reads the state from `aria-pressed`
    // rather than from a name that changes under it.
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('persists the choice under the key the bootstrap script reads', async () => {
    document.documentElement.removeAttribute('data-theme');
    renderToggle();

    await userEvent.click(screen.getByRole('button', { name: '切换深浅色主题' }));
    // `index.html` restores from this exact key before React runs; a rename here
    // silently reintroduces the flash of the wrong theme.
    expect(window.localStorage.getItem('ai-kit-theme')).toBe('light');
  });

  it('applies the accent alongside the mode', () => {
    document.documentElement.removeAttribute('data-accent');
    renderToggle();
    expect(document.documentElement.getAttribute('data-accent')).toBe('violet');
  });
});
