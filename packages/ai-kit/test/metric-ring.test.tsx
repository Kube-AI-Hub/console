import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MetricRing } from '../src/primitives/MetricRing';

describe('MetricRing', () => {
  it('preserves a real zero and a labelled progress value', () => {
    render(<MetricRing value={0} aria-label="CPU" />);
    expect(screen.getByRole('progressbar', { name: 'CPU' })).toHaveAttribute('aria-valuenow', '0');
    expect(document.querySelector('[stroke-dashoffset]')).toHaveAttribute('stroke-dashoffset', '100');
  });
  it('does not invent a zero for missing or non-finite samples', () => {
    const view = render(<MetricRing aria-label="GPU" />);
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByRole('img', { name: 'GPU' })).not.toHaveAttribute('aria-valuenow');
    view.rerender(<MetricRing value={NaN} aria-label="GPU" />);
    expect(document.querySelector('[stroke-dashoffset]')).toBeNull();
  });
  it('caps the drawing while exposing the actual over-capacity value', () => {
    render(<MetricRing value={125} aria-label="Allocation" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '125');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '125');
    expect(document.querySelector('[stroke-dashoffset]')).toHaveAttribute('stroke-dashoffset', '0');
    expect(document.querySelector('[stroke-dashoffset]')).toHaveClass('text-ai-danger');
  });
});
