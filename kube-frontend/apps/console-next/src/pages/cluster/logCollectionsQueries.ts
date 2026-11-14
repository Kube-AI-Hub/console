import { useQuery } from '@tanstack/react-query';
import { api as apiClient } from '@/api';

/**
 * Cluster log collection: the raw logging CRs, shaped for the three tabs.
 *
 * The logging operator decides what is collected with three object kinds: the
 * FluentBit collector, the Inputs that tail sources, and the Outputs (receivers)
 * that write records. Every Input and Output carries a
 * `logging.kubesphere.io/component` label naming the class it belongs to —
 * logging / events / auditing — which is exactly what the old console's three
 * tabs filter on, so the page reads the raw objects rather than re-deriving the
 * class from paths and match expressions.
 *
 * Kept page-local instead of extending `clusterLoggingApi`: that module returns
 * summaries without labels or the raw object, and the detail dialog needs both.
 */

export const LOGGING_API = '/apis/logging.kubesphere.io/v1alpha2';

export const LOGGING_CLASSES = ['logging', 'events', 'auditing'] as const;

export type LoggingClass = (typeof LOGGING_CLASSES)[number];

export function isLoggingClass(value: string): value is LoggingClass {
  return (LOGGING_CLASSES as readonly string[]).includes(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

function labelsOf(item: Record<string, unknown>): Record<string, string> {
  const metadata = asRecord(item['metadata']);
  const labels = asRecord(metadata['labels']);
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(labels)) out[key] = text(value);
  return out;
}

/** The class an Input/Output belongs to; an unlabelled object is treated as logging. */
export function classOf(item: Record<string, unknown>): LoggingClass {
  const component = labelsOf(item)['logging.kubesphere.io/component'] ?? '';
  return isLoggingClass(component) ? component : 'logging';
}

/** The first spec key that is not a selector: the plugin name (tail, opensearch, …). */
function pluginOf(spec: Record<string, unknown>): string {
  return Object.keys(spec).find((key) => key !== 'match' && key !== 'matchRegex') ?? '';
}

export interface LoggingCollection {
  name: string;
  namespace: string;
  className: LoggingClass;
  /** `logging.kubesphere.io/enabled` on the object. */
  enabled: boolean;
  createdAt: string;
  /** Output plugin, e.g. opensearch. */
  plugin: string;
  /** `host:port` of the plugin, when it has one. */
  address: string;
  /** `logstashPrefix` — the index prefix the records land under. */
  indexPrefix: string;
  /** `spec.match`: which tags are written here. */
  match: string;
  /** `spec.matchRegex`, when match is a regex. */
  matchRegex: string;
  raw: Record<string, unknown>;
}

export interface LoggingSource {
  name: string;
  namespace: string;
  className: LoggingClass;
  /** Input plugin: tail, systemd, … */
  plugin: string;
  tag: string;
  /** What the input tails (path), or its filter description. */
  source: string;
  raw: Record<string, unknown>;
}

function toCollection(item: Record<string, unknown>): LoggingCollection {
  const metadata = asRecord(item['metadata']);
  const labels = labelsOf(item);
  const spec = asRecord(item['spec']);
  const plugin = pluginOf(spec);
  const pluginSpec = asRecord(spec[plugin]);
  const host = text(pluginSpec['host'] ?? pluginSpec['endpoint']);
  const port = text(pluginSpec['port']);
  return {
    name: text(metadata['name']),
    namespace: text(metadata['namespace']),
    className: classOf(item),
    enabled: labels['logging.kubesphere.io/enabled'] === 'true',
    createdAt: text(metadata['creationTimestamp']),
    plugin,
    address: host ? (port ? host + ':' + port : host) : '',
    indexPrefix: text(pluginSpec['logstashPrefix']),
    match: text(spec['match']),
    matchRegex: text(spec['matchRegex']),
    raw: item,
  };
}

function toSource(item: Record<string, unknown>): LoggingSource {
  const metadata = asRecord(item['metadata']);
  const spec = asRecord(item['spec']);
  const plugin = pluginOf(spec);
  const pluginSpec = asRecord(spec[plugin]);
  const filters = pluginSpec['systemdFilter'];
  const source = Array.isArray(filters)
    ? filters.map((entry) => String(entry)).join(', ')
    : text(pluginSpec['path'] ?? pluginSpec['excludePath']);
  return {
    name: text(metadata['name']),
    namespace: text(metadata['namespace']),
    className: classOf(item),
    plugin,
    tag: text(pluginSpec['tag']),
    source,
    raw: item,
  };
}

async function listRaw(resource: string, signal: AbortSignal | undefined): Promise<Array<Record<string, unknown>>> {
  const body = await apiClient.request<{ items?: Array<Record<string, unknown>> }>(LOGGING_API + '/' + resource, {
    ...(signal ? { signal } : {}),
  });
  return body?.items ?? [];
}

/** Outputs (receivers) — one tab's worth of collection items. */
export function useLoggingCollections(cluster: string) {
  return useQuery({
    queryKey: ['logging-collections', cluster],
    queryFn: async ({ signal }) => (await listRaw('outputs', signal)).map(toCollection),
  });
}

/** Inputs — the sources each class tails. */
export function useLoggingSources(cluster: string) {
  return useQuery({
    queryKey: ['logging-sources', cluster],
    queryFn: async ({ signal }) => (await listRaw('inputs', signal)).map(toSource),
  });
}

/** A collection item's match expression, with the regex form labelled when it is one. */
export function matchSummary(t: (key: 'cluster.logCollections.matchRegex') => string, collection: LoggingCollection): string {
  if (collection.match) return collection.match;
  if (collection.matchRegex) return t('cluster.logCollections.matchRegex') + ': ' + collection.matchRegex;
  return '';
}
