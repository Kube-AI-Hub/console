import * as React from 'react';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { Badge, Button, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { formatTimestamp } from '@/lib/time';
import { useFederatedObjectEvents } from './queries';

/**
 * Events about one federated object.
 *
 * The control plane reports its propagation work as events on the object
 * ("CreateInCluster", "AnnotationsNotSupported", "UpdateInClusterFailed" …), which is
 * the only place that says *why* a condition is False. Core events filtered by the
 * involved object are the contract: the namespace is the project's namespace and the
 * kind is the Federated kind, not the propagated kind.
 *
 * Three states are kept apart: loading, no events, and a failed read; a failed read
 * must not look like "nothing happened".
 */
export interface FederatedEventsPanelProps {
  namespace: string;
  name: string;
  kind: string;
  enabled: boolean;
  /** Handle prefix, e.g. `federated-project`; ids become `:events`, `:events:empty` … */
  aiPrefix: string;
}

export function FederatedEventsPanel({ namespace, name, kind, enabled, aiPrefix }: FederatedEventsPanelProps): React.ReactElement {
  const t = useT();
  const events = useFederatedObjectEvents({ namespace, name, kind, enabled });

  if (!enabled) {
    return (
      <p className="text-xs text-ai-fg-muted" data-ai-id={`${aiPrefix}:events:disabled`}>
        {t('fedprojects.events.disabled')}
      </p>
    );
  }

  if (events.isPending) return <Skeleton className="h-24 w-full" />;

  if (events.isError) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-xs text-ai-fg-muted" data-ai-id={`${aiPrefix}:events:error`}>
        {t('fedprojects.events.failed')}
        <Button size="sm" variant="ghost" {...actionProps(`${aiPrefix}:events:retry`)} onClick={() => void events.refetch()}>
          {t('common.retry')}
        </Button>
      </p>
    );
  }

  const rows = events.data ?? [];
  if (rows.length === 0) {
    return (
      <p className="text-xs text-ai-fg-muted" data-ai-id={`${aiPrefix}:events:empty`}>
        {t('fedprojects.events.empty')}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-ai-md border border-ai-line" data-ai-id={`${aiPrefix}:events`}>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-ai-fg-muted">
            <th className="px-3 pb-2 pt-2 font-medium">{t('fedprojects.events.column.type')}</th>
            <th className="px-3 pb-2 pt-2 font-medium">{t('fedprojects.events.column.reason')}</th>
            <th className="px-3 pb-2 pt-2 font-medium">{t('fedprojects.events.column.message')}</th>
            <th className="px-3 pb-2 pt-2 font-medium">{t('fedprojects.events.column.count')}</th>
            <th className="px-3 pb-2 pt-2 font-medium">{t('fedprojects.events.column.lastSeen')}</th>
            <th className="px-3 pb-2 pt-2 font-medium">{t('fedprojects.events.column.source')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((event, index) => (
            <tr
              key={`${event.reason}-${event.lastSeen}-${index}`}
              className="border-t border-ai-line"
              data-ai-row={`${event.reason}-${index}`}
            >
              <td className="px-3 py-1.5">
                <Badge tone={event.type === 'Warning' ? 'danger' : 'neutral'} dot>
                  {event.type || '-'}
                </Badge>
              </td>
              <td className="px-3 py-1.5 font-medium text-ai-fg-secondary">{event.reason || '-'}</td>
              <td className="max-w-[28rem] whitespace-normal px-3 py-1.5 text-ai-fg-secondary">{event.message || '-'}</td>
              <td className="px-3 py-1.5 tabular-nums text-ai-fg-muted">{event.count}</td>
              <td className="px-3 py-1.5 tabular-nums text-ai-fg-muted">
                {event.lastSeen ? formatTimestamp(event.lastSeen) : '-'}
              </td>
              <td className="px-3 py-1.5 font-mono text-[11px] text-ai-fg-muted">{event.source || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A label/annotation table, used by the detail's 元数据 tab.
 *
 * Keys are rendered as monospace because they are API identifiers; values wrap
 * instead of being clipped, because a propagated label value can be long.
 */
export interface FederatedKeyValuePanelProps {
  title: string;
  entries: Record<string, string>;
  emptyText: string;
  aiId: string;
}

export function FederatedKeyValuePanel({ title, entries, emptyText, aiId }: FederatedKeyValuePanelProps): React.ReactElement {
  const keys = Object.keys(entries).sort((a, b) => a.localeCompare(b));
  return (
    <section className="rounded-ai-md border border-ai-line p-4" data-ai-id={aiId}>
      <h2 className="mb-3 text-sm font-medium text-ai-fg">{title}</h2>
      {keys.length === 0 ? (
        <p className="text-xs text-ai-fg-muted" data-ai-id={`${aiId}:empty`}>
          {emptyText}
        </p>
      ) : (
        <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-[minmax(10rem,auto)_1fr]">
          {keys.map((key) => (
            <React.Fragment key={key}>
              <dt className="break-all font-mono text-[11px] text-ai-fg-muted">{key}</dt>
              <dd className="min-w-0 break-all text-ai-fg-secondary">{entries[key] || '-'}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}
    </section>
  );
}
