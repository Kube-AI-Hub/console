import type { Client } from './client';
import { ApiError } from './errors';
import { annotationKeys } from './resources';

/**
 * Federated projects and the Federated resources inside them.
 *
 * A federated project (多集群项目) is one `FederatedNamespace` object in the KubeFed
 * control plane: its `spec.template` carries the namespace metadata to propagate and
 * `spec.placement` says which clusters receive it. The console reads and writes this
 * group directly instead of through the tenant proxy, whose collection answers 0 for
 * these objects (measured: 1 in the federation API, 0 through tenant) because the
 * workspace label lives on the template rather than on the object.
 *
 * Write semantics were measured against the live federation control plane and are
 * recorded on each method: creating a project is *two* objects, and deleting is one
 * namespace delete. Those are not obvious from the CRD, and the "simplified" version
 * silently leaves half a project behind.
 */

/** The group/version the KubeFed control plane serves. */
export const FEDERATED_API = '/apis/types.kubefed.io/v1beta1';

/** Tenant route a project's host namespace is created through (the product write path). */
const WORKSPACE_NAMESPACES = '/kapis/tenant.kubesphere.io/v1alpha2/workspaces';

/** Core read/delete path for a host namespace. */
const CORE_NAMESPACES = '/api/v1/namespaces';

/** The path of one FederatedNamespace object. */
function objectPath(name: string): string {
  return `${FEDERATED_API}/namespaces/${encodeURIComponent(name)}/federatednamespaces/${encodeURIComponent(name)}`;
}

/** The cluster-wide collection the list and every lookup read. */
function collectionPath(): string {
  return `${FEDERATED_API}/federatednamespaces`;
}

type JsonObject = Record<string, unknown>;

/** A raw object from the federation API, as much of it as this module reads. */
export interface KubeFederatedObject {
  apiVersion?: string;
  kind?: string;
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
    resourceVersion?: string;
    deletionTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    finalizers?: string[];
  };
  spec?: {
    placement?: {
      clusters?: Array<{ name?: string }>;
      clusterSelector?: JsonObject;
    };
    template?: {
      metadata?: {
        name?: string;
        namespace?: string;
        labels?: Record<string, string>;
        annotations?: Record<string, string>;
      };
    };
    overrides?: Array<{ clusterName?: string; clusterOverrides?: Array<{ path?: string; value?: unknown }> }>;
  };
  status?: {
    clusters?: Array<{ name?: string }>;
    conditions?: Array<{
      type?: string;
      status?: string;
      reason?: string;
      message?: string;
      lastTransitionTime?: string;
    }>;
  };
}

/** One propagation condition reported by the control plane. */
export interface FederatedCondition {
  type: string;
  status: string;
  reason: string;
  message: string;
  lastTransitionTime: string;
}

/** One federated project, as the list and the detail header show it. */
export interface FederatedProjectSummary {
  name: string;
  /** The namespace the FederatedNamespace lives in; equal to the name in practice. */
  namespace: string;
  /**
   * The owning enterprise space.
   *
   * Read from the **template** metadata labels: that is the metadata the control plane
   * propagates, and the pre-existing objects carry it only there. Objects created by
   * this console also label the object itself, so both are read, template first.
   */
  workspace: string;
  /** `kubesphere.io/alias-name` on the object. */
  alias: string;
  /** `kubesphere.io/description` on the object. */
  description: string;
  /** `kubesphere.io/creator` on the object. */
  creator: string;
  /** Placement, from `status.clusters` (reported) falling back to `spec.placement.clusters`. */
  clusters: string[];
  /**
   * The `Propagation` condition: `true` reported healthy, `false` reported failing,
   * `undefined` when the control plane has not reported yet. Three states because
   * "not ready" and "no report" call for different copy.
   */
  propagated: boolean | undefined;
  createdAt: string;
  /** True while the object is being deleted (a finalizer is still running). */
  terminating: boolean;
}

/** The project plus the metadata the detail's 元数据 tab shows. */
export interface FederatedProjectDetail extends FederatedProjectSummary {
  labels: Record<string, string>;
  annotations: Record<string, string>;
  templateLabels: Record<string, string>;
  /** `spec.placement.clusterSelector`, when the project was placed by selector. */
  clusterSelector: JsonObject | undefined;
  conditions: FederatedCondition[];
  raw: KubeFederatedObject;
}

