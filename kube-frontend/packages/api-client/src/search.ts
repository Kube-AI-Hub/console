/**
 * Log and audit search, read from the tenant API's Elasticsearch-backed endpoints.
 *
 * Both are `{ query: { total, records } }` envelopes served by the same proxy, and both accept a
 * time window in **seconds**. Measured on B200: logs answer /kapis/tenant.kubesphere.io/v1alpha2/logs,
 * audits /kapis/tenant.kubesphere.io/v1alpha2/auditing/events, and the filter keys are the plural
 * ones the old console's search box produces (`namespaces`, `containers`, `log_query`;
 * `workspace_search`, `verb_filter`, `objectref_resource_filter`, `user_search`, ...).
 *
 * The same two endpoints also answer `operation=statistics` and `operation=histogram`, which is how
 * the old console draws the count strip and the bar chart above its result list. The two differ in
 * one detail worth naming: logs return their buckets under `histogram.histograms`, audits under
 * `histogram.buckets`.
 */
import type { Client } from './client';

export interface LogRecord {
  /** RFC3339 timestamp as Elasticsearch stores it. */
  time: string;
  log: string;
  namespace: string;
  pod: string;
  container: string;
}

export interface LogSearchResult {
  total: number;
  records: LogRecord[];
}

export interface HistogramBucket {
  /** Bucket start in milliseconds, as Elasticsearch returns it. */
  time: number;
  count: number;
}

export interface HistogramResult {
  total: number;
  buckets: HistogramBucket[];
}

export interface LogStatistics {
  containers: number;
  logs: number;
}

export interface LogSearchParams {
  namespace?: string;
  pod?: string;
  container?: string;
  /** Free-text over the log line (`log_query`). */
  keyword?: string;
  /** Seconds since epoch. */
  startTime: number;
  endTime: number;
  from?: number;
  size?: number;
  signal?: AbortSignal;
}

function logFilters(params: LogSearchParams): Record<string, string | number> {
  const query: Record<string, string | number> = {};
  if (params.namespace) query['namespaces'] = params.namespace;
  if (params.pod) query['pods'] = params.pod;
  if (params.container) query['containers'] = params.container;
  if (params.keyword) query['log_query'] = params.keyword;
  return query;
}

export function logSearchApi(client: Client) {
  return {
    async search(params: LogSearchParams): Promise<LogSearchResult> {
      const body = await client.request<{ query?: { total?: number; records?: Array<Record<string, unknown>> } }>(
        '/kapis/tenant.kubesphere.io/v1alpha2/logs',
        {
          query: {
            start_time: params.startTime,
            end_time: params.endTime,
            from: params.from ?? 0,
            size: params.size ?? 50,
            sort: 'time',
            ascending: 'false',
            ...logFilters(params),
          },
          ...(params.signal ? { signal: params.signal } : {}),
        },
      );
      const envelope = body?.query ?? {};
      return {
        total: Number(envelope.total ?? 0),
        records: (envelope.records ?? []).map((record) => ({
          time: String(record['time'] ?? ''),
          log: String(record['log'] ?? ''),
          namespace: String(record['namespace'] ?? ''),
          pod: String(record['pod'] ?? ''),
          container: String(record['container'] ?? ''),
        })),
      };
    },

    async histogram(params: LogSearchParams & { interval: string }): Promise<HistogramResult> {
      const body = await client.request<{
        histogram?: { total?: number; histograms?: Array<Record<string, unknown>> };
      }>('/kapis/tenant.kubesphere.io/v1alpha2/logs', {
        query: {
          operation: 'histogram',
          interval: params.interval,
          start_time: params.startTime,
          end_time: params.endTime,
          ...logFilters(params),
        },
        ...(params.signal ? { signal: params.signal } : {}),
      });
      const envelope = body?.histogram ?? {};
      return {
        total: Number(envelope.total ?? 0),
        buckets: (envelope.histograms ?? []).map((bucket) => ({
          time: Number(bucket['time'] ?? 0),
          count: Number(bucket['count'] ?? 0),
        })),
      };
    },

    async statistics(params: { startTime: number; endTime: number; signal?: AbortSignal }): Promise<LogStatistics> {
      const body = await client.request<{ statistics?: Record<string, unknown> }>(
        '/kapis/tenant.kubesphere.io/v1alpha2/logs',
        {
          query: { operation: 'statistics', start_time: params.startTime, end_time: params.endTime },
          ...(params.signal ? { signal: params.signal } : {}),
        },
      );
      const stats = body?.statistics ?? {};
      return { containers: Number(stats['containers'] ?? 0), logs: Number(stats['logs'] ?? 0) };
    },
  };
}

