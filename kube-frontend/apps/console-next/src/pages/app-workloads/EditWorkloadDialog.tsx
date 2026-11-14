import * as React from 'react';
import { Button, Icon, Input, Modal, Select } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { ApiError, type KubeObject, type WorkloadDetail, type WorkloadKind } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';

/**
 * 编辑设置: the custom form the old console opens from a workload's detail.
 *
 * The old console's `workload.template.edit` dialog has six tabs (update strategy,
 * container template, storage, affinity, grace period, advanced settings). Porting all
 * of it would rebuild the create wizard a second time; this form covers the fields an
 * operator changes most often and that the API accepts on a running workload:
 *
 * - the image of every container (the reason the gap exists: changing an image
 *   previously required the YAML editor),
 * - the replica count of the two kinds that have one (Deployment, StatefulSet),
 * - environment variables, one row each, add/change/remove,
 * - the image pull policy of every container,
 * - CronJob pod templates (`spec.jobTemplate.spec.template`), where the same fields
 *   are mutable. A Job's pod template is immutable after creation, so it is not
 *   offered here — the API would reject the write.
 *
 * The dialog lists every field it is about to change before the save button becomes
 * usable. A workload write is a whole-object PUT with `resourceVersion`, so a
 * concurrent change answers 409; the dialog then stays open and says to reload, rather
 * than closing on a save that silently did nothing.
 */

/** Values Kubernetes accepts for a container's `imagePullPolicy`. */
const PULL_POLICIES = ['Always', 'IfNotPresent', 'Never'] as const;

/**
 * Radix's Select rejects an empty-string item value, so "follow the default" needs a
 * sentinel here and an empty string in the draft.
 */
const INHERIT_PULL_POLICY = '__inherit__';

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : undefined;
}

/** The pod template of the kinds this dialog supports, or undefined for a malformed object. */
function templateOf(kind: WorkloadKind, raw: JsonObject): JsonObject | undefined {
  const spec = asObject(raw['spec']);
  if (!spec) return undefined;
  if (kind === 'cronjobs') {
    const jobTemplate = asObject(spec['jobTemplate']);
    const jobSpec = jobTemplate ? asObject(jobTemplate['spec']) : undefined;
    return jobSpec ? asObject(jobSpec['template']) : undefined;
  }
  return asObject(spec['template']);
}

function containersOf(kind: WorkloadKind, raw: JsonObject): JsonObject[] {
  const template = templateOf(kind, raw);
  const podSpec = template ? asObject(template['spec']) : undefined;
  const containers = podSpec?.['containers'];
  if (!Array.isArray(containers)) return [];
  return containers.map((entry) => asObject(entry) ?? {});
}

/** `spec.replicas` for the kinds that have one; `undefined` when absent. */
function replicasOf(raw: JsonObject): number | undefined {
  const spec = asObject(raw['spec']);
  const replicas = spec?.['replicas'];
  return typeof replicas === 'number' ? replicas : undefined;
}

/** Environment rows are keyed by an id that survives deleting an earlier row. */
let envSequence = 0;
function nextEnvId(): number {
  envSequence += 1;
  return envSequence;
}

interface EnvDraft {
  id: number;
  name: string;
  value: string;
  /**
   * Set when the entry came from `valueFrom` (ConfigMap/Secret reference). Its source
   * is not a literal this form can edit, so the row is read-only and the original
   * object is put back unchanged on save.
   */
  reference?: JsonObject;
}

interface ContainerDraft {
  name: string;
  image: string;
  /** Empty means "leave the stored value alone"; Kubernetes defaults it when absent. */
  pullPolicy: string;
  env: EnvDraft[];
}

function toDrafts(kind: WorkloadKind, raw: JsonObject): ContainerDraft[] {
  return containersOf(kind, raw).map((container) => {
    const storedEnv = Array.isArray(container['env']) ? container['env'] : [];
    return {
      name: String(container['name'] ?? ''),
      image: String(container['image'] ?? ''),
      pullPolicy: String(container['imagePullPolicy'] ?? ''),
      env: storedEnv.map((entry) => {
        const record = asObject(entry) ?? {};
        const valueFrom = asObject(record['valueFrom']);
        const name = String(record['name'] ?? '');
        if (valueFrom) return { id: nextEnvId(), name, value: '', reference: record };
        return { id: nextEnvId(), name, value: String(record['value'] ?? '') };
      }),
    };
  });
}

function editableReplicas(kind: WorkloadKind): boolean {
  return kind === 'deployments' || kind === 'statefulsets';
}

export interface EditWorkloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: WorkloadKind;
  detail: WorkloadDetail;
  pending?: boolean;
  /** The page PUTs the returned object through the workload update mutation. */
  onSubmit: (body: KubeObject) => void | Promise<void>;
}

