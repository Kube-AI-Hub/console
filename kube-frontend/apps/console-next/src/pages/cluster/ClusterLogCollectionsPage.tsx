import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { clusterLoggingApi } from '@kube-ai-hub/api-client';
import {
  AiSurface,
  Badge,
  Button,
  Empty,
  Modal,
  Skeleton,
  Tabs,
  TabsContent,
} from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { formatTimestamp } from '@/lib/time';
import { toYaml } from '@/components/resource/yaml';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import {
  LOGGING_CLASSES,
  matchSummary,
  useLoggingCollections,
  useLoggingSources,
  type LoggingClass,
  type LoggingCollection,
  type LoggingSource,
} from './logCollectionsQueries';

/**
 * 集群日志收集.
 *
 * The logging operator decides what is collected with three object kinds: the
 * FluentBit collector, the Inputs that tail sources, and the Outputs (receivers)
 * that write records. The old console groups the receivers into three tabs —
 * container logs / events / auditing — by the `logging.kubesphere.io/component`
 * label, and so does this page; the label is the same value the operator writes,
 * not a client-side guess from the match expression.
 *
 * Read-only: editing a pipeline needs its own validation flow, so nothing here
 * writes. The detail dialog is the old console's receiver detail page — the
 * attributes, which sources feed the output, and the object's YAML.
 */
export interface ClusterLogCollectionsPageProps {
  cluster: string;
}

const AI_ID = 'cluster-log-collections';

const CLASS_LABEL_KEYS: Record<LoggingClass, 'cluster.logCollections.tab.logging' | 'cluster.logCollections.tab.events' | 'cluster.logCollections.tab.auditing'> = {
  logging: 'cluster.logCollections.tab.logging',
  events: 'cluster.logCollections.tab.events',
  auditing: 'cluster.logCollections.tab.auditing',
};

/** The tab handles are literals so a reader (and the automation) can grep for them. */
const TAB_AI_IDS: Record<LoggingClass, string> = {
  logging: 'cluster-log-collections:tab:logging',
  events: 'cluster-log-collections:tab:events',
  auditing: 'cluster-log-collections:tab:auditing',
};

