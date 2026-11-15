import * as React from 'react';
import { Button, Input, Modal, MultiSelect, Textarea } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { federatedApi, projectNameProblem } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import { api } from '@/api';

/**
 * Create / placement dialogs for federated projects.
 *
 * The create form is the old console's 创建多集群项目 (name, alias, description,
 * clusters) plus the enterprise space shown read-only: the page is already scoped to
 * one workspace and the project's template label ties it there, so a workspace picker
 * would offer a choice the request cannot honour.
 *
 * Placement is a separate dialog because changing it is a different risk from editing
 * a display name: removing a cluster makes the control plane delete the namespace on
 * that cluster.
 */

/** One cluster the placement picker can offer. */
export interface FederatedClusterOption {
  name: string;
  label: string;
  ready: boolean;
  isHost: boolean;
}

/** Alias allows Chinese, letters, digits and inner hyphens (old PATTERN_ALIAS_NAME). */
const ALIAS_PATTERN = /^(?!-)([a-zA-Z0-9\u4e00-\u9fa5-]+)(?<!-)$/;
const ALIAS_MAX = 63;
const DESCRIPTION_MAX = 256;

/** Validation copy for a typed project name. */
export function nameErrorMessage(t: ReturnType<typeof useT>, problem: NonNullable<ReturnType<typeof projectNameProblem>>): string {
  if (problem === 'empty') return t('fedprojects.create.nameRequired');
  if (problem === 'length') return t('fedprojects.create.nameLength');
  return t('fedprojects.create.nameFormat');
}

export interface FederatedProjectCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The route's workspace, shown read-only; the request writes it into the template label. */
  workspaceLabel: string;
  clusters: FederatedClusterOption[];
  clustersPending: boolean;
  pending: boolean;
  /** Server-side failure, shown inside the open dialog so the typed values are kept. */
  error?: string | undefined;
  onCreate: (input: { name: string; alias: string; description: string; clusters: string[] }) => Promise<void>;
}

/** The default placement: the host cluster, explicitly visible and editable. */
function defaultClusters(clusters: FederatedClusterOption[]): string[] {
  const host = clusters.find((cluster) => cluster.isHost && cluster.ready);
  if (host) return [host.name];
  const ready = clusters.find((cluster) => cluster.ready);
  return ready ? [ready.name] : [];
}

export function FederatedProjectCreateDialog({
  open,
  onOpenChange,
  workspaceLabel,
  clusters,
  clustersPending,
  pending,
  error,
  onCreate,
}: FederatedProjectCreateDialogProps): React.ReactElement {
  const t = useT();
  const [name, setName] = React.useState('');
  const [alias, setAlias] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [selected, setSelected] = React.useState<string[]>([]);
  const [errors, setErrors] = React.useState<{ name?: string; alias?: string; description?: string; placement?: string }>({});
  const [checking, setChecking] = React.useState(false);

  // A new open starts from the host cluster and empty fields; re-opening must not
  // resurrect a previous attempt's name.
  React.useEffect(() => {
    if (!open) return;
    setName('');
    setAlias('');
    setDescription('');
    setSelected(defaultClusters(clusters));
    setErrors({});
  }, [open, clusters]);

  const submit = async (): Promise<void> => {
    const next: typeof errors = {};
    const problem = projectNameProblem(name);
    if (problem) next.name = nameErrorMessage(t, problem);
    if (alias.trim() && !ALIAS_PATTERN.test(alias.trim())) next.alias = t('resource.validate.aliasPattern');
    if (description.length > DESCRIPTION_MAX) next.description = t('resource.validate.descriptionMax');
    if (selected.length === 0) next.placement = t('fedprojects.create.placementRequired');
    setErrors(next);
    if (Object.keys(next).length) return;

    setChecking(true);
    try {
      // Ask before writing: a conflict found after the namespace exists would spend a
      // create and a rollback to learn the name was taken.
      if (await federatedApi(api).projectExists({ name: name.trim() })) {
        setErrors({ name: t('fedprojects.create.nameExists') });
        return;
      }
    } catch {
      /* A failed probe must not block the write; the create itself still reports 409. */
    } finally {
      setChecking(false);
    }

    try {
      await onCreate({ name: name.trim(), alias: alias.trim(), description: description.trim(), clusters: selected });
      // The page closes the dialog on success; a failure keeps it open with its values.
    } catch {
      /* Server error is rendered from the `error` prop. */
    }
  };

  const options = clusters.map((cluster) => ({
    value: cluster.name,
    label: cluster.label,
    // Selecting a not-ready cluster would ask the control plane to propagate to a
    // cluster it cannot reach; keeping an already-placed one selectable lets a reader
    // see it without being able to add more.
    disabled: !cluster.ready && !selected.includes(cluster.name),
  }));

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t('fedprojects.create.title')}
      description={t('fedprojects.create.description')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            size="sm"
            disabled={pending || checking || clustersPending}
            loading={pending || checking}
            {...actionProps('federated-projects:create-submit')}
            onClick={() => void submit()}
          >
            {t('common.create')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ai-fg-secondary">{t('fedprojects.create.name')}</span>
          <span className="text-[11px] text-ai-fg-muted">{t('fedprojects.create.nameHint')}</span>
          <Input
            value={name}
            maxLength={63}
            autoFocus
            aria-invalid={Boolean(errors.name)}
            {...actionProps('federated-projects:create-name')}
            onChange={(event) => setName(event.target.value)}
          />
          {errors.name ? <span role="alert" className="text-[11px] text-ai-danger">{errors.name}</span> : null}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-ai-fg-secondary">{t('fedprojects.create.alias')}</span>
          <Input
            value={alias}
            maxLength={ALIAS_MAX}
            {...actionProps('federated-projects:create-alias')}
            onChange={(event) => setAlias(event.target.value)}
          />
          {errors.alias ? <span role="alert" className="text-[11px] text-ai-danger">{errors.alias}</span> : null}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-ai-fg-secondary">{t('common.description')}</span>
          <Textarea
            value={description}
            rows={2}
            maxLength={DESCRIPTION_MAX}
            {...actionProps('federated-projects:create-description')}
            onChange={(event) => setDescription(event.target.value)}
          />
          {errors.description ? <span role="alert" className="text-[11px] text-ai-danger">{errors.description}</span> : null}
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-ai-fg-secondary">{t('fedprojects.field.workspace')}</span>
          <Input value={workspaceLabel} readOnly disabled {...actionProps('federated-projects:create-workspace')} />
          <span className="text-[11px] text-ai-fg-muted">{t('fedprojects.create.workspaceHint')}</span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-ai-fg-secondary">{t('workspace.field.clusters')}</span>
          <span className="text-[11px] text-ai-fg-muted">{t('fedprojects.create.placementHint')}</span>
          <MultiSelect
            value={selected}
            options={options}
            placeholder={t('fedprojects.create.placementPlaceholder')}
            clearLabel={t('fedprojects.create.placementClear')}
            searchLabel={t('common.search')}
            emptyText={t('fedprojects.create.noClusters')}
            disabled={pending || clustersPending}
            data-ai-id="federated-projects:create-clusters"
            onValueChange={setSelected}
          />
          {errors.placement ? <span role="alert" className="text-[11px] text-ai-danger">{errors.placement}</span> : null}
        </div>

        {error ? <p role="alert" className="text-xs text-ai-danger" data-ai-id="federated-projects:create-error">{error}</p> : null}
      </div>
    </Modal>
  );
}

