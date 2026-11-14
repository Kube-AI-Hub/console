import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ChannelConfigPage } from '@/pages/platform/ChannelConfigPage';

/** `/kube-frontend/settings/dingtalk` — 通知管理 · �� */
export const Route = createFileRoute('/kube-frontend/settings/dingtalk/')({
  component: channelRoute,
});

function channelRoute(): React.ReactElement {
  return <ChannelConfigPage channel="dingtalk" />;
}
