import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ChannelConfigPage } from '@/pages/platform/ChannelConfigPage';

/** `/kube-frontend/settings/mail` — 通知管理 · 邮件。 */
export const Route = createFileRoute('/kube-frontend/settings/mail/')({
  component: mailRoute,
});

function mailRoute(): React.ReactElement {
  return <ChannelConfigPage channel="mail" />;
}