/** The workspace label the control plane propagates. */
export const WORKSPACE_LABEL = 'kubesphere.io/workspace';

/** The label that lets KubeFed manage a namespace it did not create. */
export const MANAGED_LABEL = 'kubefed.io/managed';

/** The override path that delivers the project annotations into each cluster's namespace. */
const ANNOTATIONS_OVERRIDE_PATH = '/metadata/annotations';

/** One namespaced Federated type from discovery. */
export interface FederatedResourceType {
  kind: string;
  plural: string;
}

/** One federated object inside a project's namespace. */
export interface FederatedResourceObject {
  name: string;
  /** Collection name, e.g. `federateddeployments`; the detail request needs it. */
  plural: string;
  /** e.g. `FederatedDeployment`; the row's type column. */
  kind: string;
  createdAt: string;
}

/**
 * Federated collection name ↔ console URL segment.
 *
 * The detail route keeps the old console's shape
 * (`…/federatedprojects/<project>/deployments/<name>`), so `federateddeployments`
 * becomes `deployments`; the API still needs the Federated collection name. Keeping
 * both directions in one table means the two cannot drift.
 */
export const FEDERATED_RESOURCE_SEGMENTS: Readonly<Record<string, string>> = {
  federatedapplications: 'applications',
  federateddeployments: 'deployments',
  federatedstatefulsets: 'statefulsets',
  federatedreplicasets: 'replicasets',
  federatedjobs: 'jobs',
  federatedservices: 'services',
  federatedingresses: 'ingresses',
  federatedconfigmaps: 'configmaps',
  federatedsecrets: 'secrets',
  federatedserviceaccounts: 'serviceaccounts',
  federatedlimitranges: 'limitranges',
  federatedpersistentvolumeclaims: 'persistentvolumeclaims',
};

export function segmentOf(plural: string): string {
  return FEDERATED_RESOURCE_SEGMENTS[plural] ?? plural;
}

export function pluralOf(segment: string): string | undefined {
  return Object.entries(FEDERATED_RESOURCE_SEGMENTS).find(([, value]) => value === segment)?.[0];
}

/** The workspace a FederatedNamespace belongs to. Template label first; see the interface. */
export function workspaceOf(item: KubeFederatedObject): string {
  const template = item.spec?.template?.metadata?.labels ?? {};
  return template[WORKSPACE_LABEL] ?? item.metadata?.labels?.[WORKSPACE_LABEL] ?? '';
}

/**
 * Clusters the control plane reports, falling back to the requested placement.
 *
 * The fallback only applies when `status.clusters` is absent: a reported empty list
 * means the control plane says "nowhere", which is a different fact from "not reported
 * yet" and must not be replaced by the requested placement.
 */
export function clustersOf(item: KubeFederatedObject): string[] {
  const reported = item.status?.clusters;
  if (reported !== undefined) {
    return reported.map((entry) => String(entry.name ?? '')).filter(Boolean);
  }
  return (item.spec?.placement?.clusters ?? []).map((entry) => String(entry.name ?? '')).filter(Boolean);
}

/** The Propagation condition as three states (true / false / not reported). */
export function propagatedOf(item: KubeFederatedObject): boolean | undefined {
  const condition = (item.status?.conditions ?? []).find((entry) => entry.type === 'Propagation');
  if (!condition) return undefined;
  if (condition.status === 'True') return true;
  if (condition.status === 'False') return false;
  return undefined;
}

export function toFederatedProject(item: KubeFederatedObject): FederatedProjectSummary {
  const annotations = item.metadata?.annotations ?? {};
  const name = item.metadata?.name ?? '';
  return {
    name,
    namespace: item.metadata?.namespace ?? name,
    workspace: workspaceOf(item),
    alias: annotations[annotationKeys.alias] ?? '',
    description: annotations[annotationKeys.description] ?? '',
    creator: annotations[annotationKeys.creator] ?? '',
    clusters: clustersOf(item),
    propagated: propagatedOf(item),
    createdAt: item.metadata?.creationTimestamp ?? '',
    terminating: Boolean(item.metadata?.deletionTimestamp),
  };
}

