import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiButton, AiSurface } from '../src/ai-controls';

/**
 * The agent-facing contract, checked at the DOM.
 *
 * `aiId` being required is a compile-time guard; these tests confirm the
 * attribute actually reaches the element, because a spread placed after the
 * handler would silently override it.
 */

describe('AiButton', () => {
  it('always renders its agent id', () => {
    render(<AiButton aiId="x:go">go</AiButton>);
    expect(screen.getByRole('button', { name: 'go' })).toHaveAttribute('data-ai-id', 'x:go');
  });

  it('renders prerequisites only when given', () => {
    const { rerender } = render(<AiButton aiId="x:go">go</AiButton>);
    expect(screen.getByRole('button')).not.toHaveAttribute('data-ai-needs');

    rerender(
      <AiButton aiId="x:go" needs={['x:select']}>
        go
      </AiButton>,
    );
    expect(screen.getByRole('button')).toHaveAttribute('data-ai-needs', 'x:select');
  });

  it('keeps a 44px minimum touch target', () => {
    render(<AiButton aiId="x:go">go</AiButton>);
    // `min-h-11` is 44px; the desktop height only applies from `sm` up.
    expect(screen.getByRole('button').className).toContain('min-h-11');
  });

  it('bare mode drops the visual chrome but keeps the handle', () => {
    render(
      <AiButton aiId="x:sort" bare className="custom">
        sort
      </AiButton>,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('data-ai-id', 'x:sort');
    expect(button.className).toBe('custom');
  });

  it('fires its handler', async () => {
    const onClick = vi.fn();
    render(
      <AiButton aiId="x:go" onClick={onClick}>
        go
      </AiButton>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('AiSurface', () => {
  it('publishes its state', () => {
    render(<AiSurface aiId="x:surface" state="ready">body</AiSurface>);
    const surface = document.querySelector('[data-ai-id="x:surface"]');
    expect(surface).toHaveAttribute('data-ai-state', 'ready');
  });

  it('marks itself busy while loading so assistive tech waits', () => {
    render(<AiSurface aiId="x:surface" state="loading">body</AiSurface>);
    expect(document.querySelector('[data-ai-id="x:surface"]')).toHaveAttribute('aria-busy', 'true');
  });

  it('does not mark other states busy', () => {
    render(<AiSurface aiId="x:surface" state="empty">body</AiSurface>);
    expect(document.querySelector('[data-ai-id="x:surface"]')).not.toHaveAttribute('aria-busy');
  });

  it('honours the requested element', () => {
    render(
      <AiSurface as="main" aiId="x:surface" state="ready">
        body
      </AiSurface>,
    );
    expect(document.querySelector('main')).toHaveAttribute('data-ai-state', 'ready');
  });
});
