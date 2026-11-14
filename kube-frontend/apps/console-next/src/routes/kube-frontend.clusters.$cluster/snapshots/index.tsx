import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * The old console exposes the cluster snapshot list at two paths: `/volume-snapshots` and the
 * shorter `/snapshots/:namespace?`. The second one is a bookmark people still have, so it
 * redirects instead of 404-ing; the optional namespace never changed what was listed.
 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/snapshots/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/kube-frontend/clusters/$cluster/volume-snapshots',
      params: { cluster: params.cluster },
      replace: true,
    });
  },
});
