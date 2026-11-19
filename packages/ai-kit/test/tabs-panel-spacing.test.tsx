import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Tabs, TabsContent } from '../src/primitives/Navigation';

/**
 * A tab panel is spaced away from its tab strip.
 *
 * The strip ends with a 1px underline, and a panel flush against it reads as if the
 * content belonged to the tabs — no boundary between "which tab" and "what is in
 * it". The gap belongs in the primitive so the 60-odd panels across the app cannot
 * drift apart; callers that want more add their own class and `cn` lets it win.
 */
const items = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];

describe('Tabs panel spacing', () => {
  it('gives every panel a top margin by default', () => {
    const { container } = render(
      <Tabs items={items} value="a">
        <TabsContent value="a">first</TabsContent>
        <TabsContent value="b">second</TabsContent>
      </Tabs>,
    );
    // Radix keeps every panel mounted and hides the inactive ones, so both carry
    // the class — the gap must be on all of them, not just the visible one.
    const panels = container.querySelectorAll('[role="tabpanel"]');
    expect(panels).toHaveLength(2);
    panels.forEach((panel) => expect(panel.className).toContain('mt-4'));
  });

  it('lets a caller override the gap', () => {
    // `cn` runs tailwind-merge, so a later `mt-*` replaces the default rather than
    // stacking with it — the panel must not end up with two margins.
    const { container } = render(
      <Tabs items={items} value="a">
        <TabsContent value="a" className="mt-8">first</TabsContent>
      </Tabs>,
    );
    const panel = container.querySelector('[role="tabpanel"]')!;
    expect(panel.className).toContain('mt-8');
    expect(panel.className).not.toContain('mt-4');
  });

  it('keeps a caller class that is not about the gap', () => {
    const { container } = render(
      <Tabs items={items} value="a">
        <TabsContent value="a" className="flex flex-col gap-4">first</TabsContent>
      </Tabs>,
    );
    const panel = container.querySelector('[role="tabpanel"]')!;
    expect(panel.className).toContain('mt-4');
    expect(panel.className).toContain('flex');
    expect(panel.className).toContain('gap-4');
  });

  it('still exposes the panel to assistive tech', () => {
    render(
      <Tabs items={items} value="a">
        <TabsContent value="a">first panel</TabsContent>
      </Tabs>,
    );
    expect(screen.getByRole('tabpanel')).toHaveTextContent('first panel');
  });
});
