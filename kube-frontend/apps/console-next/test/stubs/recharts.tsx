import * as React from 'react';

/**
 * Minimal stand-in for recharts in app unit tests.
 *
 * The real library is installed in ai-kit's own pnpm project (React 18); loading
 * it into this app's React 19 tree throws "A React Element from an older version
 * of React was rendered". These tests assert the *host's* data, legend and empty
 * state, not the drawing: the real chart is covered by ai-kit's own DonutChart
 * test (on ai-kit's React), the production build and the browser pass.
 */
export function PieChart({ children }: { children?: React.ReactNode }): React.ReactElement {
  return <div data-testid="recharts-piechart">{children}</div>;
}

export function Pie({ children }: { children?: React.ReactNode }): React.ReactElement {
  return <div data-testid="recharts-pie">{children}</div>;
}

export function Cell(): null {
  return null;
}
