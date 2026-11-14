import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * The old workspace console splits 概览 and 基本信息; the new one shows the basics on the
 * overview, because a page whose only content is six label/value rows does not earn a route.
 * The old address still redirects instead of 404-ing.
 */
export const Route = createFileRoute('/kube-frontend/workspaces/$workspace/base-info/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/kube-frontend/workspaces/$workspace/overview',
      params: { workspace: params.workspace },
      replace: true,
    });
  },
});
