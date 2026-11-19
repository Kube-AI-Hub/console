import * as React from 'react';
import { useMutation, useQueries } from '@tanstack/react-query';
import { ApiError, nodesApi, nodesWriteApi, type NodeDetail, type NodeTaint } from '@kube-ai-hub/api-client';
import { Alert, Badge, Button, Collapse, Modal, Skeleton } from '@kube-ai-hub/ui';
import { api } from '@/api';
import { useT } from '@/i18n';
import type { Translate } from '@kube-ai-hub/locales';
import { commonTaints, distinctTaints, formatTaint, mergeTaints, parseNodeTaints, TAINT_EFFECTS, taintId, taintsUnchanged, toTaintYaml, type TaintDraft } from './nodeTaints';
import { TaintEditor } from './TaintEditor';

interface Outcome {
  name: string;
  /** `saved` or `skipped` (nothing to write); failures carry the API message. */
  status: 'saved' | 'skipped' | 'failed';
  message?: string;
}

/**
 * Bulk taint editing, following the old console's two-level model.
 *
 * One shared block for taints every selected node has in common, then one block per
 * node for what is left. Editing the shared block changes all of them; editing a
 * node's own block changes only that node. The alternative — one form per node —
 * makes the common case (add the same taint to five nodes) five identical edits,
 * and the alternative — only a shared block — silently deletes the taints that were
 * never shared.
 *
 * Writes are per node and each carries that node's own `resourceVersion`, because
 * the node object is owned by kubelet and other administrators: one conflict must
 * not roll back the nodes that already succeeded. Failures are listed by name rather
 * than collapsed into "批量更新失败", which leaves the reader unable to tell which
 * node still needs attention.
 */
