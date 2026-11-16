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
