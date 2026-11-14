import { createFileRoute, redirect } from '@tanstack/react-router';

/** `/snapshots/<namespace>` was the same list scoped by project; it redirects to the list. */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/snapshots/$namespace')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/kube-frontend/clusters/$cluster/volume-snapshots',
      params: { cluster: params.cluster },
      replace: true,
    });
  },
});
