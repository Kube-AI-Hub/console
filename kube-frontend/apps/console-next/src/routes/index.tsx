import { createFileRoute, Link } from '@tanstack/react-router';

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
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-base font-semibold text-ai-fg">智算平台</h1>
      <p className="text-xs text-ai-fg-muted">选择模块进入。</p>
      <ul className="flex flex-col gap-2 text-sm">
        <li>
          <Link to="/c/$cluster/p/$namespace/configmaps" params={{ cluster: 'host', namespace: 'default' }} className="text-ai-accent hover:underline">
            配置字典
          </Link>
        </li>
      </ul>
    </div>
  );
}
