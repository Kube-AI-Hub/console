import * as React from 'react';
import { Link } from '@tanstack/react-router';
import { ApiError, type ConfigMapDetail, type ConfigMapInput } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiButton, AiSurface, Badge, ResourceList, type ListSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient, configMapsApi } from '@/api';
import { ensureConfigMapsRegistered, type ConfigMapSummary } from './queries';
import { useConfigMapListController } from './controller';
import { useProjectFilter, useProjectOptions } from '@/components/projects/useProjects';
import { ConfigMapCreateDialog } from './ConfigMapCreateDialog';
import { ConfigMapDeleteDialog } from './ConfigMapDeleteDialog';
import { formatTimestamp } from './format';
import { ConfigMapEditInfoDialog, ConfigMapEditSettingsDialog } from './ConfigMapEditDialogs';
import { toYaml } from './yaml';

import { DialogSuspense } from '@/components/resource/DialogSuspense';
import { LoadingDialog } from '@/components/resource/LoadingDialog';

/*
 * The YAML editor is 188 KB gzip of CodeMirror. A list page must not pay for it
 * before a dialog opens, so it is imported on demand (DEC-CORE-KUBE_FRONTEND-04).
 */
const ConfigMapYamlDialog = React.lazy(() => import('./ConfigMapYamlDialog'));

export interface ConfigMapsPageProps {
  /** Workspace segment; carried for route parity, not used for fetching yet. */
  workspace: string;
  cluster: string;
  namespace: string;
}

const PAGE_SIZE = 10;

/**
 * Characters of the `keys` column shown before an ellipsis.
 *
 * A row is a summary, not the record: the full key list is on the detail page and
 * in the cell's tooltip. 50 fits the common two-to-three-key ConfigMap without
 * clipping and stops a generated map with forty keys from owning the table.
 */
const KEYS_PREVIEW_LENGTH = 50;

/** Which dialog is open, if any. */
type Dialog =
  | { kind: 'none' }
  /* The object is being fetched; shown so the click has a visible answer. */
  | { kind: 'loading'; target: 'editInfo' | 'editSettings' | 'editYaml'; subject: string }
  /*
   * `namespace` lives in the dialog state rather than in the create component:
   * the chosen project decides which object the name check runs against and where
   * the YAML-mode submit goes, and both happen on this page.
   */
  | { kind: 'create'; namespace: string }
  | { kind: 'delete'; names: string[] }
  | { kind: 'editInfo'; detail: ConfigMapDetail }
  | { kind: 'editSettings'; detail: ConfigMapDetail }
  | { kind: 'createYaml' }
  | { kind: 'editYaml'; detail: ConfigMapDetail };

/**
 * ConfigMaps list.
 *
 * The page is a schema, not a layout: title, search, selection, table chrome and
 * pagination come from `ResourceList`, so this page matches the Storybook example
 * and inherits its spacing and tokens. What lives here is what is specific to
 * ConfigMaps — the columns, the row actions, and the dialogs behind them.
 */
