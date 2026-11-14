import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { AppStorePage } from '@/pages/appstore/AppStorePage';

/** `/kube-frontend/apps` — 应用商店（浏览）。 */
export const Route = createFileRoute('/kube-frontend/apps/')({
  component: appStoreRoute,
});

function appStoreRoute(): React.ReactElement {
  return <AppStorePage />;
}
