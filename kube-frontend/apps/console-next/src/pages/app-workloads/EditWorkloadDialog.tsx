import * as React from 'react';
import { Button, Icon, Input, Modal, Select } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { quantityToNumber, ApiError, type KubeObject, type WorkloadDetail, type WorkloadKind } from '@kube-ai-hub/api-client';
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
  resources: ResourceDraft;
  /** Empty means "leave the stored value alone"; Kubernetes defaults it when absent. */
  pullPolicy: string;
  env: EnvDraft[];
}

/** CPU/memory requests and limits, as typed. Empty means "not set". */
interface ResourceDraft {
  cpuRequest: string;
  cpuLimit: string;
  memoryRequest: string;
  memoryLimit: string;
}

/** The kinds whose pod template is immutable in a way that matters here. */
function editableStrategy(kind: WorkloadKind): boolean {
  return kind === 'deployments' || kind === 'statefulsets' || kind === 'daemonsets';
}

/** Where the update strategy lives for each kind (the old console's STRATEGIES_PREFIX). */
function strategyKey(kind: WorkloadKind): 'strategy' | 'updateStrategy' {
  return kind === 'deployments' ? 'strategy' : 'updateStrategy';
}

/** Strategy types each kind accepts; Recreate only exists for Deployments. */
function strategyTypes(kind: WorkloadKind): string[] {
  return kind === 'deployments' ? ['RollingUpdate', 'Recreate'] : ['RollingUpdate', 'OnDelete'];
}

interface StrategyDraft {
  type: string;
  maxUnavailable: string;
  maxSurge: string;
  partition: string;
}

function resourcesOf(container: JsonObject): ResourceDraft {
  const resources = asObject(container['resources']) ?? {};
  const requests = asObject(resources['requests']) ?? {};
  const limits = asObject(resources['limits']) ?? {};
  return {
    cpuRequest: String(requests['cpu'] ?? ''),
    cpuLimit: String(limits['cpu'] ?? ''),
    memoryRequest: String(requests['memory'] ?? ''),
    memoryLimit: String(limits['memory'] ?? ''),
  };
}

function strategyOf(kind: WorkloadKind, raw: JsonObject): StrategyDraft {
  const spec = asObject(raw['spec']) ?? {};
  const block = asObject(spec[strategyKey(kind)]) ?? {};
  const rolling = asObject(block['rollingUpdate']) ?? {};
  return {
    type: String(block['type'] ?? (kind === 'deployments' ? 'RollingUpdate' : 'RollingUpdate')),
    maxUnavailable: String(rolling['maxUnavailable'] ?? ''),
    maxSurge: String(rolling['maxSurge'] ?? ''),
    partition: String(rolling['partition'] ?? ''),
  };
}

/** One editable key/value row (node selectors, pod labels, pod annotations). */
interface PairDraft {
  id: number;
  key: string;
  value: string;
}

let pairSequence = 0;
function nextPairId(): number {
  pairSequence += 1;
  return pairSequence;
}

function pairsOf(map: unknown): PairDraft[] {
  const record = asObject(map) ?? {};
  return Object.entries(record).map(([key, value]) => ({ id: nextPairId(), key, value: String(value ?? '') }));
}

/** Drop rows with an empty key; an empty value is a legitimate label value. */
function mapOf(pairs: PairDraft[]): JsonObject {
  const out: JsonObject = {};
  for (const pair of pairs) {
    const key = pair.key.trim();
    if (key) out[key] = pair.value;
  }
  return out;
}

/** Label/annotation keys: optional DNS prefix, then a name; no whitespace. */
const PAIR_KEY = /^([A-Za-z0-9][-A-Za-z0-9.]*\/)?[A-Za-z0-9]([-A-Za-z0-9._]*[A-Za-z0-9])?$/;

/** Kubernetes quantity syntax: a number with an optional unit (`500m`, `1Gi`, `2`). */
const QUANTITY = /^[0-9]+(\.[0-9]+)?(m|k|M|G|T|Ki|Mi|Gi|Ti)?$/;

/** A percentage or an integer, which is what maxSurge/maxUnavailable accept. */
const INT_OR_PERCENT = /^([0-9]+%?)$/;

