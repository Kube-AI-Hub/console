import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/**
 * `/kube-frontend/:workspace/clusters/:cluster/projects/:namespace/configmaps`
 *
 * A layout with no chrome of its own: it exists so the page can have a list
 * (`index.tsx`) and a detail (`$name.tsx`) without the list silently swallowing the
 * detail. In file-based routing `<page>.tsx` becomes the **parent** of
 * `<page>.$name.tsx`, so a list route that forgets the `<Outlet/>` renders itself
 * for both URLs — a defect that looks like "the detail page is broken" while the
 * list behind it is fine.
 *
 * The folder also keeps the three files of one page together, which is what makes
 * a page an object rather than three sibling filenames.
 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/configmaps')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}
