import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * A snapshot list points at a content object by name; there is no content collection page of
 * its own. The bare path therefore redirects to the snapshot list rather than rendering a
 * table with a single narrow column.
 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/volume-snapshot-content/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/kube-frontend/clusters/$cluster/volume-snapshots',
      params: { cluster: params.cluster },
      replace: true,
    });
  },
});
