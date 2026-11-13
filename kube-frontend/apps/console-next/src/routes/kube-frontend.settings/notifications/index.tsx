import * as React from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * `/kube-frontend/settings/notifications` — the old console's notification-configuration
 * entry.
 *
 * The channels are pages of their own now (邮件 first), so this path is kept as a
 * redirect rather than a second listing. It used to be a read-only summary of "which
 * channels have secrets", which answered a question nobody asked: whether a channel is
 * configured is visible on the channel's own page.
 */
export const Route = createFileRoute('/kube-frontend/settings/notifications/')({
  beforeLoad: () => {
    throw redirect({ to: '/kube-frontend/settings/mail' });
  },
  component: Redirecting,
});

function Redirecting(): React.ReactElement {
  return <React.Fragment />;
}