export function toFederatedProjectDetail(item: KubeFederatedObject): FederatedProjectDetail {
  return {
    ...toFederatedProject(item),
    labels: item.metadata?.labels ?? {},
    annotations: item.metadata?.annotations ?? {},
    templateLabels: item.spec?.template?.metadata?.labels ?? {},
    clusterSelector: item.spec?.placement?.clusterSelector,
    conditions: (item.status?.conditions ?? []).map((condition) => ({
      type: condition.type ?? '',
      status: condition.status ?? '',
      reason: condition.reason ?? '',
      message: condition.message ?? '',
      lastTransitionTime: condition.lastTransitionTime ?? '',
    })),
    raw: item,
  };
}

export interface CreateFederatedProjectInput {
  workspace: string;
  /** The project name (= the namespace name). */
  name: string;
  alias?: string;
  description?: string;
  /** Clusters that should receive the namespace; at least one. */
  clusters: string[];
}

/** A name Kubernetes accepts as a namespace. */
const PROJECT_NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

/**
 * Why a typed project name cannot be used, or `null` when it can.
 *
 * Separated from the dialog so the rule is testable and so the create request cannot
 * be reached with a name the API will reject after the namespace has already been
 * created — that would leave a half-created project behind.
 */
export function projectNameProblem(name: string): 'empty' | 'format' | 'length' | null {
  const value = name.trim();
  if (!value) return 'empty';
  if (value.length > 63) return 'length';
  if (!PROJECT_NAME_PATTERN.test(value)) return 'format';
  return null;
}

/** The annotations a project carries; shared by the object and its cluster overrides. */
function projectAnnotations(input: { creator?: string; alias?: string; description?: string }): Record<string, string> {
  const annotations: Record<string, string> = {};
  if (input.creator) annotations[annotationKeys.creator] = input.creator;
  if (input.alias?.trim()) annotations[annotationKeys.alias] = input.alias.trim();
  if (input.description?.trim()) annotations[annotationKeys.description] = input.description.trim();
  return annotations;
}

/** The body of the FederatedNamespace a project is. */
function projectObjectBody(input: CreateFederatedProjectInput & { creator?: string }): KubeFederatedObject {
  const annotations = projectAnnotations(input);
  const clusters = [...new Set(input.clusters.filter(Boolean))];
  return {
    apiVersion: 'types.kubefed.io/v1beta1',
    kind: 'FederatedNamespace',
    metadata: {
      name: input.name,
      namespace: input.name,
      labels: { [WORKSPACE_LABEL]: input.workspace },
      ...(Object.keys(annotations).length ? { annotations } : {}),
    },
    spec: {
      /*
       * Explicit cluster placement, not an empty clusterSelector: the create form selects
       * clusters, and an empty selector would place the project on every cluster,
       * including ones the reader did not choose.
       *
       * The template carries only labels: KubeFed rejects template annotations on
       * FederatedNamespace ("AnnotationsNotSupported") because they would conflict with
       * the host namespace's own annotations. Alias/description reach the copies through
       * `spec.overrides` instead.
       */
      placement: { clusters: clusters.map((name) => ({ name })) },
      template: { metadata: { labels: { [WORKSPACE_LABEL]: input.workspace } } },
      overrides: clusters.map((name) => ({
        clusterName: name,
        clusterOverrides: [{ path: ANNOTATIONS_OVERRIDE_PATH, value: annotations }],
      })),
    },
  };
}

/** The names of the placement clusters. */
function placementClusterNames(item: KubeFederatedObject): string[] {
  return (item.spec?.placement?.clusters ?? []).map((entry) => String(entry.name ?? '')).filter(Boolean);
}

