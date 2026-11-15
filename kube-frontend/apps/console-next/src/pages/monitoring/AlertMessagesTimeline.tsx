import * as React from 'react';
import { ApiError, type AlertMessageScope } from '@kube-ai-hub/api-client';
import { AiButton, Badge, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { errorMessage } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { alertSeverityLabel, alertStateLabel } from './alertLabels';
import { useAlertMessages } from './queries';

/**
 * Alert messages of one policy, newest first, as a timeline.
 *
 * The old console opened the policy detail with two tabs (规则 / 告警消息); the
 * message tab is the same data this section reads. It is a section rather than a
 * tab because the reader's question on this page is "are any of these rules
 * firing right now", and hiding that behind a tab makes the detail page answer
 * only half the question.
 *
 * The query filters **server-side** by `rule_group=<name>` (`label_filters`).
 * Filtering the rows of the current page client-side would show "no alerts" for a
 * policy whose alerts simply are not on page 1.
 */
export interface AlertMessagesTimelineProps {
  scope: AlertMessageScope;
  /** Required for project scope: the collection is namespaced. */
  namespace?: string;
  ruleGroup: string;
}

const PAGE_SIZE = 10;

export function AlertMessagesTimeline({ scope, namespace, ruleGroup }: AlertMessagesTimelineProps): React.ReactElement {
  const t = useT();
  const [page, setPage] = React.useState(1);

  // A different policy (or scope) is a different history; page 2 of the old one is
  // meaningless for the new one.
  React.useEffect(() => setPage(1), [scope, namespace, ruleGroup]);

  const query = useAlertMessages({
    scope,
    ...(namespace ? { namespace } : {}),
    ruleGroup,
    page,
    // No pager on this timeline: it shows the most recent page of one rule's alerts and the
    // detail page above it carries the paged list. A size picker here would have nothing to act on.
    pageSize: PAGE_SIZE, // pager-less on purpose
  });
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const state = query.isPending ? 'loading' : query.isError ? 'error' : items.length === 0 ? 'empty' : 'ready';
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const permissionDenied = query.error instanceof ApiError && query.error.isPermission;

  return (
    <section
      className="flex flex-col gap-3 rounded-ai-md border border-ai-line p-4"
      data-ai-id="alertingrules:detail:messages"
      data-ai-state={state}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-ai-fg">{t('monitoring.ruleGroups.detail.messages')}</h2>
        {state === 'ready' ? (
          <span className="text-[11px] text-ai-fg-muted" data-ai-id="alertingrules:detail:messages:total">
            {t('monitoring.ruleGroups.detail.messagesTotal', { count: total })}
          </span>
        ) : null}
      </header>

      {state === 'loading' ? <Skeleton className="h-24 w-full" /> : null}

      {state === 'error' ? (
        <div className="flex flex-col gap-2 rounded-ai-sm border border-ai-line p-3 text-xs" role="alert" data-ai-id="alertingrules:detail:messages:error">
          <p className="text-ai-danger">{errorMessage(t, query.error)}</p>
          {/* Retrying a 403 can only fail again; the panel states the reason instead. */}
          {permissionDenied ? null : (
            <AiButton aiId="alertingrules:detail:messages:retry" size="sm" onClick={() => void query.refetch()}>
              {t('common.retry')}
            </AiButton>
          )}
        </div>
      ) : null}

      {state === 'empty' ? (
        <div className="flex flex-col gap-1 text-xs" data-ai-id="alertingrules:detail:messages:empty">
          <p className="text-ai-fg-secondary">{t('monitoring.ruleGroups.detail.messagesEmpty')}</p>
          <p className="text-ai-fg-muted">{t('monitoring.ruleGroups.detail.messagesEmptyDescription')}</p>
        </div>
      ) : null}

      {state === 'ready' ? (
        <>
          <ol className="flex flex-col gap-3" data-ai-id="alertingrules:detail:messages:list">
            {items.map((message) => (
              <li
                key={message.id}
                className="flex flex-col gap-1 border-l-2 border-ai-line pl-3"
                data-ai-row={message.id}
              >
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <time className="tabular-nums text-ai-fg-muted" dateTime={message.triggeredAt}>
                    {formatTimestamp(message.triggeredAt)}
                  </time>
                  <Badge tone={message.state === 'firing' ? 'danger' : message.state === 'pending' ? 'warning' : 'success'}>
                    {alertStateLabel(t, message.state)}
                  </Badge>
                  <span className="text-ai-fg-muted">{alertSeverityLabel(t, message.severity)}</span>
                </div>
                <p className="text-xs font-medium text-ai-fg">{message.summary || message.name || '-'}</p>
                {message.message ? <p className="text-xs text-ai-fg-secondary">{message.message}</p> : null}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ai-fg-muted">
                  {message.target ? (
                    <span>
                      {t('monitoring.field.target')}: {message.target}
                    </span>
                  ) : null}
                  {message.value ? (
                    <span>
                      {t('monitoring.field.value')}: <span className="tabular-nums">{message.value}</span>
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>

          {pages > 1 ? (
            <div className="flex items-center justify-end gap-2 text-[11px] text-ai-fg-muted">
              <span data-ai-id="alertingrules:detail:messages:page">
                {t('monitoring.ruleGroups.detail.messagesPage', { page, pages })}
              </span>
              <AiButton
                aiId="alertingrules:detail:messages:prev"
                size="sm"
                variant="secondary"
                disabled={page <= 1 || query.isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                {t('table.previous')}
              </AiButton>
              <AiButton
                aiId="alertingrules:detail:messages:next"
                size="sm"
                variant="secondary"
                disabled={page >= pages || query.isFetching}
                onClick={() => setPage((current) => Math.min(pages, current + 1))}
              >
                {t('table.next')}
              </AiButton>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
