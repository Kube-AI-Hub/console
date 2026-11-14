import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { StoreManagePage } from '@/pages/appstore/StoreManagePage';

/** `…/apps-manage/store` — 商店里的应用。 */
export const Route = createFileRoute('/kube-frontend/apps-manage/store/')({
  component: storeAppsRoute,
});

function storeAppsRoute(): React.ReactElement {
  return <StoreManagePage view="store" />;
}