/** A copy of the overrides with the annotations override for each placement cluster refreshed. */
function withAnnotationsOverrides(
  item: KubeFederatedObject,
  clusters: string[],
  annotations: Record<string, string>,
): Array<{ clusterName?: string; clusterOverrides?: Array<{ path?: string; value?: unknown }> }> {
  const existing = item.spec?.overrides ?? [];
  const byCluster = new Map(existing.map((override) => [override.clusterName ?? '', override]));
  return clusters.map((clusterName) => {
    const current = byCluster.get(clusterName);
    const overrides = (current?.clusterOverrides ?? []).filter((entry) => entry.path !== ANNOTATIONS_OVERRIDE_PATH);
    if (Object.keys(annotations).length > 0) {
      overrides.push({ path: ANNOTATIONS_OVERRIDE_PATH, value: annotations });
    }
    return { ...(current ?? {}), clusterName, clusterOverrides: overrides };
  });
}

/** Read the cluster-wide collection and return one raw object by name. */
async function fetchProjectObject(client: Client, name: string): Promise<KubeFederatedObject | null> {
  const body = await client.request<{ items?: KubeFederatedObject[] }>(collectionPath());
  return (body?.items ?? []).find((entry) => entry.metadata?.name === name) ?? null;
}

/** Read one project's detail, or `null` when it does not exist. */
async function fetchProjectDetail(client: Client, name: string): Promise<FederatedProjectDetail | null> {
  const item = await fetchProjectObject(client, name);
  return item ? toFederatedProjectDetail(item) : null;
}

function notFound(name: string): ApiError {
  return new ApiError({ code: 'not_found', message: `federated project ${name} not found` }, 404);
}

