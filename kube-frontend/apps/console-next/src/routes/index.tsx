import * as React from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { WorkbenchPage } from '@/pages/workbench/WorkbenchPage';

/**
 * `/` — kept as a redirect into the console's own prefix.
 *
 * The app used to render its landing page here, which is why the header's 工作台 entry
 * (`/kube-frontend/`) pointed at nothing. The canonical workbench now lives under the
 * prefix like every other route; this route only keeps an old bookmark working.
 */
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/kube-frontend' });
  },
  component: fallback,
});

/** Never rendered: `beforeLoad` always redirects. Kept so the route has a component. */
function fallback(): React.ReactElement {
  return <WorkbenchPage />;
}
