import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VendorMix } from '../src/pages/cluster/VendorIcon';

/**
 * The vendor mix strip.
 *
 * Its job is to make heterogeneity visible: a cluster running several kinds of
 * accelerator should read as "these are different", not as a row of identical
 * numbers. These assertions are about the *order* and *presence* rules, which is
 * where a rendering bug would hide — a strip that lists CPU first, or that draws a
 * vendor with zero nodes, still looks plausible on screen.
 */
describe('VendorMix', () => {
  it('lists accelerator vendors before CPU', () => {
    const { container } = render(
      <VendorMix vendors={[
        { vendor: 'CPU', count: 1 },
        { vendor: 'nvidia', count: 2 },
        { vendor: 'cambricon', count: 1 },
      ]} />,
    );
    const marks = [...container.querySelectorAll('[data-vendor]')].map((node) => node.getAttribute('data-vendor'));
    // CPU last: the accelerator marks lead, because they are what makes the cluster
    // interesting. A CPU-only node is the baseline, not the headline.
    expect(marks).toEqual(['nvidia', 'cambricon', 'CPU']);
  });

  it('omits a vendor with no nodes', () => {
    const { container } = render(
      <VendorMix vendors={[
        { vendor: 'nvidia', count: 2 },
        { vendor: 'metax', count: 0 },
      ]} />,
    );
    const marks = [...container.querySelectorAll('[data-vendor]')].map((node) => node.getAttribute('data-vendor'));
    // A zero means the cluster has no such hardware; a greyed-out slot would imply
    // it is expected but missing.
    expect(marks).toEqual(['nvidia']);
  });

  it('renders nothing when the mix is empty', () => {
    const { container } = render(<VendorMix vendors={[]} />);
    expect(container.querySelector('[data-ai-id="nodes:vendor-mix"]')).toBeNull();
  });

  it('gives every mark an accessible name', () => {
    render(<VendorMix vendors={[{ vendor: 'nvidia', count: 3 }, { vendor: 'cambricon', count: 1 }]} />);
    // A glyph with no name is invisible to a screen reader, which is the whole
    // failure mode of "icon instead of label".
    expect(screen.getByRole('img', { name: /NVIDIA|英伟达/i })).toBeTruthy();
    expect(screen.getByRole('img', { name: /Cambricon|寒武纪/i })).toBeTruthy();
  });
});
