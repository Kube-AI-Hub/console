import * as React from 'react';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { Button, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { formatTimestamp } from '@/lib/time';
import { segmentOf, useFederatedResources, type FederatedResourceObject } from './queries';

/**
 * One read-only tab of a federated project: the project's objects across a group of
 * Federated resource types.
 *
 * The tab owns all three transient states: loading while any of its collections is in
 * flight, a failure sentence with retry when any collection failed, and an explicit
 * empty sentence when the group has no objects. A tab never renders an empty table on
 * failure — "nothing federated" and "could not read" need different reactions.
 */
export interface FederatedResourceTableProps {
  /** Workspace segment of the project route, for the object links. */
  workspace: string;
  /** The federated project's name (its detail route segment). */
  projectName: string;
  /** The federated namespace (equal to the project name in practice). */
  namespace: string;
  /** Collection names from discovery, e.g. `federateddeployments`. */
  plurals: readonly string[];
  /** Prefix for this tab's handles, e.g. `federated-project:resources:workloads`. */
  aiId: string;
}

function sortRows(rows: FederatedResourceObject[]): FederatedResourceObject[] {
  return [...rows].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}

export function FederatedResourceTable({
  workspace,
  projectName,
  namespace,
  plurals,
  aiId,
}: FederatedResourceTableProps): React.ReactElement {
  const t = useT();
  const results = useFederatedResources(namespace, plurals);
  const pending = results.some((result) => result.isPending);
  const failed = results.some((result) => result.isError);
  const rows = React.useMemo(
    () => sortRows(results.flatMap((result) => result.data ?? [])),
    [results],
  );
  const retry = () => results.forEach((result) => void result.refetch());

  if (pending) return <Skeleton className="h-32 w-full" />;

  if (failed) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-xs text-ai-fg-muted" data-ai-id={aiId + ':error'}>
        {t('fedprojects.resources.failed')}
        <Button size="sm" variant="ghost" {...actionProps(aiId + ':retry')} onClick={retry}>
          {t('common.retry')}
        </Button>
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-xs text-ai-fg-muted" data-ai-id={aiId + ':empty'}>
        {t('fedprojects.resources.empty')}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-ai-md border border-ai-line" data-ai-id={aiId}>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-ai-fg-muted">
            <th className="px-3 pb-2 pt-2 font-medium">{t('workspace.field.name')}</th>
            <th className="px-3 pb-2 pt-2 font-medium">{t('fedprojects.detail.column.kind')}</th>
            <th className="px-3 pb-2 pt-2 font-medium">{t('workspace.field.createdAt')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.plural + '/' + row.name} className="border-t border-ai-line" data-ai-row={row.kind + '/' + row.name}>
              <td className="px-3 py-1.5 font-mono text-[11px]">
                <a
                  href={
                    '/kube-frontend/workspaces/' +
                    encodeURIComponent(workspace) +
                    '/federatedprojects/' +
                    encodeURIComponent(projectName) +
                    '/' +
                    segmentOf(row.plural) +
                    '/' +
                    encodeURIComponent(row.name)
                  }
                  className="text-ai-link hover:underline"
                  {...actionProps('federated-project:resource:' + segmentOf(row.plural) + '/' + row.name)}
                >
                  {row.name}
                </a>
              </td>
              <td className="px-3 py-1.5 font-mono text-[11px] text-ai-fg-secondary">{row.kind || '-'}</td>
              <td className="px-3 py-1.5 tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
