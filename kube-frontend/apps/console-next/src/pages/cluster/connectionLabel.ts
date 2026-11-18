import type { LocaleKey } from '@kube-ai-hub/locales';

/**
 * How a cluster is reached, in the reader's language.
 *
 * `spec.connection.type` is `direct` or `proxy` on the wire, and three surfaces show
 * it: the cluster list, the overview's identity block, and the settings page. Each used
 * to print the raw value, which left an English word sitting among Chinese labels — and
 * three copies of the same `type === 'direct' ? …` expression is how they drift apart
 * the day a third type appears.
 *
 * Unknown values return `undefined` rather than guessing. A connection type this build
 * does not know is a fact the reader should see as missing, not as "proxy" because it
 * was the closest match.
 */
export function connectionLabelKey(type: string | undefined): LocaleKey | undefined {
  if (type === 'direct') return 'connection.direct';
  if (type === 'proxy') return 'connection.proxy';
  return undefined;
}

/**
 * The tone for a connection badge.
 *
 * `direct` is the ordinary path — the platform talks to the cluster's own API server —
 * so it stays quiet. `proxy` means traffic comes back through the agent, which is the
 * one that fails in practice (a member cluster behind NAT losing its tunnel), so it
 * carries the accent colour.
 */
export function connectionTone(type: string | undefined): 'info' | 'accent' | 'neutral' {
  if (type === 'direct') return 'info';
  if (type === 'proxy') return 'accent';
  return 'neutral';
}
