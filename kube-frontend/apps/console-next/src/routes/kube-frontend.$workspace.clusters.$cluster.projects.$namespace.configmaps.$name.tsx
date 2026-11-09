import { createFileRoute, Link } from '@tanstack/react-router';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Skeleton } from '@kube-ai-hub/ui';
import { ApiError } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import { useConfigMap } from '@/pages/configmaps/queries';

/**
 * ConfigMap detail.
 *
 * Read-only by design: the old console exposes "edit YAML" and "edit settings"
 * as modals, and rebuilding those comes after the framework proves itself on
 * the list. The route exists now so the list's link is real rather than a
 * placeholder that 404s.
 *
 * The path keeps the same shape as the list route, one segment deeper.
 */
export const Route = createFileRoute(
  '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/configmaps/$name',
)({
  component: ConfigMapDetailRoute,
});

function ConfigMapDetailRoute() {
  const t = useT();
  const { cluster, namespace, name, workspace } = Route.useParams();
  const query = useConfigMap({ cluster, namespace, name });

  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';

  return (
    <AiSurface as="section" aiId="configmap-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <div>
        <Link
          to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/configmaps"
          params={{ workspace, cluster, namespace }}
          className="text-xs text-ai-accent hover:underline"
          {...actionProps('configmap-detail:back')}
        >
          ← {t('detail.back')}
        </Link>
      </div>

      <h1 className="text-base font-semibold text-ai-fg">{name}</h1>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}

      {state === 'error' ? (
        <p role="alert" className="text-xs text-ai-danger">
          {query.error instanceof ApiError ? query.error.message : t('error.unknown')}
        </p>
      ) : null}

      {query.data ? (
        <section className="flex flex-col gap-2 rounded-ai-md border border-ai-line p-4">
          <h2 className="text-sm font-medium text-ai-fg">{t('detail.keys')}</h2>
          <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-[minmax(8rem,auto)_1fr]">
            {Object.entries(query.data.data).map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="truncate font-medium text-ai-fg-secondary">{key}</dt>
                <dd className="min-w-0 break-all text-ai-fg-muted">{value}</dd>
              </div>
            ))}
          </dl>
          {Object.keys(query.data.data).length === 0 ? (
            <p className="text-xs text-ai-fg-faint">-</p>
          ) : null}
        </section>
      ) : null}
    </AiSurface>
  );
}
