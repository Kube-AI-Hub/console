import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { userDetailApi, type LoginRecord } from '@kube-ai-hub/api-client';
import { Badge, Pagination, Skeleton, Table, type TableColumn } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { formatTimestamp } from '@/lib/time';

/**
 * Sign-in history for one platform user.
 *
 * The old console's only detail tab is this table: time, success/failed, source IP
 * and reason, with pagination when `totalItems` exceeds the page size. The new page
 * keeps the same columns and the same server query (`page` / `limit` /
 * `sortBy=createTime`) instead of a fixed first ten rows.
 */
export interface LoginHistoryPanelProps {
  name: string;
}

const PAGE_SIZE = 10;

function loginStatus(record: LoginRecord, t: ReturnType<typeof useT>) {
  if (record.success === true) {
    return <Badge tone="success">{t('platform.user.detail.loginSuccess')}</Badge>;
  }
  if (record.success === false) {
    return <Badge tone="danger">{t('platform.user.detail.loginFailed')}</Badge>;
  }
  return <span className="text-ai-fg-muted">-</span>;
}

export function LoginHistoryPanel({ name }: LoginHistoryPanelProps): React.ReactElement {
  const t = useT();
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    setPage(1);
  }, [name]);

  const records = useQuery({
    queryKey: ['user-login-records', name, page, PAGE_SIZE],
    queryFn: ({ signal }) => userDetailApi(apiClient).loginRecords({ name, page, limit: PAGE_SIZE, signal }),
  });

  const items = records.data?.items ?? [];
  const total = records.data?.total ?? 0;

  const columns = React.useMemo<Array<TableColumn<LoginRecord>>>(
    () => [
      {
        key: 'time',
        title: t('platform.user.detail.loginTime'),
        render: (row) => <span className="tabular-nums text-ai-fg-secondary">{row.time ? formatTimestamp(row.time) : '-'}</span>,
      },
      {
        key: 'status',
        title: t('platform.user.detail.loginStatus'),
        width: 120,
        render: (row, _index) => loginStatus(row, t),
      },
      {
        key: 'sourceIP',
        title: t('platform.user.detail.sourceIP'),
        width: 160,
        hideOnMobile: true,
        render: (row) => <span className="font-mono text-xs text-ai-fg-secondary">{row.sourceIP || '-'}</span>,
      },
      {
        key: 'reason',
        title: t('platform.user.detail.reason'),
        render: (row) => <span className="text-ai-fg-muted">{row.reason || '-'}</span>,
      },
    ],
    [t],
  );

  return (
    <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="user-detail:logins">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-ai-fg">{t('platform.user.detail.logins')}</h2>
        {records.isSuccess ? (
          <span className="text-xs text-ai-fg-muted" data-ai-id="user-detail:login-total">
            {t('platform.user.detail.loginTotal', { count: total })}
          </span>
        ) : null}
      </header>

      {records.isPending ? <Skeleton className="h-20 w-full" /> : null}
      {records.isError ? (
        <p className="text-xs text-ai-fg-muted">{t('platform.user.detail.loginsUnavailable')}</p>
      ) : null}
      {records.isSuccess && items.length === 0 ? (
        <p className="text-xs text-ai-fg-muted">{t('platform.user.detail.noLogins')}</p>
      ) : null}
      {records.isSuccess && items.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-3 overflow-x-auto" data-ai-id="user-detail:login-list">
          <Table
            columns={columns}
            rows={items}
            rowKey={(row) => row.name}
            rowAttributes={(row) => ({ 'data-ai-row': row.name })}
          />
          {total > PAGE_SIZE ? (
            <Pagination
              aiPrefix="user-detail:logins"
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onChange={setPage}
              labels={{ previous: t('table.previous'), next: t('table.next') }}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