export function ClusterLogCollectionsPage({ cluster }: ClusterLogCollectionsPageProps): React.ReactElement {
  const t = useT();
  const api = React.useMemo(() => clusterLoggingApi(apiClient), []);
  const collectors = useQuery({ queryKey: ['logging-collectors', cluster], queryFn: ({ signal }) => api.collectors({ signal }) });
  const collections = useLoggingCollections(cluster);
  const sources = useLoggingSources(cluster);

  const namespace = collectors.data?.[0]?.namespace ?? '';
  const pods = useQuery({
    queryKey: ['logging-collector-pods', namespace],
    queryFn: ({ signal }) => api.podStats({ namespace, signal }),
    enabled: Boolean(namespace),
  });

  const [tab, setTab] = React.useState<LoggingClass>('logging');
  const [detail, setDetail] = React.useState<LoggingCollection | null>(null);

  const allCollections = collections.data ?? [];
  const allSources = sources.data ?? [];
  const pending = collectors.isPending || collections.isPending || sources.isPending;
  const error = collectors.error ?? collections.error ?? sources.error;
  const empty = (collectors.data?.length ?? 0) === 0 && allCollections.length === 0 && allSources.length === 0;
  const state = pending ? 'loading' : error ? 'error' : empty ? 'empty' : 'ready';

  const podsLabel = pods.data ? pods.data.running + '/' + pods.data.total : '';

  const retry = React.useCallback(() => {
    void collectors.refetch();
    void collections.refetch();
    void sources.refetch();
  }, [collectors, collections, sources]);

  const tabs = LOGGING_CLASSES.map((entry) => ({
    value: entry,
    label: t(CLASS_LABEL_KEYS[entry]),
    aiId: TAB_AI_IDS[entry],
    count: allCollections.filter((row) => row.className === entry).length,
  }));

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="cluster-log-collections:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={error} onRetry={retry} retryAiId={AI_ID + ':retry'} />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="cluster-log-collections:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-ai-fg">{t('cluster.logCollections.title')}</h1>
        <p className="text-xs text-ai-fg-muted">{t('cluster.logCollections.description')}</p>
      </header>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}

      {state === 'ready' || state === 'empty' ? (
        <React.Fragment>
          <section className="rounded-lg border border-ai-line bg-ai-surface p-4" data-ai-id={AI_ID + ':collectors'}>
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('cluster.logCollections.collectors')}</h2>
            {collectors.data && collectors.data.length === 0 ? (
              <p className="text-xs text-ai-fg-muted">{t('cluster.logCollections.noCollectors')}</p>
            ) : null}
            <ul className="flex flex-col gap-3 text-sm" data-ai-id={AI_ID + ':collector-list'}>
              {(collectors.data ?? []).map((collector) => (
                <li key={collector.namespace + '/' + collector.name} className="flex flex-col gap-2" data-ai-row={collector.name}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ai-fg">{collector.name}</span>
                    <Badge tone={pods.data && pods.data.total > 0 && pods.data.running === pods.data.total ? 'success' : 'warning'}>
                      {podsLabel ? t('cluster.logCollections.podsReady') + ' ' + podsLabel : t('cluster.logCollections.unknownState')}
                    </Badge>
                  </div>
                  <dl className="grid grid-cols-1 gap-x-8 gap-y-1 text-xs sm:grid-cols-2">
                    <DefinitionRow label={t('cluster.logCollections.namespace')} value={collector.namespace} />
                    <DefinitionRow label={t('cluster.logCollections.config')} value={collector.configName || '-'} />
                    <DefinitionRow label={t('cluster.logCollections.image')} value={collector.image || '-'} />
                  </dl>
                </li>
              ))}
            </ul>
          </section>

          <Tabs value={tab} onValueChange={(next) => setTab(next as LoggingClass)} items={tabs}>
            {LOGGING_CLASSES.map((entry) => {
              const classCollections = allCollections.filter((row) => row.className === entry);
              const classSources = allSources.filter((row) => row.className === entry);
              return (
                <TabsContent key={entry} value={entry} forceMount>
                  <div
                    data-ai-id={AI_ID + ':panel:' + entry}
                    hidden={tab !== entry}
                    className="flex flex-col gap-4 pt-3"
                  >
                    <CollectionTable rows={classCollections} onOpen={(row) => setDetail(row)} />
                    <SourceTable rows={classSources} />
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </React.Fragment>
      ) : null}

      <DetailDialog detail={detail} sources={allSources} onOpenChange={(open) => (open ? undefined : setDetail(null))} />
    </AiSurface>
  );
}

/* ---------------- 收集项（outputs） ---------------- */

function CollectionTable({
  rows,
  onOpen,
}: {
  rows: LoggingCollection[];
  onOpen: (row: LoggingCollection) => void;
}): React.ReactElement {
  const t = useT();
  return (
    <section data-ai-id={AI_ID + ':output-list'} className="rounded-lg border border-ai-line bg-ai-surface p-4">
      <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('cluster.logCollections.outputsInClass')}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-ai-line text-left text-ai-fg-muted">
              <th className="py-2 pr-3 font-medium">{t('resource.field.name')}</th>
              <th className="py-2 pr-3 font-medium">{t('cluster.column.status')}</th>
              <th className="py-2 pr-3 font-medium">{t('cluster.logCollections.column.match')}</th>
              <th className="py-2 pr-3 font-medium">{t('cluster.logCollections.column.type')}</th>
              <th className="py-2 font-medium">{t('resource.field.createdAt')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.name}
                data-ai-row={row.name}
                data-ai-id={AI_ID + ':row:' + row.name}
                className="border-b border-ai-line last:border-b-0"
              >
                <td className="py-2 pr-3">
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto px-0 py-0 text-left text-xs font-medium"
                    data-ai-id={AI_ID + ':row:' + row.name + ':open'}
                    onClick={() => onOpen(row)}
                  >
                    {row.name}
                  </Button>
                </td>
                <td className="py-2 pr-3">
                  <Badge tone={row.enabled ? 'success' : 'neutral'}>
                    {row.enabled ? t('cluster.logCollections.enabled') : t('cluster.logCollections.disabled')}
                  </Badge>
                </td>
                <td className="py-2 pr-3">
                  <span className="truncate font-mono text-[11px] text-ai-fg-secondary">{matchSummary(t, row) || '-'}</span>
                </td>
                <td className="py-2 pr-3">
                  <Badge tone="neutral">{row.plugin || '-'}</Badge>
                </td>
                <td className="py-2 tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? (
        <Empty
          className="py-6"
          title={t('cluster.logCollections.emptyClass.title')}
          description={t('cluster.logCollections.emptyClass.description')}
        />
      ) : null}
    </section>
  );
}

/* ---------------- 采集输入（inputs） ---------------- */