export function NodeTaintsBulkDialog({ cluster, names, onClose, onSaved }: {
  cluster: string;
  names: string[];
  onClose: () => void;
  onSaved: () => void;
}): React.ReactElement {
  const t = useT();
  /*
   * Re-read the nodes instead of trusting the list rows.
   *
   * The row has the taints but not the `resourceVersion`, and a bulk write without
   * one would overwrite whatever another administrator changed since the page was
   * loaded. Fetching also means the editor starts from the state it is about to
   * patch.
   */
  const queries = useQueries({
    queries: names.map((name) => ({
      queryKey: ['node-taints-bulk', cluster, name],
      queryFn: ({ signal }: { signal: AbortSignal }) => nodesApi(api).get({ cluster, name, namespace: '', signal }),
      retry: false,
      staleTime: 0,
    })),
  });
  const nodes = React.useMemo(() => queries.map((query) => query.data).filter((node): node is NodeDetail => Boolean(node)), [queries]);
  const loading = queries.some((query) => query.isPending);
  const loadError = queries.find((query) => query.isError)?.error;

  const [draft, setDraft] = React.useState<TaintDraft | null>(null);
  const [localError, setLocalError] = React.useState('');
  const [outcomes, setOutcomes] = React.useState<Outcome[] | null>(null);

  /*
   * The baseline is frozen on first load: `oldCommon` is what the shared block
   * started with, and the diff needs it after the reader has edited the block.
   * Recomputing it from the live nodes on every render would move the baseline
   * under the editor and resurrect taints the reader just deleted.
   */
  const [baseline, setBaseline] = React.useState<NodeDetail[] | null>(null);
  React.useEffect(() => {
    if (baseline || loading || nodes.length !== names.length) return;
    setBaseline(nodes);
    const shared = commonTaints(nodes);
    setDraft({ common: shared, perNode: Object.fromEntries(nodes.map((node) => [node.name, distinctTaints(node, shared)])) });
  }, [baseline, loading, names.length, nodes]);

  const oldCommon = React.useMemo(() => (baseline ? commonTaints(baseline) : []), [baseline]);

  const save = useMutation({
    mutationFn: async () => {
      if (!baseline || !draft) throw new Error('not ready');
      const results: Outcome[] = [];
      for (const node of baseline) {
        if (taintsUnchanged(node, oldCommon, draft)) {
          results.push({ name: node.name, status: 'skipped' });
          continue;
        }
        try {
          await nodesWriteApi(api).updateMetadata({
            cluster, name: node.name, taints: mergeTaints(node, oldCommon, draft),
            resourceVersion: String(node.raw.metadata?.resourceVersion ?? ''),
          });
          results.push({ name: node.name, status: 'saved' });
        } catch (error) {
          results.push({ name: node.name, status: 'failed', message: describeFailure(error, t) });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      setOutcomes(results);
      // Partial success still changes the cluster, so the list must refresh either way.
      if (results.some((result) => result.status === 'saved')) onSaved();
    },
  });

  const submit = () => {
    if (!draft || !baseline) return;
    /*
     * Validate every node's list before writing anything.
     *
     * A duplicate key+effect or an empty key is rejected by the API per node, which
     * would turn a typo in the shared block into N partial failures. Catching it
     * here keeps "nothing was written" a state the reader can reason about.
     */
    for (const node of baseline) {
      const ids = mergeTaints(node, oldCommon, draft).map(taintId);
      if (ids.length !== new Set(ids).size) {
        setLocalError(t('node.taints.duplicate', { name: node.name }));
        return;
      }
      if (mergeTaints(node, oldCommon, draft).some((taint) => !taint.key.trim())) {
        setLocalError(t('node.taints.emptyKey', { name: node.name }));
        return;
      }
    }
    setLocalError('');
    void save.mutateAsync().catch(() => undefined);
  };

  const failed = outcomes?.filter((result) => result.status === 'failed') ?? [];
  const savedCount = outcomes?.filter((result) => result.status === 'saved').length ?? 0;
  const unchanged = outcomes?.every((result) => result.status === 'skipped') ?? false;
  const done = outcomes !== null;

  return <Modal open size="xl" title={t('node.taints.bulkTitle')} closeAiId="node-taints-bulk:close"
    closeDisabled={save.isPending} closeLabel={t('common.close')}
    onOpenChange={(open) => { if (!open && !save.isPending) onClose(); }}
    description={t('node.taints.bulkDescription', { count: names.length })}
    footer={<div className="flex justify-end gap-2">
      <Button variant="ghost" disabled={save.isPending} onClick={() => { if (!save.isPending) onClose(); }}
        {...{ 'data-ai-id': 'node-taints-bulk:cancel' }}>{done ? t('common.close') : t('common.cancel')}</Button>
      {done ? null : <Button disabled={!draft || loading || save.isPending} loading={save.isPending}
        onClick={submit} {...{ 'data-ai-id': 'node-taints-bulk:submit' }}>{t('common.confirm')}</Button>}
    </div>}>
    <div className="flex flex-col gap-3" data-ai-id="node-taints-bulk:surface"
      data-ai-state={loading ? 'loading'
        : loadError ? 'error'
          : queries.some((query) => query.isFetching) ? 'refreshing'
            : 'ready'}>
      <Alert tone="warning">{t('node.taints.warning')}</Alert>
      {loadError ? <p role="alert" className="text-sm text-ai-danger">
        {loadError instanceof ApiError ? loadError.message : t('error.unknown')}</p> : null}
      {loading ? <Skeleton className="h-40" /> : null}
      {!loading && draft && baseline ? <>
        <section className="rounded-ai-md border border-ai-line p-3">
          <h3 className="mb-1 text-sm font-medium text-ai-fg">{baseline.length > 1 ? t('node.taints.common') : t('node.taints.title')}</h3>
          <p className="mb-2 text-xs text-ai-fg-muted">{baseline.length > 1 ? t('node.taints.commonHint') : t('node.taints.singleHint')}</p>
          <TaintEditor value={draft.common} onChange={(next) => setDraft({ ...draft, common: next })} disabled={save.isPending}
            aiId="node-taints:common" />
        </section>
        {baseline.length > 1 ? <section>
          <h3 className="mb-2 text-sm font-medium text-ai-fg">{t('node.taints.perNode')}</h3>
          <Collapse items={baseline.map((node) => ({
            key: node.name,
            title: <span className="flex w-full items-center gap-2">
              <span className="min-w-0 flex-1 truncate">{node.name}</span>
              <Badge tone={draft.perNode[node.name]?.length ? 'info' : 'neutral'}>
                {t('node.taints.count', { count: draft.perNode[node.name]?.length ?? 0 })}
              </Badge>
            </span>,
            content: <div className="pt-2">
              <TaintEditor value={draft.perNode[node.name] ?? []} disabled={save.isPending} aiId={`node-taints:${node.name}`}
                onChange={(next) => setDraft({ ...draft, perNode: { ...draft.perNode, [node.name]: next } })} />
            </div>,
          }))} />
        </section> : null}
      </> : null}
      {localError ? <p role="alert" className="text-sm text-ai-danger">{localError}</p> : null}
      {save.error ? <p role="alert" className="text-sm text-ai-danger">
        {save.error instanceof ApiError ? save.error.message : t('error.unknown')}</p> : null}
      {outcomes ? <div role="status" className="flex flex-col gap-1 text-sm" data-ai-id="node-taints-bulk:result">
        {unchanged ? <p className="text-ai-fg-muted">{t('node.taints.unchangedAll')}</p> : null}
        {savedCount > 0 ? <p className="text-ai-success">{t('node.taints.saved', { count: savedCount })}</p> : null}
        {failed.length > 0 ? <>
          <p className="text-ai-danger">{t('node.taints.failed', { count: failed.length })}</p>
          <ul className="ml-4 list-disc text-xs text-ai-danger">
            {failed.map((result) => <li key={result.name}>{result.name}: {result.message}</li>)}
          </ul>
        </> : null}
      </div> : null}
    </div>
  </Modal>;
}

function describeFailure(error: unknown, t: Translate): string {
  if (error instanceof ApiError && error.status === 409) return t('node.taints.conflict');
  if (error instanceof ApiError && error.status === 403) return t('node.taints.forbidden');
  /*
   * The core-group write path refuses member clusters before the request leaves the
   * browser (see `coreWritePath`). Surfacing the thrown Chinese sentence would be
   * accurate but untranslated; the reader needs to know this is a platform limitation,
   * not a failure they can retry away.
   */
  if (error instanceof Error && error.message.includes('成员集群')) return t('node.taints.memberUnsupported');
  return error instanceof Error ? error.message : t('error.unknown');
}

/**
 * Re-exported so the page can render a taint list without importing the editor.
 *
 * The list's status tooltip already prints `key=value:effect`; keeping the formatter
 * next to the parser means the two cannot disagree about how a taint is spelled.
 */
export { formatTaint, parseNodeTaints, toTaintYaml, TAINT_EFFECTS };
export type { NodeTaint };
