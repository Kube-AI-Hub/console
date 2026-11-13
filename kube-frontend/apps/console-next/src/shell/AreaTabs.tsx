import * as React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Icon, cn } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { useT } from '@/i18n';
import { areaPages, type Area, type AreaPage } from '@/areas/registry';

/**
 * The tab bar of one area: 配置字典 / 保密字典 / 服务账户 inside 配置.
 *
 * This is what makes an area feel like one window instead of a series of pages.
 * The old console showed a horizontal tab strip under the sidebar for exactly the
 * same reason; a sidebar entry per page stops scaling past about eight pages,
 * which the project console passes twice over.
 *
 * Every tab is a real link (`<a href>`), so middle-click, Ctrl-click and "open in
 * new tab" work, and the shell's `onNavigate` makes a plain click a client-side
 * transition. Depths beyond the page (a detail view) are added by the page itself
 * through `breadcrumb`, not by the tab bar.
 */
export interface AreaTabsProps {
  area: Area;
  /** Route segment of the current page, used to mark the active tab. */
  activeKey: string;
  /** Prefix the page paths are appended to (a project or cluster root). */
  scopeRoot: string;
  /**
   * Called for a plain click. The shell passes one handler to both the sidebar and
   * the tabs; it returns false for modified clicks so the browser keeps them.
   */
  onNavigate?: (href: string, event: React.MouseEvent<HTMLAnchorElement>) => boolean;
  /** Trailing breadcrumb ("保密字典 / web-tls"), rendered after the tabs. */
  breadcrumb?: React.ReactNode;
}

export function AreaTabs({ area, activeKey, scopeRoot, onNavigate, breadcrumb }: AreaTabsProps): React.ReactElement {
  const t = useT();
  const navigate = useNavigate();
  const pages = areaPages(area);

  const handleClick = (href: string, event: React.MouseEvent<HTMLAnchorElement>): void => {
    if (event.defaultPrevented) return;
    if (onNavigate?.(href, event)) {
      event.preventDefault();
      return;
    }
    // Modified clicks stay with the browser (`onNavigate` returned false), but a
    // plain click inside the app still must not reload the document — this is the
    // same rule as the sidebar's, so the fallback repeats it.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    void navigate({ href });
  };

  return (
    <div className="flex flex-col gap-2">
      <nav
        aria-label={t(area.titleKey)}
        className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-ai-line pb-px [overscroll-x-contain]"
        data-ai-id={`area-tabs:${area.key}`}
      >
        <span className="mr-1 flex items-center gap-1.5 whitespace-nowrap px-1 text-xs font-medium text-ai-fg-muted">
          <Icon name={area.icon} size={13} />
          {t(area.titleKey)}
        </span>
        {pages.map((page) => (
          <Tab
            key={page.key}
            page={page}
            href={`${scopeRoot.replace(/\/+$/, '')}/${page.path}`}
            active={page.key === activeKey}
            onClick={handleClick}
          />
        ))}
      </nav>
      {breadcrumb ? (
        <div className="flex min-w-0 items-center gap-1 text-xs text-ai-fg-muted" data-ai-id="area-breadcrumb">
          {breadcrumb}
        </div>
      ) : null}
    </div>
  );
}

function Tab({
  page,
  href,
  active,
  onClick,
}: {
  page: AreaPage;
  href: string;
  active: boolean;
  onClick: (href: string, event: React.MouseEvent<HTMLAnchorElement>) => void;
}): React.ReactElement {
  const t = useT();
  const planned = page.status === 'planned';
  const className = cn(
    // A tab the reader is not on is quiet; the active one carries the accent and a
    // bottom rule that sits on the container's own border.
    /*
     * 44px on touch, 36px on a pointer device. The rest of the shell already uses this
     * pair (`h-11 sm:h-9`) because 36px is a comfortable mouse target and too small for
     * a thumb; the tab strip had been fixed at 36px, which a phone measurement caught.
     */
    'relative -mb-px inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-t-ai-md px-3 text-xs transition-colors duration-ai-fast sm:h-9',
    active
      ? 'border-b-2 border-ai-accent font-medium text-ai-accent'
      : 'border-b-2 border-transparent text-ai-fg-secondary hover:text-ai-fg',
    planned && 'cursor-not-allowed opacity-60',
  );

  if (planned) {
    // Rendered but inert: a disabled `<a>` is still announced as a link, so it is
    // a span with the state spelled out instead.
    return (
      <span
        className={className}
        aria-disabled="true"
        title={t('area.notMigrated')}
        {...actionProps(`area-tabs:${page.key}`, { label: `${t(page.titleKey)}（${t('area.notMigrated')}）` })}
      >
        {t(page.titleKey)}
      </span>
    );
  }

  return (
    <a
      href={href}
      className={cn(className, 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-ring')}
      aria-current={active ? 'page' : undefined}
      {...actionProps(`area-tabs:${page.key}`, { label: t(page.titleKey) })}
      onClick={(event) => onClick(href, event)}
    >
      {t(page.titleKey)}
    </a>
  );
}
