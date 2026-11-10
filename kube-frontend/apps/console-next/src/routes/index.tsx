import { createFileRoute, Link } from '@tanstack/react-router';
import { useT } from '@/i18n';

/**
 * Landing route.
 *
 * Deliberately thin: it names the modules that exist rather than pretending to
 * be a dashboard. A dashboard built before the modules do would be a screen of
 * zeros that has to be rewritten on the first real page.
 */
export const Route = createFileRoute('/')({
  component: IndexPage,
});

function IndexPage() {
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-base font-semibold text-ai-fg">{t('app.name')}</h1>
      <p className="text-xs text-ai-fg-muted">{t('index.chooseModule')}</p>
      <ul className="flex flex-col gap-2 text-sm">
        <li>
          <Link
            to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/configmaps"
            params={{ workspace: 'system-workspace', cluster: 'host', namespace: 'default' }}
            className="text-ai-accent hover:underline"
          >
            {t('configmaps.title')}
          </Link>
        </li>
      </ul>
    </div>
  );
}
