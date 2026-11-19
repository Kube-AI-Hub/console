import * as React from 'react';

/**
 * Minimal stand-in for recharts in app unit tests.
 *
 * The real library is installed in ai-kit's own pnpm project (React 18); loading
 * it into this app's React 19 tree throws "A React Element from an older version
 * of React was rendered". These tests assert the *host's* data, legend and empty
 * state, not the drawing: the real chart is covered by ai-kit's own chart tests
 * (on ai-kit's React), the production build and the browser pass.
 *
 * Every export the shared charts import must exist here. A missing one is not a
 * silent no-op — React sees `undefined` as a component and throws "Element type is
 * invalid", which reads like a broken page rather than a missing test stub.
 */

function Box({ children, ...rest }: { children?: React.ReactNode; [key: string]: unknown }): React.ReactElement {
  return <div {...rest}>{children}</div>;
}

export function PieChart({ children }: { children?: React.ReactNode }): React.ReactElement {
  return <div data-testid="recharts-piechart">{children}</div>;
}

export function Pie({ children }: { children?: React.ReactNode }): React.ReactElement {
  return <div data-testid="recharts-pie">{children}</div>;
}

export function Cell(): null {
  return null;
}

export function Sector(): null {
  return null;
}

/*
 * The time-series family. `ComposedChart` is the container; the rest render
 * nothing. The host's assertions are about the legend and the panel's states, so a
 * stub that draws nothing keeps them honest without pretending to be a plot.
 */
export function ComposedChart({ children }: { children?: React.ReactNode }): React.ReactElement {
  return <div data-testid="recharts-composed">{children}</div>;
}

export function Line(): null {
  return null;
}

export function Area(): null {
  return null;
}

export function Bar(): null {
  return null;
}

export function XAxis(): null {
  return null;
}

export function YAxis(): null {
  return null;
}

export function CartesianGrid(): null {
  return null;
}

export function Tooltip(): null {
  return null;
}

/**
 * A fixed-size container: the real one measures its parent, and jsdom reports zero
 * for every element, which would make the chart render nothing at all.
 */
export function ResponsiveContainer({ children }: { children?: React.ReactNode }): React.ReactElement {
  return <div data-testid="recharts-container">{children}</div>;
}

export default Box;