export function federatedApi(client: Client) {
  return {
    /**
     * Every federated project the reader can see.
     *
     * The tenant proxy's `workspaces/<ws>/federatednamespaces` answers 0 for these
     * objects (measured: 1 in the federation API, 0 through tenant) because it filters
     * on the object's own workspace label while the label lives on the template. This
     * reads the cluster-wide collection — the same read the control plane serves — and
     * filters by the template label here.
     *
     * That collection is a plain Kubernetes list: it has no KubeSphere page/sort
     * contract. The list page therefore pages and sorts the complete filtered set in
     * the browser; see the list decision in the design.
     */
    async listProjects(params: { workspace: string; signal?: AbortSignal }): Promise<FederatedProjectSummary[]> {
      const body = await client.request<{ items?: KubeFederatedObject[] }>(collectionPath(), {
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return (body?.items ?? [])
        .map(toFederatedProject)
        .filter((project) => project.name && (!params.workspace || project.workspace === params.workspace))
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    /** One project by name; `null` when it does not exist. */
    async getProject(params: { name: string; signal?: AbortSignal }): Promise<FederatedProjectDetail | null> {
      const body = await client.request<{ items?: KubeFederatedObject[] }>(collectionPath(), {
        ...(params.signal ? { signal: params.signal } : {}),
      });
      const item = (body?.items ?? []).find((entry) => entry.metadata?.name === params.name);
      return item ? toFederatedProjectDetail(item) : null;
    },

    /** Whether a host namespace with this name already exists (the create form's name check). */
    async projectExists(params: { name: string; signal?: AbortSignal }): Promise<boolean> {
      try {
        await client.request(`${CORE_NAMESPACES}/${encodeURIComponent(params.name)}`, {
          ...(params.signal ? { signal: params.signal } : {}),
        });
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.isNotFound) return false;
        throw error;
      }
    },

    /**
     * Create a federated project.
     *
     * Two writes, in this order, because a FederatedNamespace is a namespaced object
     * that lives *inside the namespace it federates*:
     *
     * 1. POST the host namespace through the tenant route, labelled managed by KubeFed.
     *    The label is what makes propagation report healthy: measured, a host namespace
     *    carrying `kubefed.io/managed: 'false'` (what the old console writes) leaves the
     *    `Propagation` condition at `False` forever with "Unable to manage the object
     *    which has label kubefed.io/managed: false", while the same create with `'true'`
     *    reports `True` immediately.
     * 2. POST the FederatedNamespace into that namespace.
     *
     * If step 2 fails the namespace is deleted again, so a failed create does not leave a
     * project-less namespace the reader cannot see or clean up from this page.
     */
    async createProject(input: CreateFederatedProjectInput & { creator?: string }): Promise<FederatedProjectDetail> {
      const name = input.name.trim();
      const workspace = input.workspace;
      await client.request(`${WORKSPACE_NAMESPACES}/${encodeURIComponent(workspace)}/namespaces`, {
        method: 'POST',
        body: {
          apiVersion: 'v1',
          kind: 'Namespace',
          metadata: {
            name,
            labels: {
              [WORKSPACE_LABEL]: workspace,
              [MANAGED_LABEL]: 'true',
            },
          },
        },
      });

      try {
        await client.request(`${FEDERATED_API}/namespaces/${encodeURIComponent(name)}/federatednamespaces`, {
          method: 'POST',
          body: projectObjectBody({ ...input, name, workspace }),
        });
      } catch (error) {
        // Best-effort rollback; the original failure is what the reader must see.
        await client.request(`${CORE_NAMESPACES}/${encodeURIComponent(name)}`, { method: 'DELETE' }).catch(() => undefined);
        throw error;
      }

      const created = await fetchProjectDetail(client, name);
      if (!created) throw notFound(name);
      return created;
    },

    /**
     * Edit the alias and description.
     *
     * They live on the FederatedNamespace's own annotations and are delivered to each
     * placement cluster by an override (template annotations are rejected by the control
     * plane). The whole object is PUT back so unrelated fields — placement, other
     * overrides — survive the edit.
     */
    async updateProjectInfo(params: {
      name: string;
      alias?: string;
      description?: string;
    }): Promise<FederatedProjectDetail> {
      const item = await fetchProjectObject(client, params.name);
      if (!item) throw notFound(params.name);
      const annotations = { ...(item.metadata?.annotations ?? {}) };
      if (params.alias !== undefined) {
        if (params.alias.trim()) annotations[annotationKeys.alias] = params.alias.trim();
        else delete annotations[annotationKeys.alias];
      }
      if (params.description !== undefined) {
        if (params.description.trim()) annotations[annotationKeys.description] = params.description.trim();
        else delete annotations[annotationKeys.description];
      }
      const clusters = placementClusterNames(item);
      const next: KubeFederatedObject = {
        ...item,
        metadata: { ...item.metadata, annotations },
        spec: { ...item.spec, overrides: withAnnotationsOverrides(item, clusters, annotations) },
      };
      await client.request(objectPath(params.name), { method: 'PUT', body: next });
      const updated = await fetchProjectDetail(client, params.name);
      if (!updated) throw notFound(params.name);
      return updated;
    },

    /**
     * Replace the placement cluster set.
     *
     * Removing a cluster makes the control plane delete the namespace on it; adding one
     * makes it create the namespace there. The override list is kept in step with the
     * placement so a cluster added later still receives the project annotations.
     */
    async updateProjectPlacement(params: { name: string; clusters: string[] }): Promise<FederatedProjectDetail> {
      const clusters = [...new Set(params.clusters.filter(Boolean))];
      if (clusters.length === 0) {
        throw new ApiError({ code: 'invalid', message: 'at least one cluster is required' }, 422);
      }
      const item = await fetchProjectObject(client, params.name);
      if (!item) throw notFound(params.name);
      const annotations = item.metadata?.annotations ?? {};
      const next: KubeFederatedObject = {
        ...item,
        spec: {
          ...item.spec,
          placement: { ...(item.spec?.placement ?? {}), clusters: clusters.map((name) => ({ name })) },
          overrides: withAnnotationsOverrides(item, clusters, annotations),
        },
      };
      await client.request(objectPath(params.name), { method: 'PUT', body: next });
      const updated = await fetchProjectDetail(client, params.name);
      if (!updated) throw notFound(params.name);
      return updated;
    },

    /**
     * Delete a federated project.
     *
     * Deletes the host **namespace**, which is what the project is: the namespace
     * deletion cascades the FederatedNamespace (measured: the federated object disappears
     * a few seconds later as its finalizer releases) and therefore also the propagated
     * copies. Deleting only the FederatedNamespace would leave the host namespace behind
     * for projects the control plane does not manage.
     */
    async deleteProject(params: { name: string }): Promise<void> {
      await client.request(`${CORE_NAMESPACES}/${encodeURIComponent(params.name)}`, { method: 'DELETE' });
    },

    /** Delete several projects; reports which names failed instead of stopping at the first. */
    async deleteProjects(params: { names: string[] }): Promise<{ failed: Array<{ name: string; error: unknown }> }> {
      const results = await Promise.allSettled(params.names.map((name) => this.deleteProject({ name })));
      const failed: Array<{ name: string; error: unknown }> = [];
      results.forEach((result, index) => {
        if (result.status === 'rejected') failed.push({ name: params.names[index] ?? '', error: result.reason });
      });
      return { failed };
    },

    /** The path of one FederatedNamespace object. */
    objectPath,

    /** The namespaced Federated types from API discovery (13 on this control plane). */
    async listResourceTypes(params: { signal?: AbortSignal } = {}): Promise<FederatedResourceType[]> {
      const body = await client.request<{
        resources?: Array<{ name?: string; kind?: string; namespaced?: boolean }>;
      }>(FEDERATED_API, {
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return (body?.resources ?? [])
        .filter((resource) => resource.namespaced === true && !String(resource.name ?? '').includes('/'))
        .map((resource) => ({ kind: String(resource.kind ?? ''), plural: String(resource.name ?? '') }))
        .filter((resource) => resource.kind && resource.plural)
        .sort((a, b) => a.kind.localeCompare(b.kind));
    },

    /** One project's objects of a Federated collection. */
    async listResources(params: {
      namespace: string;
      plural: string;
      signal?: AbortSignal;
    }): Promise<FederatedResourceObject[]> {
      const body = await client.request<{
        items?: Array<{ kind?: string; metadata?: { name?: string; creationTimestamp?: string } }>;
      }>(
        `${FEDERATED_API}/namespaces/${encodeURIComponent(params.namespace)}/${encodeURIComponent(params.plural)}`,
        { ...(params.signal ? { signal: params.signal } : {}) },
      );
      return (body?.items ?? [])
        .map((item) => ({
          name: item.metadata?.name ?? '',
          plural: params.plural,
          kind: item.kind ?? '',
          createdAt: item.metadata?.creationTimestamp ?? '',
        }))
        .filter((item) => Boolean(item.name));
    },

    /** One federated object; `null` for 404 (the route can outlive the object). */
    async getResource(params: {
      namespace: string;
      plural: string;
      name: string;
      signal?: AbortSignal;
    }): Promise<FederatedResourceDetail | null> {
      try {
        const item = await client.request<KubeFederatedObject>(
          `${FEDERATED_API}/namespaces/${encodeURIComponent(params.namespace)}/${encodeURIComponent(params.plural)}/${encodeURIComponent(params.name)}`,
          { ...(params.signal ? { signal: params.signal } : {}) },
        );
        return toFederatedResourceDetail(item ?? {}, params.name, params.namespace);
      } catch (error) {
        if (error instanceof ApiError && error.isNotFound) return null;
        throw error;
      }
    },
  };
}

export type FederatedApi = ReturnType<typeof federatedApi>;

/** One federated object's detail: its template and the distribution the control plane reports. */
export interface FederatedResourceDetail {
  name: string;
  namespace: string;
  kind: string;
  /** `spec.template` — the object the control plane spreads. */
  template: unknown;
  /** The full object, for the YAML view. */
  raw: KubeFederatedObject;
  clusters: string[];
  conditions: FederatedCondition[];
}

export function toFederatedResourceDetail(
  item: KubeFederatedObject,
  fallbackName: string,
  fallbackNamespace: string,
): FederatedResourceDetail {
  return {
    name: item.metadata?.name ?? fallbackName,
    namespace: item.metadata?.namespace ?? fallbackNamespace,
    kind: item.kind ?? '',
    template: item.spec?.template,
    raw: item,
    clusters: (item.status?.clusters ?? []).map((entry) => String(entry.name ?? '')).filter(Boolean),
    conditions: (item.status?.conditions ?? []).map((condition) => ({
      type: condition.type ?? '',
      status: condition.status ?? '',
      reason: condition.reason ?? '',
      message: condition.message ?? '',
      lastTransitionTime: condition.lastTransitionTime ?? '',
    })),
  };
}
