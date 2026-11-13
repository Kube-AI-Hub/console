import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { WorkbenchPage } from '@/pages/workbench/WorkbenchPage';

/**
 * `/kube-frontend/` — 工作台.
 *
 * Every route in this app lives under `/kube-frontend/`, and the top navigation's 工作台
 * entry points here. That entry used to point at a path with no route at all, so clicking
 * it landed on Not Found; the only working URL was the bare `/`.
 */
export const Route = createFileRoute('/kube-frontend/')({
  component: workbenchRoute,
});

function workbenchRoute(): React.ReactElement {
  return <WorkbenchPage />;
}
