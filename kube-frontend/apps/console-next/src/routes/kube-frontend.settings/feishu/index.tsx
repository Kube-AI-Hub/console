import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ChannelConfigPage } from '@/pages/platform/ChannelConfigPage';

/** `/kube-frontend/settings/feishu` — 通知管理 · 飞书。 */
export const Route = createFileRoute('/kube-frontend/settings/feishu/')({
  component: feishuRoute,
});

function feishuRoute(): React.ReactElement {
  return <ChannelConfigPage channel="feishu" />;
}