function SourceTable({ rows }: { rows: LoggingSource[] }): React.ReactElement {
  const t = useT();
  return (
    <section data-ai-id={AI_ID + ':input-list'} className="rounded-lg border border-ai-line bg-ai-surface p-4">
      <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('cluster.logCollections.inputsInClass')}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-ai-line text-left text-ai-fg-muted">
              <th className="py-2 pr-3 font-medium">{t('resource.field.name')}</th>
              <th className="py-2 pr-3 font-medium">{t('cluster.logCollections.column.plugin')}</th>
              <th className="py-2 pr-3 font-medium">{t('cluster.logCollections.column.tag')}</th>
              <th className="py-2 font-medium">{t('cluster.logCollections.column.source')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} data-ai-row={row.name} className="border-b border-ai-line last:border-b-0">
                <td className="py-2 pr-3 font-medium text-ai-fg">{row.name}</td>
                <td className="py-2 pr-3">
                  <Badge tone="neutral">{row.plugin || '-'}</Badge>
                </td>
                <td className="py-2 pr-3 font-mono text-[11px] text-ai-fg-secondary">{row.tag || '-'}</td>
                <td className="py-2 font-mono text-[11px] text-ai-fg-muted">{row.source || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? <p className="py-3 text-xs text-ai-fg-muted">{t('cluster.logCollections.emptyInputs')}</p> : null}
    </section>
  );
}

/* ---------------- 收集项详情（只读） ---------------- */

function DetailDialog({
  detail,
  sources,
  onOpenChange,
}: {
  detail: LoggingCollection | null;
  sources: LoggingSource[];
  onOpenChange: (open: boolean) => void;
}): React.ReactElement {
  const t = useT();
  const classSources = detail ? sources.filter((source) => source.className === detail.className) : [];
  const match = detail ? matchSummary(t, detail) : '';

  return (
    <Modal
      open={detail !== null}
      onOpenChange={onOpenChange}
      size="xl"
      title={detail?.name ?? t('cluster.logCollections.detail.title')}
      description={t('cluster.logCollections.detail.title')}
      closeAiId={AI_ID + ':detail-close'}
      footer={
        <div className="flex justify-end">
          <Button size="sm" variant="secondary" data-ai-id={AI_ID + ':detail-ok'} onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </div>
      }
    >
      {detail ? (
        <div data-ai-id={AI_ID + ':detail'} className="flex flex-col gap-4 text-xs">
          <section>
            <h3 className="mb-2 text-sm font-medium text-ai-fg">{t('cluster.logCollections.detail.attributes')}</h3>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
              <DefinitionRow label={t('resource.field.name')} value={detail.name} />
              <DefinitionRow label={t('cluster.logCollections.column.class')} value={t(CLASS_LABEL_KEYS[detail.className])} />
              <DefinitionRow label={t('cluster.logCollections.column.type')} value={detail.plugin || '-'} />
              <DefinitionRow
                label={t('cluster.column.status')}
                value={detail.enabled ? t('cluster.logCollections.enabled') : t('cluster.logCollections.disabled')}
              />
              <DefinitionRow label={t('cluster.logCollections.namespace')} value={detail.namespace || '-'} />
              <DefinitionRow label={t('resource.field.createdAt')} value={formatTimestamp(detail.createdAt)} />
              <DefinitionRow label={t('cluster.logCollections.address')} value={detail.address || '-'} />
              <DefinitionRow label={t('cluster.logCollections.indexPrefix')} value={detail.indexPrefix || '-'} />
            </dl>
          </section>

          <section data-ai-id={AI_ID + ':detail-match'}>
            <h3 className="mb-2 text-sm font-medium text-ai-fg">{t('cluster.logCollections.detail.matchSection')}</h3>
            <p className="mb-2 leading-5 text-ai-fg-muted">{t('cluster.logCollections.detail.matchHint')}</p>
            <DefinitionRow label={t('cluster.logCollections.column.match')} value={match || '-'} />
            <h4 className="mb-1 mt-3 text-xs font-medium text-ai-fg">{t('cluster.logCollections.inputsInClass')}</h4>
            {classSources.length > 0 ? (
              <ul className="flex flex-col gap-1 text-ai-fg-secondary">
                {classSources.map((source) => (
                  <li key={source.name} className="flex flex-wrap items-baseline gap-2">
                    <span className="font-medium text-ai-fg">{source.name}</span>
                    <span className="font-mono text-[11px] text-ai-fg-muted">{source.tag || '-'}</span>
                    <span className="font-mono text-[11px] text-ai-fg-muted">{source.source || '-'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ai-fg-muted">{t('cluster.logCollections.detail.noInputs')}</p>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium text-ai-fg">{t('cluster.logCollections.detail.yaml')}</h3>
            {/* Read-only by construction: a <pre>, not an editor. The page never offers a write. */}
            <div
              data-ai-id="cluster-log-collections:yaml"
              className="max-h-80 overflow-auto rounded-ai-md border border-ai-line bg-ai-surface-2 p-3"
            >
              <pre className="whitespace-pre font-mono text-[11px] leading-5 text-ai-fg-secondary">{toYaml(detail.raw)}</pre>
            </div>
          </section>
        </div>
      ) : null}
    </Modal>
  );
}