/** One changed field, rendered before submit so a save is never a leap of faith. */
interface ChangeRow {
  path: string;
  before: string;
  after: string;
}

export function EditWorkloadDialog({
  open,
  onOpenChange,
  kind,
  detail,
  pending = false,
  onSubmit,
}: EditWorkloadDialogProps): React.ReactElement {
  const t = useT();
  const raw = detail.raw as unknown as JsonObject;
  const supportsReplicas = editableReplicas(kind);

  const [drafts, setDrafts] = React.useState<ContainerDraft[]>([]);
  const [replicas, setReplicas] = React.useState<number | ''>('');
  const [error, setError] = React.useState<string | null>(null);

  // Re-seed on open: the same dialog instance edits different objects over time.
  React.useEffect(() => {
    if (!open) return;
    setDrafts(toDrafts(kind, raw));
    setReplicas(replicasOf(raw) ?? 1);
    setError(null);
  }, [open, kind, raw]);

  const initialContainers = React.useMemo(() => containersOf(kind, raw), [kind, raw]);
  const multiContainer = drafts.length > 1;
  /** A single-container workload keeps the plain handles the acceptance spec names. */
  const suffixFor = (container: ContainerDraft): string => (multiContainer ? `:${container.name}` : '');

  const setContainer = (index: number, patch: Partial<ContainerDraft>): void => {
    setDrafts((previous) => previous.map((container, position) => (position === index ? { ...container, ...patch } : container)));
  };

  const updateEnv = (containerIndex: number, envId: number, patch: { name?: string; value?: string }): void => {
    setDrafts((previous) =>
      previous.map((container, position) =>
        position === containerIndex
          ? { ...container, env: container.env.map((entry) => (entry.id === envId ? { ...entry, ...patch } : entry)) }
          : container,
      ),
    );
  };

  const addEnv = (containerIndex: number): void => {
    setDrafts((previous) =>
      previous.map((container, position) =>
        position === containerIndex ? { ...container, env: [...container.env, { id: nextEnvId(), name: '', value: '' }] } : container,
      ),
    );
  };

  const removeEnv = (containerIndex: number, envId: number): void => {
    setDrafts((previous) =>
      previous.map((container, position) =>
        position === containerIndex ? { ...container, env: container.env.filter((entry) => entry.id !== envId) } : container,
      ),
    );
  };

  /** Image is the one field that must be present; an empty image would be rejected by the API. */
  const imageMissing = drafts.some((container) => container.image.trim() === '');

  const replicasInvalid = supportsReplicas && (replicas === '' || !Number.isInteger(replicas) || replicas < 0);

  /**
   * Environment variable names must be unique per container and non-empty.
   *
   * Kubernetes accepts a list of same-named variables (the last one wins) but the
   * result is a coin flip for the reader, so the form rejects it instead of writing
   * one. Reference rows are included in the uniqueness check because they are still
   * environment variables in the resulting object.
   */
  const envNameIssues = React.useMemo(() => {
    const issues = new Map<number, string>();
    for (const container of drafts) {
      const seen = new Set<string>();
      for (const entry of container.env) {
        const name = entry.name.trim();
        if (!name) {
          issues.set(entry.id, t('workloads.editSettings.envKeyRequired'));
          continue;
        }
        if (seen.has(name)) issues.set(entry.id, t('workloads.editSettings.envKeyDuplicate'));
        seen.add(name);
      }
    }
    return issues;
  }, [drafts, t]);

  /** Every field that differs from the stored object, in a stable order. */
  const changes = React.useMemo<ChangeRow[]>(() => {
    const rows: ChangeRow[] = [];
    if (supportsReplicas) {
      const before = replicasOf(raw);
      if (before !== undefined && replicas !== '' && before !== replicas) {
        rows.push({ path: 'spec.replicas', before: String(before), after: String(replicas) });
      }
    }
    drafts.forEach((container, index) => {
      const stored = initialContainers[index];
      if (!stored) return;
      const storedImage = String(stored['image'] ?? '');
      if (container.image.trim() !== storedImage) {
        rows.push({
          path: `spec.template.spec.containers.${container.name}.image`,
          before: storedImage || '-',
          after: container.image.trim() || '-',
        });
      }
      const storedPolicy = String(stored['imagePullPolicy'] ?? '');
      if (container.pullPolicy !== storedPolicy) {
        rows.push({
          path: `spec.template.spec.containers.${container.name}.imagePullPolicy`,
          before: storedPolicy || '-',
          after: container.pullPolicy || '-',
        });
      }
      // Environment variables compare by name, so a rename shows as one removal and
      // one addition rather than an edit that hides what happened to the old name.
      const storedEnv = new Map<string, string>();
      for (const entry of container.env) {
        if (!entry.reference) continue;
        storedEnv.set(entry.name, t('workloads.editSettings.envReferenceValue'));
      }
      for (const envEntry of Array.isArray(stored['env']) ? (stored['env'] as unknown[]) : []) {
        const record = asObject(envEntry) ?? {};
        if (asObject(record['valueFrom'])) continue;
        storedEnv.set(String(record['name'] ?? ''), String(record['value'] ?? ''));
      }
      const nextEnv = new Map<string, string>();
      for (const entry of container.env) {
        if (entry.reference) continue;
        nextEnv.set(entry.name.trim(), entry.value);
      }
      for (const [name, before] of storedEnv) {
        if (!nextEnv.has(name)) {
          rows.push({
            path: `spec.template.spec.containers.${container.name}.env.${name}`,
            before,
            after: t('workloads.editSettings.removed'),
          });
        }
      }
      for (const [name, after] of nextEnv) {
        const before = storedEnv.get(name);
        if (before === undefined) {
          rows.push({
            path: `spec.template.spec.containers.${container.name}.env.${name}`,
            before: '-',
            after,
          });
        } else if (before !== after) {
          rows.push({
            path: `spec.template.spec.containers.${container.name}.env.${name}`,
            before,
            after,
          });
        }
      }
    });
    return rows;
  }, [drafts, initialContainers, raw, replicas, supportsReplicas, t]);

  /** Build the object the API will store: a clone with only the edited fields replaced. */
  const buildBody = (): KubeObject => {
    // The stored object is cloned, not rebuilt: a PUT replaces the whole object, and a
    // body built from the form alone would wipe the fields the form does not show
    // (probes, resources, volumes, affinity) — the exact regression the YAML editor's
    // merge logic exists to avoid.
    const next = JSON.parse(JSON.stringify(raw)) as JsonObject;
    const spec = asObject(next['spec']);
    if (spec && supportsReplicas && replicas !== '') spec['replicas'] = replicas;
    const template = templateOf(kind, next);
    const podSpec = template ? asObject(template['spec']) : undefined;
    const storedContainers = podSpec && Array.isArray(podSpec['containers']) ? podSpec['containers'] : [];
    drafts.forEach((container, index) => {
      const target = asObject(storedContainers[index]);
      if (!target) return;
      target['image'] = container.image.trim();
      if (container.pullPolicy) target['imagePullPolicy'] = container.pullPolicy;
      else delete target['imagePullPolicy'];
      const env: JsonObject[] = [];
      for (const entry of container.env) {
        if (entry.reference) env.push(entry.reference);
        else env.push({ name: entry.name.trim(), value: entry.value });
      }
      if (env.length > 0) target['env'] = env;
      else delete target['env'];
    });
    return next as KubeObject;
  };

  const submit = async (): Promise<void> => {
    setError(null);
    try {
      await onSubmit(buildBody());
    } catch (cause) {
      /*
       * 409 is its own message: the object changed under the dialog, and telling the
       * reader "save failed" would have them retry the same stale edit forever. The
       * dialog stays open so nothing they typed is lost.
       */
      if (cause instanceof ApiError && cause.isConflict) {
        setError(t('workloads.editSettings.conflict'));
      } else if (cause instanceof ApiError) {
        setError(cause.message || t('workloads.editSettings.failed'));
      } else {
        setError(t('workloads.editSettings.failed'));
      }
    }
  };

  const blocked = pending || imageMissing || replicasInvalid || envNameIssues.size > 0 || changes.length === 0;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t('workloads.editSettings.title')}
      description={detail.name}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" disabled={blocked} {...actionProps(`${kind}-edit:submit`)} onClick={() => void submit()}>
            {t('common.confirm')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4" data-ai-id={`${kind}-edit:surface`}>
        <p className="text-xs text-ai-fg-muted">{t('workloads.editSettings.hint')}</p>

        {supportsReplicas ? (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ai-fg-secondary">{t('workloads.editSettings.replicas')}</span>
            <Input
              type="number"
              min={0}
              value={String(replicas)}
              {...actionProps(`${kind}-edit:replicas`)}
              onChange={(event) => setReplicas(event.target.value === '' ? '' : Number(event.target.value))}
            />
            <span className="text-[11px] text-ai-fg-muted">{t('workloads.editSettings.replicasHint')}</span>
            {replicasInvalid ? (
              <span role="alert" className="text-[11px] text-ai-danger" data-ai-id={`${kind}-edit:replicas-error`}>
                {t('workloads.editSettings.replicasInvalid')}
              </span>
            ) : null}
          </label>
        ) : null}

        {drafts.length === 0 ? <p className="text-xs text-ai-fg-muted">{t('workloads.editSettings.noContainers')}</p> : null}

        {drafts.map((container, containerIndex) => {
          const suffix = suffixFor(container);
          return (
            <section key={container.name || containerIndex} className="rounded-ai-md border border-ai-line p-3" data-ai-row={container.name}>
              <h3 className="mb-2 text-xs font-medium text-ai-fg">
                {t('workloads.editSettings.container')} <span className="font-mono text-[11px] text-ai-fg-muted">{container.name}</span>
              </h3>
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-ai-fg-secondary">{t('workloads.editSettings.image')}</span>
                  <Input
                    value={container.image}
                    {...actionProps(`${kind}-edit:image${suffix}`)}
                    onChange={(event) => setContainer(containerIndex, { image: event.target.value })}
                  />
                  {imageMissing ? (
                    <span role="alert" className="text-[11px] text-ai-danger">
                      {t('workloads.editSettings.imageRequired')}
                    </span>
                  ) : null}
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-ai-fg-secondary">{t('workloads.editSettings.pullPolicy')}</span>
                  <div>
                    <Select
                      value={container.pullPolicy || INHERIT_PULL_POLICY}
                      options={[
                        { value: INHERIT_PULL_POLICY, label: t('workloads.editSettings.pullPolicyInherit') },
                        ...PULL_POLICIES.map((policy) => ({ value: policy, label: policy })),
                      ]}
                      data-ai-id={`${kind}-edit:pull-policy${suffix}`}
                      aria-label={t('workloads.editSettings.pullPolicy')}
                      onValueChange={(value: string) =>
                        setContainer(containerIndex, { pullPolicy: value === INHERIT_PULL_POLICY ? '' : value })
                      }
                    />
                  </div>
                </label>

                <div className="flex flex-col gap-2" data-ai-id={`${kind}-edit:env${suffix}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-ai-fg-secondary">{t('workloads.editSettings.env')}</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      {...actionProps(`${kind}-edit:env-add${suffix}`)}
                      onClick={() => addEnv(containerIndex)}
                    >
                      <Icon name="add" size={12} />
                      {t('workloads.editSettings.envAdd')}
                    </Button>
                  </div>
                  {container.env.length === 0 ? (
                    <p className="text-[11px] text-ai-fg-muted">{t('workloads.editSettings.envEmpty')}</p>
                  ) : null}
                  {container.env.map((entry) => {
                    const issue = envNameIssues.get(entry.id);
                    return (
                      <div
                        key={entry.id}
                        className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                        data-ai-row={`env-${entry.id}`}
                      >
                        <Input
                          value={entry.name}
                          placeholder={t('workloads.editSettings.envKey')}
                          disabled={Boolean(entry.reference)}
                          aria-label={t('workloads.editSettings.envKey')}
                          {...actionProps(`${kind}-edit:env-key${suffix}:${entry.id}`)}
                          onChange={(event) => updateEnv(containerIndex, entry.id, { name: event.target.value })}
                        />
                        <Input
                          value={entry.reference ? t('workloads.editSettings.envReferenceValue') : entry.value}
                          placeholder={t('workloads.editSettings.envValue')}
                          disabled={Boolean(entry.reference)}
                          aria-label={t('workloads.editSettings.envValue')}
                          {...actionProps(`${kind}-edit:env-value${suffix}:${entry.id}`)}
                          onChange={(event) => updateEnv(containerIndex, entry.id, { value: event.target.value })}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t('workloads.editSettings.envRemove')}
                          disabled={Boolean(entry.reference)}
                          {...actionProps(`${kind}-edit:env-remove${suffix}:${entry.id}`)}
                          onClick={() => removeEnv(containerIndex, entry.id)}
                        >
                          <Icon name="trash" size={14} />
                        </Button>
                        {issue ? (
                          <span role="alert" className="text-[11px] text-ai-danger sm:col-span-2">
                            {issue}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                  {container.env.some((entry) => entry.reference) ? (
                    <p className="text-[11px] text-ai-fg-muted">{t('workloads.editSettings.envReference')}</p>
                  ) : null}
                </div>
              </div>
            </section>
          );
        })}

        {/* The diff is the reason this dialog can be trusted with a whole-object PUT. */}
        <section className="rounded-ai-md border border-ai-line p-3" data-ai-id={`${kind}-edit:diff`}>
          <h3 className="mb-2 text-xs font-medium text-ai-fg">{t('workloads.editSettings.changes')}</h3>
          {changes.length === 0 ? (
            <p className="text-[11px] text-ai-fg-muted">{t('workloads.editSettings.noChanges')}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-[11px]">
              {changes.map((change) => (
                <li key={change.path} className="grid grid-cols-1 gap-1 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]" data-ai-row={change.path}>
                  <code className="truncate font-mono text-ai-fg-secondary" title={change.path}>
                    {change.path}
                  </code>
                  <span className="min-w-0 break-all text-ai-fg-muted">
                    {change.before} → <span className="text-ai-fg">{change.after}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {error ? (
          <p role="alert" className="text-xs text-ai-danger" data-ai-id={`${kind}-edit:error`}>
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

export default EditWorkloadDialog;
