import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '../src/primitives/Button';

describe('Button asChild', () => {
  it('renders one styled link without a nested button', () => {
    const { container } = render(
      <Button asChild variant="secondary" className="h-12 justify-start">
        <a href="/nodes"><span>Nodes</span></a>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Nodes' })).toHaveAttribute('href', '/nodes');
    expect(screen.getByRole('link')).toHaveClass('h-12', 'justify-start');
    expect(container.querySelector('button')).toBeNull();
  });

  it('slots the loading spinner inside the child without losing its content', () => {
    const { container } = render(
      <Button asChild loading><a href="/nodes"><span>Nodes</span></a></Button>,
    );
    expect(screen.getByRole('link', { name: 'Nodes' })).toHaveAttribute('data-loading', 'true');
    expect(container.querySelector('a > svg')).not.toBeNull();
  });
});

/**
 * Disabled and loading are both `disabled` on the element, but they must not look alike.
 *
 * The inert classes used to be attached to `disabled:` utilities, so a submitting button
 * rendered in the same grey as one the reader could never press — on the light themes the
 * two were 1.14:1 apart, i.e. identical to the eye. These assertions pin the split at the
 * class level, because jsdom cannot compute the palette.
 */
describe('Button disabled vs loading', () => {
  it('marks a genuinely disabled button as inert, with a broken outline', () => {
    render(<Button disabled>保存</Button>);
    const button = screen.getByRole('button', { name: '保存' });
    expect(button).toBeDisabled();
    expect(button).toHaveClass('bg-ai-surface-disabled', 'text-ai-fg-faint', 'border-dashed');
    // The fill must not be the enabled secondary button's own surface.
    expect(button.className).not.toMatch(/bg-ai-surface-2/);
  });

  it('keeps a loading button on its variant fill, so the running action stays identifiable', () => {
    render(<Button variant="primary" loading>部署中</Button>);
    const button = screen.getByRole('button', { name: '部署中' });
    // Still blocked, still spinning.
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('data-loading', 'true');
    // But not inert: no dashed frame, no disabled surface.
    expect(button.className).not.toMatch(/border-dashed|bg-ai-surface-disabled/);
    expect(button).toHaveClass('bg-ai-accent');
  });

  it('does not apply the inert look to an enabled button', () => {
    render(<Button variant="secondary">刷新</Button>);
    expect(screen.getByRole('button', { name: '刷新' }).className).not.toMatch(/border-dashed|bg-ai-surface-disabled/);
  });
});