export interface AuditRecord {
  time: string;
  level: string;
  verb: string;
  user: string;
  /** `resource/name`, as the audit object ref reads. */
  resource: string;
  namespace: string;
  uri: string;
  status: string;
  sourceIPs: string;
  workspace: string;
}

export interface AuditSearchResult {
  total: number;
  records: AuditRecord[];
}

export interface AuditSearchParams {
  workspace?: string;
  namespace?: string;
  resource?: string;
  verb?: string;
  user?: string;
  responseCode?: string;
  startTime: number;
  endTime: number;
  from?: number;
  size?: number;
  signal?: AbortSignal;
}

function auditFilters(params: AuditSearchParams): Record<string, string | number> {
  const query: Record<string, string | number> = {};
  if (params.workspace) query['workspace_search'] = params.workspace;
  if (params.namespace) query['objectref_namespace_search'] = params.namespace;
  if (params.resource) query['objectref_resource_filter'] = params.resource;
  if (params.verb) query['verb_filter'] = params.verb;
  if (params.user) query['user_search'] = params.user;
  if (params.responseCode) query['response_code_filter'] = params.responseCode;
  return query;
}

export function auditSearchApi(client: Client) {
  return {
    async search(params: AuditSearchParams): Promise<AuditSearchResult> {
      const body = await client.request<{ query?: { total?: number; records?: Array<Record<string, unknown>> } }>(
        '/kapis/tenant.kubesphere.io/v1alpha2/auditing/events',
        {
          query: {
            operation: 'query',
            start_time: params.startTime,
            end_time: params.endTime,
            from: params.from ?? 0,
            size: params.size ?? 50,
            ...auditFilters(params),
          },
          ...(params.signal ? { signal: params.signal } : {}),
        },
      );
      const envelope = body?.query ?? {};
      return {
        total: Number(envelope.total ?? 0),
        records: (envelope.records ?? []).map((record) => {
          const user = (record['User'] ?? {}) as Record<string, unknown>;
          const objectRef = (record['ObjectRef'] ?? {}) as Record<string, unknown>;
          const response = (record['ResponseStatus'] ?? {}) as Record<string, unknown>;
          return {
            time: String(record['@timestamp'] ?? record['StageTimestamp'] ?? ''),
            level: String(record['Level'] ?? ''),
            verb: String(record['Verb'] ?? ''),
            user: String(user['Username'] ?? ''),
            resource: [String(objectRef['Resource'] ?? ''), String(objectRef['Name'] ?? '')].filter(Boolean).join('/'),
            namespace: String(objectRef['Namespace'] ?? ''),
            uri: String(record['RequestURI'] ?? ''),
            status: String(response['code'] ?? ''),
            sourceIPs: String(record['SourceIPs'] ?? ''),
            workspace: String(record['Workspace'] ?? ''),
          };
        }),
      };
    },

    async histogram(params: AuditSearchParams & { interval: string }): Promise<HistogramResult> {
      const body = await client.request<{
        histogram?: { total?: number; buckets?: Array<Record<string, unknown>> };
      }>('/kapis/tenant.kubesphere.io/v1alpha2/auditing/events', {
        query: {
          operation: 'histogram',
          interval: params.interval,
          start_time: params.startTime,
          end_time: params.endTime,
          ...auditFilters(params),
        },
        ...(params.signal ? { signal: params.signal } : {}),
      });
      const envelope = body?.histogram ?? {};
      return {
        total: Number(envelope.total ?? 0),
        buckets: (envelope.buckets ?? []).map((bucket) => ({
          time: Number(bucket['time'] ?? 0),
          count: Number(bucket['count'] ?? 0),
        })),
      };
    },

    async statistics(params: { startTime: number; endTime: number; signal?: AbortSignal }): Promise<{ resources: number; events: number }> {
      const body = await client.request<{ statistics?: Record<string, unknown> }>(
        '/kapis/tenant.kubesphere.io/v1alpha2/auditing/events',
        {
          query: { operation: 'statistics', start_time: params.startTime, end_time: params.endTime },
          ...(params.signal ? { signal: params.signal } : {}),
        },
      );
      const stats = body?.statistics ?? {};
      return { resources: Number(stats['resources'] ?? 0), events: Number(stats['events'] ?? 0) };
    },
  };
}