function toDrafts(kind: WorkloadKind, raw: JsonObject): ContainerDraft[] {
  return containersOf(kind, raw).map((container) => {
    const storedEnv = Array.isArray(container['env']) ? container['env'] : [];
    return {
      name: String(container['name'] ?? ''),
      image: String(container['image'] ?? ''),
      resources: resourcesOf(container),
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

/** Locale keys for the strategy type labels and their one-line explanations. */
type StrategyLabelKey =
  | 'workloads.editSettings.strategyRolling'
  | 'workloads.editSettings.strategyRecreate'
  | 'workloads.editSettings.strategyOnDelete';
type StrategyHintKey =
  | 'workloads.editSettings.strategyRollingHint'
  | 'workloads.editSettings.strategyRecreateHint'
  | 'workloads.editSettings.strategyOnDeleteHint';

function strategyLabelKey(type: string): StrategyLabelKey {
  if (type === 'Recreate') return 'workloads.editSettings.strategyRecreate';
  if (type === 'OnDelete') return 'workloads.editSettings.strategyOnDelete';
  return 'workloads.editSettings.strategyRolling';
}

function strategyHintKey(type: string): StrategyHintKey {
  if (type === 'Recreate') return 'workloads.editSettings.strategyRecreateHint';
  if (type === 'OnDelete') return 'workloads.editSettings.strategyOnDeleteHint';
  return 'workloads.editSettings.strategyRollingHint';
}

/**
 * A small key/value list editor.
 *
 * Three groups in this dialog are the same shape (node selector, pod labels, pod annotations), so
 * they share one control: a per-group copy would drift on the first change to either.
 */
function PairEditor({
  group,
  label,
  hint,
  rows,
  onChange,
  issues,
  disabled,
}: {
  group: string;
  label: string;
  hint: string;
  rows: PairDraft[];
  onChange: (rows: PairDraft[]) => void;
  issues: Map<string, string>;
  disabled: boolean;
}): React.ReactElement {
  const t = useT();
  const patch = (id: number, changes: Partial<PairDraft>): void => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...changes } : row)));
  };
  return (
    <div className="flex flex-col gap-2" data-ai-id={`edit-settings:${group}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-ai-fg-secondary">{label}</span>
        <Button size="sm" variant="secondary" {...actionProps(`edit-settings:${group}-add`)} disabled={disabled}
          onClick={() => onChange([...rows, { id: nextPairId(), key: '', value: '' }])}>
          <Icon name="add" size={12} />
          {t('workloads.editSettings.pairAdd')}
        </Button>
      </div>
      <span className="text-[11px] text-ai-fg-muted">{hint}</span>
      {rows.length === 0 ? <p className="text-[11px] text-ai-fg-muted">{t('workloads.editSettings.pairEmpty')}</p> : null}
      {rows.map((row) => (
        <div key={row.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" data-ai-row={`${group}-${row.id}`}>
          <Input value={row.key} placeholder={t('workloads.editSettings.pairKey')} disabled={disabled}
            aria-label={t('workloads.editSettings.pairKey')} {...actionProps(`edit-settings:${group}-key:${row.id}`)}
            onChange={(event) => patch(row.id, { key: event.target.value })} />
          <Input value={row.value} placeholder={t('workloads.editSettings.pairValue')} disabled={disabled}
            aria-label={t('workloads.editSettings.pairValue')} {...actionProps(`edit-settings:${group}-value:${row.id}`)}
            onChange={(event) => patch(row.id, { value: event.target.value })} />
          <Button variant="ghost" size="icon" aria-label={t('workloads.editSettings.pairRemove')} disabled={disabled}
            {...actionProps(`edit-settings:${group}-remove:${row.id}`)} onClick={() => onChange(rows.filter((entry) => entry.id !== row.id))}>
            <Icon name="trash" size={14} />
          </Button>
          {issues.get(`${group}:${row.id}`) ? (
            <span role="alert" className="text-[11px] text-ai-danger sm:col-span-3">{issues.get(`${group}:${row.id}`)}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
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
  const [strategy, setStrategy] = React.useState<StrategyDraft>({ type: 'RollingUpdate', maxUnavailable: '', maxSurge: '', partition: '' });
  const [nodeSelector, setNodeSelector] = React.useState<PairDraft[]>([]);
  const [podLabels, setPodLabels] = React.useState<PairDraft[]>([]);
  const [podAnnotations, setPodAnnotations] = React.useState<PairDraft[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // Re-seed on open: the same dialog instance edits different objects over time.
  React.useEffect(() => {
    if (!open) return;
    setDrafts(toDrafts(kind, raw));
    setReplicas(replicasOf(raw) ?? 1);
    setStrategy(strategyOf(kind, raw));
    const seedTemplate = templateOf(kind, raw);
    const seedPodSpec = seedTemplate ? asObject(seedTemplate['spec']) : undefined;
    setNodeSelector(pairsOf(seedPodSpec?.['nodeSelector']));
    setPodLabels(pairsOf(seedTemplate?.['metadata'] ? asObject(seedTemplate['metadata'])?.['labels'] : undefined));
    setPodAnnotations(pairsOf(seedTemplate?.['metadata'] ? asObject(seedTemplate['metadata'])?.['annotations'] : undefined));
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
      const storedResources = resourcesOf(stored);
      for (const [field, label] of [
        ['cpuRequest', 'resources.requests.cpu'],
        ['cpuLimit', 'resources.limits.cpu'],
        ['memoryRequest', 'resources.requests.memory'],
        ['memoryLimit', 'resources.limits.memory'],
      ] as const) {
        const before = storedResources[field];
        const after = container.resources[field].trim();
        if (before !== after) {
          rows.push({
            path: `spec.template.spec.containers.${container.name}.${label}`,
            before: before || '-',
            after: after || t('workloads.editSettings.removed'),
          });
        }
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
    if (editableStrategy(kind)) {
      const before = strategyOf(kind, raw);
      const key = strategyKey(kind);
      if (before.type !== strategy.type) {
        rows.push({ path: `spec.${key}.type`, before: before.type || '-', after: strategy.type });
      }
      const rolling: Array<[keyof StrategyDraft, string]> = kind === 'statefulsets'
        ? [['partition', 'partition']]
        : kind === 'deployments'
          ? [['maxUnavailable', 'maxUnavailable'], ['maxSurge', 'maxSurge']]
          : [['maxUnavailable', 'maxUnavailable']];
      if (strategy.type === 'RollingUpdate') {
        for (const [field, label] of rolling) {
          const previous = before[field];
          const next = strategy[field].trim();
          if (previous !== next) {
            rows.push({
              path: `spec.${key}.rollingUpdate.${label}`,
              before: previous || '-',
              after: next || t('workloads.editSettings.removed'),
            });
          }
        }
      }
    }
    const diffPairs = (group: string, before: unknown, after: PairDraft[]): void => {
      const stored = asObject(before) ?? {};
      const next = mapOf(after);
      for (const [key, value] of Object.entries(stored)) {
        if (!(key in next)) rows.push({ path: `${group}.${key}`, before: String(value ?? ''), after: t('workloads.editSettings.removed') });
        else if (String(value ?? '') !== next[key]) {
          rows.push({ path: `${group}.${key}`, before: String(value ?? ''), after: String(next[key]) });
        }
      }
      for (const [key, value] of Object.entries(next)) {
        if (!(key in stored)) rows.push({ path: `${group}.${key}`, before: '-', after: String(value) });
      }
    };
    const storedTemplate = templateOf(kind, raw);
    const storedPodSpec = storedTemplate ? asObject(storedTemplate['spec']) : undefined;
    const storedMetadata = storedTemplate ? asObject(storedTemplate['metadata']) : undefined;
    diffPairs('spec.template.spec.nodeSelector', storedPodSpec?.['nodeSelector'], nodeSelector);
    diffPairs('spec.template.metadata.labels', storedMetadata?.['labels'], podLabels);
    diffPairs('spec.template.metadata.annotations', storedMetadata?.['annotations'], podAnnotations);
    return rows;
  }, [drafts, initialContainers, kind, nodeSelector, podAnnotations, podLabels, raw, replicas, strategy, supportsReplicas, t]);

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
      /*
       * Resources: only the four fields this form owns are written, and the block is removed when
       * all of them are empty. Other keys a container may carry (hugepages, GPU vendor resources)
       * are preserved by editing the stored maps instead of replacing them.
       */
      const existing = asObject(target['resources']) ?? {};
      const requests = { ...(asObject(existing['requests']) ?? {}) };
      const limits = { ...(asObject(existing['limits']) ?? {}) };
      const apply = (bag: JsonObject, key: string, value: string): void => {
        if (value.trim()) bag[key] = value.trim();
        else delete bag[key];
      };
      apply(requests, 'cpu', container.resources.cpuRequest);
      apply(requests, 'memory', container.resources.memoryRequest);
      apply(limits, 'cpu', container.resources.cpuLimit);
      apply(limits, 'memory', container.resources.memoryLimit);
      const resources: JsonObject = { ...existing };
      if (Object.keys(requests).length > 0) resources['requests'] = requests;
      else delete resources['requests'];
      if (Object.keys(limits).length > 0) resources['limits'] = limits;
      else delete resources['limits'];
      if (Object.keys(resources).length > 0) target['resources'] = resources;
      else delete target['resources'];
    });
    const nextTemplate = templateOf(kind, next);
    const nextPodSpec = nextTemplate ? asObject(nextTemplate['spec']) : undefined;
    if (nextPodSpec) {
      const selector = mapOf(nodeSelector);
      if (Object.keys(selector).length > 0) nextPodSpec['nodeSelector'] = selector;
      else delete nextPodSpec['nodeSelector'];
    }
    if (nextTemplate) {
      const metadata = asObject(nextTemplate['metadata']) ?? {};
      const labels = mapOf(podLabels);
      const annotations = mapOf(podAnnotations);
      if (Object.keys(labels).length > 0) metadata['labels'] = labels;
      else delete metadata['labels'];
      if (Object.keys(annotations).length > 0) metadata['annotations'] = annotations;
      else delete metadata['annotations'];
      nextTemplate['metadata'] = metadata;
    }
    if (spec && editableStrategy(kind)) {
      const key = strategyKey(kind);
      const stored = asObject(spec[key]) ?? {};
      const block: JsonObject = { ...stored, type: strategy.type };
      if (strategy.type === 'RollingUpdate') {
        const rolling = { ...(asObject(stored['rollingUpdate']) ?? {}) };
        const setOrDelete = (name: string, value: string): void => {
          if (value.trim()) rolling[name] = value.trim();
          else delete rolling[name];
        };
        if (kind === 'statefulsets') setOrDelete('partition', strategy.partition);
        else {
          setOrDelete('maxUnavailable', strategy.maxUnavailable);
          if (kind === 'deployments') setOrDelete('maxSurge', strategy.maxSurge);
        }
        if (Object.keys(rolling).length > 0) block['rollingUpdate'] = rolling;
        else delete block['rollingUpdate'];
      } else {
        // Recreate / OnDelete carry no rolling parameters; leaving them would be dead data.
        delete block['rollingUpdate'];
      }
      spec[key] = block;
    }
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

  /**
   * Resource fields: syntax, and requests must not exceed limits.
   *
   * Kubernetes rejects `requests > limits` at admission, so catching it here keeps a typo from
   * turning into a failed write; the message names the container because the field grid alone does
   * not say which one is wrong.
   */
  const resourceIssues = React.useMemo(() => {
    const issues = new Map<string, string>();
    for (const container of drafts) {
      const { cpuRequest, cpuLimit, memoryRequest, memoryLimit } = container.resources;
      for (const value of [cpuRequest, cpuLimit, memoryRequest, memoryLimit]) {
        if (value.trim() && !QUANTITY.test(value.trim())) {
          issues.set(container.name, t('workloads.editSettings.resourceInvalid'));
          break;
        }
      }
      if (issues.has(container.name)) continue;
      if (cpuRequest.trim() && cpuLimit.trim() && quantityToNumber(cpuRequest) > quantityToNumber(cpuLimit)) {
        issues.set(container.name, t('workloads.editSettings.resourceOrder'));
        continue;
      }
      if (memoryRequest.trim() && memoryLimit.trim() && quantityToNumber(memoryRequest) > quantityToNumber(memoryLimit)) {
        issues.set(container.name, t('workloads.editSettings.resourceOrder'));
      }
    }
    return issues;
  }, [drafts, t]);

  /** Strategy numbers: a percentage or an integer; partition is an integer only. */
  const strategyInvalid = React.useMemo(() => {
    if (!editableStrategy(kind) || strategy.type !== 'RollingUpdate') return false;
    const values = kind === 'statefulsets'
      ? [strategy.partition]
      : kind === 'deployments'
        ? [strategy.maxUnavailable, strategy.maxSurge]
        : [strategy.maxUnavailable];
    return values.some((value) => value.trim() !== '' && !INT_OR_PERCENT.test(value.trim()));
  }, [kind, strategy]);

  /** Key/value rows: unique, well-formed keys; and the workload selector must survive. */
  const pairIssues = React.useMemo(() => {
    const issues = new Map<string, string>();
    const check = (rows: PairDraft[], group: string): void => {
      const seen = new Set<string>();
      for (const row of rows) {
        const key = row.key.trim();
        if (!key) {
          issues.set(`${group}:${row.id}`, t('workloads.editSettings.pairKeyRequired'));
          continue;
        }
        if (!PAIR_KEY.test(key)) {
          issues.set(`${group}:${row.id}`, t('workloads.editSettings.pairKeyInvalid'));
          continue;
        }
        if (seen.has(key)) issues.set(`${group}:${row.id}`, t('workloads.editSettings.pairKeyDuplicate'));
        seen.add(key);
      }
    };
    check(nodeSelector, 'nodeSelector');
    check(podLabels, 'labels');
    check(podAnnotations, 'annotations');
    return issues;
  }, [nodeSelector, podAnnotations, podLabels, t]);

  /**
   * The pod labels must keep matching the workload's selector.
   *
   * `spec.selector` is immutable after creation, so a label edit that drops a selector key would be
   * rejected by the apiserver with a message about an immutable field — far from the field the
   * reader changed. Checking it here names the label instead.
   */
  const selectorLabels = React.useMemo(() => {
    const spec = asObject(raw['spec']) ?? {};
    const selector = asObject(spec['selector']) ?? {};
    return asObject(selector['matchLabels']) ?? {};
  }, [raw]);
  const selectorBroken = React.useMemo(() => {
    const edited = mapOf(podLabels);
    return Object.entries(selectorLabels).some(([key, value]) => edited[key] !== String(value ?? ''));
  }, [podLabels, selectorLabels]);

  const blocked =
    pending ||
    imageMissing ||
    replicasInvalid ||
    envNameIssues.size > 0 ||
    resourceIssues.size > 0 ||
    strategyInvalid ||
    pairIssues.size > 0 ||
    selectorBroken ||
    changes.length === 0;

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

        {editableStrategy(kind) ? (
          <section className="flex flex-col gap-2 rounded-ai-md border border-ai-line p-3" data-ai-id={`${kind}-edit:strategy`}>
            <span className="text-xs text-ai-fg-secondary">{t('workloads.editSettings.strategy')}</span>
            <Select
              value={strategy.type}
              options={strategyTypes(kind).map((value) => ({ value, label: t(strategyLabelKey(value)) }))}
              data-ai-id={`${kind}-edit:strategy-type`}
              aria-label={t('workloads.editSettings.strategy')}
              onValueChange={(value: string) => setStrategy((previous) => ({ ...previous, type: value }))}
            />
            <span className="text-[11px] text-ai-fg-muted">{t(strategyHintKey(strategy.type))}</span>
            {strategy.type === 'RollingUpdate' ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {kind === 'statefulsets' ? (
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-ai-fg-muted">{t('workloads.editSettings.partition')}</span>
                    <Input
                      value={strategy.partition}
                      placeholder="0"
                      {...actionProps(`${kind}-edit:strategy-partition`)}
                      onChange={(event) => setStrategy((previous) => ({ ...previous, partition: event.target.value }))}
                    />
                  </label>
                ) : (
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-ai-fg-muted">{t('workloads.editSettings.maxUnavailable')}</span>
                    <Input
                      value={strategy.maxUnavailable}
                      placeholder="25%"
                      {...actionProps(`${kind}-edit:strategy-max-unavailable`)}
                      onChange={(event) => setStrategy((previous) => ({ ...previous, maxUnavailable: event.target.value }))}
                    />
                  </label>
                )}
                {kind === 'deployments' ? (
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-ai-fg-muted">{t('workloads.editSettings.maxSurge')}</span>
                    <Input
                      value={strategy.maxSurge}
                      placeholder="25%"
                      {...actionProps(`${kind}-edit:strategy-max-surge`)}
                      onChange={(event) => setStrategy((previous) => ({ ...previous, maxSurge: event.target.value }))}
                    />
                  </label>
                ) : null}
              </div>
            ) : null}
            {strategyInvalid ? (
              <span role="alert" className="text-[11px] text-ai-danger" data-ai-id={`${kind}-edit:strategy-error`}>
                {t('workloads.editSettings.strategyInvalid')}
              </span>
            ) : null}
          </section>
        ) : null}

        <section className="flex flex-col gap-3 rounded-ai-md border border-ai-line p-3" data-ai-id={`${kind}-edit:advanced`}>
          <h3 className="text-xs font-medium text-ai-fg">{t('workloads.editSettings.advanced')}</h3>
          <PairEditor
            group="node-selector"
            label={t('workloads.editSettings.nodeSelector')}
            hint={t('workloads.editSettings.nodeSelectorHint')}
            rows={nodeSelector}
            onChange={setNodeSelector}
            issues={pairIssues}
            disabled={pending}
          />
          <PairEditor
            group="pod-labels"
            label={t('workloads.editSettings.podLabels')}
            hint={selectorBroken ? t('workloads.editSettings.podLabelsSelector') : t('workloads.editSettings.podLabelsHint')}
            rows={podLabels}
            onChange={setPodLabels}
            issues={pairIssues}
            disabled={pending}
          />
          {selectorBroken ? (
            <span role="alert" className="text-[11px] text-ai-danger" data-ai-id={`${kind}-edit:selector-error`}>
              {t('workloads.editSettings.podLabelsSelector')}
            </span>
          ) : null}
          <PairEditor
            group="pod-annotations"
            label={t('workloads.editSettings.podAnnotations')}
            hint={t('workloads.editSettings.podAnnotationsHint')}
            rows={podAnnotations}
            onChange={setPodAnnotations}
            issues={pairIssues}
            disabled={pending}
          />
        </section>

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

                <div className="flex flex-col gap-2" data-ai-id={`${kind}-edit:resources${suffix}`}>
                  <span className="text-xs text-ai-fg-secondary">{t('workloads.editSettings.resources')}</span>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-ai-fg-muted">{t('workloads.editSettings.cpuRequest')}</span>
                      <Input
                        value={container.resources.cpuRequest}
                        placeholder="100m"
                        {...actionProps(`${kind}-edit:cpu-request${suffix}`)}
                        onChange={(event) =>
                          setContainer(containerIndex, {
                            resources: { ...container.resources, cpuRequest: event.target.value },
                          })
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-ai-fg-muted">{t('workloads.editSettings.cpuLimit')}</span>
                      <Input
                        value={container.resources.cpuLimit}
                        placeholder="1"
                        {...actionProps(`${kind}-edit:cpu-limit${suffix}`)}
                        onChange={(event) =>
                          setContainer(containerIndex, {
                            resources: { ...container.resources, cpuLimit: event.target.value },
                          })
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-ai-fg-muted">{t('workloads.editSettings.memoryRequest')}</span>
                      <Input
                        value={container.resources.memoryRequest}
                        placeholder="128Mi"
                        {...actionProps(`${kind}-edit:memory-request${suffix}`)}
                        onChange={(event) =>
                          setContainer(containerIndex, {
                            resources: { ...container.resources, memoryRequest: event.target.value },
                          })
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-ai-fg-muted">{t('workloads.editSettings.memoryLimit')}</span>
                      <Input
                        value={container.resources.memoryLimit}
                        placeholder="256Mi"
                        {...actionProps(`${kind}-edit:memory-limit${suffix}`)}
                        onChange={(event) =>
                          setContainer(containerIndex, {
                            resources: { ...container.resources, memoryLimit: event.target.value },
                          })
                        }
                      />
                    </label>
                  </div>
                  <span className="text-[11px] text-ai-fg-muted">{t('workloads.editSettings.resourcesHint')}</span>
                  {resourceIssues.get(container.name) ? (
                    <span role="alert" className="text-[11px] text-ai-danger" data-ai-id={`${kind}-edit:resources-error${suffix}`}>
                      {resourceIssues.get(container.name)}
                    </span>
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