export interface FederatedProjectPlacementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  clusters: FederatedClusterOption[];
  /** Clusters the project is currently placed on. */
  current: string[];
  pending: boolean;
  error?: string | undefined;
  onSubmit: (clusters: string[]) => Promise<void>;
}

export function FederatedProjectPlacementDialog({
  open,
  onOpenChange,
  name,
  clusters,
  current,
  pending,
  error,
  onSubmit,
}: FederatedProjectPlacementDialogProps): React.ReactElement {
  const t = useT();
  const [selected, setSelected] = React.useState<string[]>(current);
  const [problem, setProblem] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setSelected(current);
      setProblem('');
    }
  }, [open, current]);

  const removed = current.filter((cluster) => !selected.includes(cluster));

  const submit = async (): Promise<void> => {
    if (selected.length === 0) {
      setProblem(t('fedprojects.placement.required'));
      return;
    }
    setProblem('');
    try {
      await onSubmit(selected);
    } catch {
      /* Server error is rendered from the `error` prop. */
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={t('fedprojects.placement.title')}
      description={t('fedprojects.placement.description', { name })}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            size="sm"
            disabled={pending}
            loading={pending}
            {...actionProps('federated-projects:placement-submit')}
            onClick={() => void submit()}
          >
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        <span className="text-xs text-ai-fg-secondary">{t('workspace.field.clusters')}</span>
        <MultiSelect
          value={selected}
          options={clusters.map((cluster) => ({
            value: cluster.name,
            label: cluster.label,
            disabled: !cluster.ready && !selected.includes(cluster.name),
          }))}
          placeholder={t('fedprojects.create.placementPlaceholder')}
          clearLabel={t('fedprojects.create.placementClear')}
          searchLabel={t('common.search')}
          emptyText={t('fedprojects.create.noClusters')}
          disabled={pending}
          data-ai-id="federated-projects:placement-clusters"
          onValueChange={setSelected}
        />
        <p className="text-[11px] text-ai-fg-muted">{t('fedprojects.placement.hint')}</p>
        {removed.length > 0 ? (
          <p className="text-[11px] text-ai-warning" data-ai-id="federated-projects:placement-removal">
            {t('fedprojects.placement.removalWarning', { clusters: removed.join(', ') })}
          </p>
        ) : null}
        {problem ? <span role="alert" className="text-[11px] text-ai-danger">{problem}</span> : null}
        {error ? <p role="alert" className="text-xs text-ai-danger" data-ai-id="federated-projects:placement-error">{error}</p> : null}
      </div>
    </Modal>
  );
}