export function ConfigMapsPage({ workspace, cluster, namespace }: ConfigMapsPageProps): React.ReactElement {
  const t = useT();
  ensureConfigMapsRegistered();

  const list = useConfigMapListController({ scope: 'project', cluster, namespace, pageSize: PAGE_SIZE });
  const { page, setPage, keyword, setKeyword, sortBy, order, sortByKey, selected, setSelected } = list;
  const { projectFilter, setProjectFilter, query, items, total, remove, create, update, patch, loadDetail } = list;
  const [dialog, setDialog] = React.useState<Dialog>({ kind: 'none' });

  const projectFilterControl = useProjectFilter(cluster, t('configmaps.filter.projectLabel'), t('configmaps.filter.project'));
  // Same cached query the filter uses, so the dialog opens with options already
  // resolved instead of issuing its own cluster-wide project read.
  const projectOptions = useProjectOptions(cluster);

  const mutationError = [remove.error, create.error, update.error, patch.error].find((error) => error !== null);
  const api = configMapsApi(apiClient);

  /**
   * Fetch the full object before opening a dialog that edits it.
   *
   * The list carries only the summary. Opening the dialog with a summary-shaped
   * object and backfilling later would show an empty data editor for a moment and,
   * worse, let a fast save write `{}` over the real data.
   */
  const openWithDetail = React.useCallback(
    async (kind: 'editInfo' | 'editSettings' | 'editYaml', name: string) => {
      setDialog({ kind: 'loading', target: kind, subject: name });
      const detail = await loadDetail({ name, namespace: list.activeNamespace || namespace });
      setDialog(detail ? { kind, detail } : { kind: 'none' });
    },
    [loadDetail, list.activeNamespace, namespace],
  );

  const schema = React.useMemo<ListSchema<ConfigMapSummary>>(
    () => ({
      title: t('configmaps.title'),
      description: t('configmaps.description'),
      rowKey: 'name',
      // Stable per-record handle for automation; the row key is the resource name.
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      // `aiId` matches the `configmaps:search` action in the page manifest; the two
      // are one declaration of the same handle and must not drift apart.
      search: { placeholder: t('configmaps.searchPlaceholder'), keys: ['name'], aiId: 'configmaps:search' },
      /*
       * The project picker comes from a shared hook so every resource page gets the
       * same behaviour — including the rule that it never blocks the table.
       */
      filters: [projectFilterControl],
      selection: 'multiple',
      sortableKeys: ['name', 'createTime'],
      // Matches the `configmaps:sort:*` handles the page objects already target.
      sortAiPrefix: 'configmaps',
      // And `configmaps:select:<name>` for the row checkboxes.
      selectAiId: 'configmaps:select',
      sort: { key: sortBy, order },
      primaryAction: { key: 'create', label: t('configmaps.action.create'), aiId: 'configmaps:create' },
      actions: [
        {
          key: 'bulk-delete',
          label: t('configmaps.action.bulkDelete'),
          tone: 'danger',
          aiId: 'configmaps:bulk-delete',
          aiNeeds: ['configmaps:row-select'],
        },
      ],
      columns: [
        {
          key: 'name',
          title: t('configmaps.column.name'),
          /*
           * Two lines, as in the old console's `Avatar`: the display name on top,
           * the description below. The alias is not appended to the name in the
           * old console — it replaces it (`getDisplayName`), while the real
           * object name stays reachable through the detail page. Showing both
           * made long names truncate before the alias was visible.
           */
          render: (row) => (
            <span className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1.5">
                <a
                  // A plain `<a href>`: the detail view lives in the same file as
                  // this list (one route per page), so there is no separate typed
                  // route to point at. The project layout's click handler turns a
                  // left click into a client-side transition, and Ctrl/⌘-click
                  // still opens a new tab because it is a real link.
                  href={`/kube-frontend/${workspace}/clusters/${cluster}/projects/${namespace}/configmaps/${row.name}`}
                  className="truncate font-medium text-ai-fg hover:text-ai-accent"
                  title={row.name}
                  {...actionProps(`configmaps:open:${row.name}`)}
                >
                  {row.alias || row.name}
                </a>
                {row.federated ? <Badge tone="info">{t('configmaps.federated')}</Badge> : null}
              </span>
              <span className="truncate text-[11px] text-ai-fg-muted">{row.description || '-'}</span>
            </span>
          ),
        },
        {
          key: 'project',
          title: t('configmaps.column.project'),
          hideBelow: 'xl',
          width: 150,
          render: (row) => (
            <Link
              to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/configmaps"
              params={{ workspace, cluster, namespace: row.namespace }}
              className="truncate text-ai-fg-secondary hover:text-ai-accent"
            >
              {row.namespace}
            </Link>
          ),
        },
        {
          key: 'keys',
          title: t('configmaps.column.keys'),
          // Hidden on phones; the detail page still shows them.
          hideBelow: 'md',
          /*
           * Capped at 50 characters rather than wrapped or let to run on.
           *
           * Wrapping was tried first and lost: with several keys per row the
           * column pushed the row height around and made the table jump while
           * scanning. A fixed-length cut keeps every row the same height, and the
           * full list stays available on hover and on the detail page, so nothing
           * is unreachable — only unexpanded.
           */
          render: (row) => {
            // Comma with no space, matching the old console's
            // `Object.keys(data).join(',')`. The space cost a character per key
            // against the 50-character budget for no readability gain at this
            // size.
            const keys = row.keys.join(',') || '-';
            // Count code points, not UTF-16 units: a key is arbitrary user text
            // and slicing mid-surrogate would render a replacement character.
            const chars = Array.from(keys);
            const clipped = chars.length > KEYS_PREVIEW_LENGTH;
            const preview = clipped ? `${chars.slice(0, KEYS_PREVIEW_LENGTH).join('')}...` : keys;
            return (
              <span className="text-ai-fg-secondary" title={clipped ? keys : undefined}>
                {preview}
              </span>
            );
          },
        },
        {
          /*
           * `createTime`, not `createdAt`: a column is sortable only when its key
           * is listed in `sortableKeys`, which carries the API's sort names. A
           * display-only key here silently disabled sorting on this column while
           * the default order still sorted by it — the header looked inert.
           */
          key: 'createTime',
          title: t('configmaps.column.createdAt'),
          width: 170,
          hideBelow: 'lg',
          render: (row) => (
            <span className="tabular-nums text-ai-fg-muted">
              {formatTimestamp(row.createdAt)}
            </span>
          ),
        },
      ],
      /*
       * Four row actions, in the old console's order: 编辑信息 → 编辑 YAML → 编辑设置
       * → 删除. The order is worth matching — people who used the old console reach
       * for the second item expecting YAML.
       */
      rowActions: [
        { key: 'editInfo', label: t('configmaps.action.editInfo') },
        { key: 'editYaml', label: t('configmaps.action.editYaml') },
        { key: 'editSettings', label: t('configmaps.action.editSettings') },
        { key: 'delete', label: t('common.delete'), tone: 'danger' },
      ],
      empty: { title: t('configmaps.empty.title'), description: t('configmaps.empty.description') },
      // Screen-reader text for the built-in controls; without these an English
      // page still announces 全选 / 上一页.
      labels: {
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      // Numbered: kapis slices by `page`, so any page is reachable directly.
      pagination: { page, pageSize: PAGE_SIZE, total },
    }),
    [t, sortBy, order, page, total, cluster, namespace, workspace, projectFilterControl],
  );

  const state = query.isPending ? 'loading' : query.isError ? 'error' : items.length === 0 ? 'empty' : 'ready';

  /*
   * The error state is rendered by the page rather than the schema: `ResourceList`
   * reports an empty list the same way whether a query returned nothing or
   * failed, and those two need different affordances (retry vs create).
   */
  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="configmaps:surface" state="error" className="min-w-0">
        <ErrorPanel error={query.error} onRetry={() => void query.refetch()} />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="configmaps:surface" state={state} className="min-w-0">
      <ResourceList
        schema={schema}
        rows={items}
        loading={state === 'loading'}
        searchValue={keyword}
        onSearchChange={setKeyword}
        filters={{ project: projectFilter }}
        onFiltersChange={(next) => {
          setProjectFilter(next['project'] ?? '');
          setPage(1);
        }}
        selectedKeys={selected}
        onSelectionChange={setSelected}
        onPageChange={setPage}
        onSortChange={(next) => {
          if (!next) return;
          sortByKey(next.key, next.order);
        }}
        onAction={(action, row) => {
          // The primary action arrives without a row; check it before the "is this
          // a row action" guard, or Create silently does nothing.
          if (action === 'create') {
            // Seed from the active filter so the common case needs no choice;
            // "all projects" has none, and the dialog then asks.
            return setDialog({ kind: 'create', namespace: projectFilter || namespace });
          }
          if (!row) return;
          if (action === 'delete') return setDialog({ kind: 'delete', names: [row.name] });
          if (action === 'editInfo' || action === 'editSettings' || action === 'editYaml') {
            void openWithDetail(action, row.name);
          }
        }}
        onBulkAction={(action, keys) => {
          if (action === 'bulk-delete' && keys.length) setDialog({ kind: 'delete', names: keys });
        }}
      />

      {mutationError ? (
        <p role="alert" className="mt-3 text-xs text-ai-danger">
          {mutationError instanceof ApiError ? mutationError.message : t('error.unknown')}
        </p>
      ) : null}

      <ConfigMapCreateDialog
        open={dialog.kind === 'create'}
        onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
        namespace={dialog.kind === 'create' ? dialog.namespace : projectFilter || namespace}
        projects={projectOptions}
        onNamespaceChange={(next) => setDialog({ kind: 'create', namespace: next })}
        pending={create.isPending}
        isNameTaken={(name, ns) => api.checkName({ cluster, namespace: ns, name })}
        onSubmit={async (input: ConfigMapInput) => {
          await create.mutateAsync(input);
          setDialog({ kind: 'none' });
        }}
        onSubmitYaml={async (object) => {
          // The document may name its own project; fall back to the one picked in
          // the dialog when it does not.
          const metadata = (object['metadata'] ?? {}) as { name?: string; namespace?: string };
          await create.mutateAsync({
            name: String(metadata.name ?? ''),
            namespace: metadata.namespace || (dialog.kind === 'create' ? dialog.namespace : namespace),
            data: (object['data'] as Record<string, string> | undefined) ?? {},
          });
          setDialog({ kind: 'none' });
        }}
      />

      {/*
       * The row actions get the list summary, not the full object. The dialogs
       * that need `data` or annotations load it themselves; passing a partial
       * object typed as a detail would let the basic-info dialog send an
       * annotation set that dropped the creator note.
       */}
      {dialog.kind === 'loading' ? (
        <LoadingDialog
          open
          title={
            dialog.target === 'editInfo'
              ? t('configmaps.action.editInfo')
              : dialog.target === 'editYaml'
                ? t('configmaps.action.editYaml')
                : t('configmaps.action.editSettings')
          }
          subject={dialog.subject}
          size="xl"
        />
      ) : null}

      {dialog.kind === 'delete' ? (
        <ConfigMapDeleteDialog
          open
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          names={dialog.names}
          pending={remove.isPending}
          onConfirm={async () => {
            await remove.mutateAsync(dialog.names);
            setSelected([]);
            setDialog({ kind: 'none' });
          }}
        />
      ) : null}

      {dialog.kind === 'editInfo' ? (
        <ConfigMapEditInfoDialog
          open
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          detail={dialog.detail}
          pending={patch.isPending}
          onSubmit={async (annotations) => {
            await patch.mutateAsync({ metadata: { annotations } });
            setDialog({ kind: 'none' });
          }}
        />
      ) : null}

      {dialog.kind === 'editSettings' ? (
        <ConfigMapEditSettingsDialog
          open
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          detail={dialog.detail}
          pending={update.isPending}
          onSubmit={async (data) => {
            await update.mutateAsync({ apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: dialog.detail.name, namespace }, data });
            setDialog({ kind: 'none' });
          }}
        />
      ) : null}

      {dialog.kind === 'editYaml' ? (
        <DialogSuspense>
  <ConfigMapYamlDialog
            open
            onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
            initialYaml={toYaml(dialog.detail.raw)}
            lockName={dialog.detail.name}
            title={t('configmaps.edit.yamlTitle')}
            submitLabel={t('common.confirm')}
            pending={update.isPending}
            onSubmit={async (object) => {
              await update.mutateAsync(object as never);
              setDialog({ kind: 'none' });
            }}
          />
        </DialogSuspense>
      ) : null}

    </AiSurface>
  );
}

function ErrorPanel({ error, onRetry }: { error: unknown; onRetry: () => void }): React.ReactElement {
  const t = useT();
  const apiError = error instanceof ApiError ? error : undefined;
  const message = apiError
    ? apiError.isPermission
      ? t('error.unauthorized')
      : apiError.isNotFound
        ? t('error.notFound')
        : apiError.retryable
          ? t('error.network')
          : apiError.message
    : t('error.unknown');

  return (
    <div className="flex flex-col items-center gap-3 rounded-ai-md border border-ai-line p-8 text-center" role="alert">
      <p className="text-sm font-medium text-ai-fg">{t('error.title')}</p>
      <p className="text-xs text-ai-fg-muted">{message}</p>
      {/* No retry for a permission error: pressing it again cannot succeed. */}
      {apiError?.isPermission ? null : (
        <AiButton aiId="configmaps:retry" size="sm" onClick={onRetry}>
          {t('common.retry')}
        </AiButton>
      )}
    </div>
  );
}
