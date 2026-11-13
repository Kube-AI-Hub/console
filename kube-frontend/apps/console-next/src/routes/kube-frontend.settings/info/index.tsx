import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { PlatformSettingsPage } from '@/pages/platform/PlatformSettingsPage';

/** `/kube-frontend/settings/info` — 平台设置。 */
export const Route = createFileRoute('/kube-frontend/settings/info/')({
  component: settingsRoute,
});

function settingsRoute(): React.ReactElement {
  return <PlatformSettingsPage view="info" />;
}
