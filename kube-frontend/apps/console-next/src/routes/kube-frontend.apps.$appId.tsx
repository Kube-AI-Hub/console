import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { AppStoreAppDetailPage } from '@/pages/appstore/AppStoreAppDetailPage';

/** `/kube-frontend/apps/$appId` — 应用详情。 */
export const Route = createFileRoute('/kube-frontend/apps/$appId')({
  component: appStoreDetailRoute,
});

function appStoreDetailRoute(): React.ReactElement {
  const { appId } = Route.useParams();
  return <AppStoreAppDetailPage appId={appId} />;
}
