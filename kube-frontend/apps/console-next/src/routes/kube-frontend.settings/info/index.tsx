import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { PlatformInfoPage } from '@/pages/platform/PlatformInfoPage';

/** `/kube-frontend/settings/info` — 平台设置 · 平台信息。 */
export const Route = createFileRoute('/kube-frontend/settings/info/')({
  component: infoRoute,
});

function infoRoute(): React.ReactElement {
  return <PlatformInfoPage />;
}
