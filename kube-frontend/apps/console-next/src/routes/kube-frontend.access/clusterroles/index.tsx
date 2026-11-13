import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { PlatformListPage } from '@/pages/platform/PlatformListPage';

/** `/kube-frontend/access/clusterroles` — 平台级 clusterroles 列表。 */
export const Route = createFileRoute('/kube-frontend/access/clusterroles/')({
  component: clusterrolesRoute,
});

function clusterrolesRoute(): React.ReactElement {
  return <PlatformListPage kind="clusterroles" />;
}
