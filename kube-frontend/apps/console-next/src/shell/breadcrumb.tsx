import * as React from 'react';
import { Icon } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { useT } from '@/i18n';
import { areaPages, type Area } from '@/areas/registry';

/**
 * The breadcrumb that sits under an area's tabs.
 *
 * Tabs answer "which page am I on"; the breadcrumb answers "how do I get back
 * from here" once the page has depth — `配置 / 保密字典 / web-tls`. The old console
 * had the same two levels (sidebar tabs plus the detail page's own breadcrumb);
 * here they are rendered together so the reader never loses the way home.
 *
 * Pages opt into a trailing crumb by rendering their own `<AreaCrumbs/>`; until
 * then the bar shows the scope and the current page, which is already better than
 * a blank strip.
 */
export interface AreaBreadcrumbProps {
  area: Area;
  activeKey: string;
  scopeRoot: string;
  pathname: string;
  onNavigate?: (href: string, event: React.MouseEvent<HTMLAnchorElement>) => boolean;
  /** Object name of an open detail view, when there is one. */
  leaf?: string | undefined;
}

export function areaBreadcrumb({ area, activeKey, leaf }: AreaBreadcrumbProps): React.ReactNode {
  return <AreaCrumbs area={area} activeKey={activeKey} {...(leaf ? { leaf } : {})} />;
}

/**
 * Rendered inside `AreaTabs`' breadcrumb slot.
 *
 * The area's own tab already names the page, so the crumb repeats only what the
 * tab cannot show: the project, and — when a detail page opens — the object.
 * Repeating the page name would make every crumb read "配置 / 配置字典" for no gain.
 */
export function AreaCrumbs({ area, activeKey, leaf }: { area: Area; activeKey: string; leaf?: string }): React.ReactElement {
  const t = useT();
  const page = areaPages(area).find((item) => item.key === activeKey);
  return (
    <ol className="flex min-w-0 items-center gap-1" data-ai-id="area-crumb-list">
      <li className="flex shrink-0 items-center gap-1 text-ai-fg-muted">
        <Icon name="home" size={12} />
        {t('breadcrumb.home')}
      </li>
      <Separator />
      <li className="shrink-0 truncate text-ai-fg-muted">{t(area.titleKey)}</li>
      {page && leaf ? (
        <>
          <Separator />
          <li className="shrink-0 truncate text-ai-fg-secondary">{t(page.titleKey)}</li>
          <Separator />
          <li className="truncate font-medium text-ai-fg" data-ai-id="area-crumb-leaf">
            {leaf}
          </li>
        </>
      ) : (
        <>
          <Separator />
          <li className="truncate font-medium text-ai-fg" data-ai-id="area-crumb-page">
            {page ? t(page.titleKey) : ''}
          </li>
        </>
      )}
    </ol>
  );
}

function Separator(): React.ReactElement {
  return (
    <li aria-hidden="true" className="shrink-0 text-ai-fg-faint">
      <Icon name="chevron-right" size={10} />
    </li>
  );
}

/** A crumb the page appends itself (a detail object's name), for its own placement. */
export function PageCrumb({ label, aiId }: { label: string; aiId: string }): React.ReactElement {
  return (
    <span className="truncate font-medium text-ai-fg" {...actionProps(aiId)}>
      {label}
    </span>
  );
}
