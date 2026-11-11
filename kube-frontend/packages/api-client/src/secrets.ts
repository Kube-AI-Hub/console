import type { Client } from './client';
import { baseOf, metadataAnnotations, resourceApi, type KubeObject, type ResourceBase } from './resources';

/**
 * Secret resources.
 *
 * Paths and methods mirror the old console one to one
 * (`console/src/stores/secret.js` + `stores/base.js`): reads through kapis,
 * writes through `/api/v1`. The one KubeSphere-specific operation is setting a
 * default image-registry secret, which is a plain annotation patch here as well.
 */

/** Types the console gives a friendly name to (`SECRET_TYPES` in the old console). */
export const KNOWN_SECRET_TYPES = [
  'Opaque',
  'kubernetes.io/tls',
  'kubernetes.io/dockerconfigjson',
  'kubernetes.io/basic-auth',
] as const;

/** Annotation KubeSphere uses to mark the namespace's default registry secret. */
export const DEFAULT_REGISTRY_ANNOTATION = 'secret.kubesphere.io/is-default-class';
/** Set when the registry address starts with `http://`, telling the image puller not to verify TLS. */
export const FORCE_INSECURE_ANNOTATION = 'secret.kubesphere.io/force-insecure';

export interface SecretSummary extends ResourceBase {
  type: string;
  /** Number of entries under `data` (`SECRET_FIELD_COUNT` in the old list). */
  fieldCount: number;
  /** `secret.kubesphere.io/is-default-class` is `true`. */
  isDefault: boolean;
}

export interface SecretDetail extends SecretSummary {
  /** `data` exactly as stored: base64 in, base64 out. */
  data: Record<string, string>;
  binaryData: Record<string, string>;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  raw: KubeSecret;
}

export interface KubeSecret extends KubeObject {
  type?: string;
  data?: Record<string, string>;
  stringData?: Record<string, string>;
  binaryData?: Record<string, string>;
}

export function toSecretSummary(item: KubeSecret): SecretSummary {
  const annotations = item.metadata?.annotations ?? {};
  return {
    ...baseOf(item),
    // kube-apiserver defaults an empty type to Opaque, but an object read back
    // before defaulting carries none; the list shows the effective type either way.
    type: item.type || 'Opaque',
    fieldCount: Object.keys(item.data ?? {}).length,
    isDefault: annotations[DEFAULT_REGISTRY_ANNOTATION] === 'true',
  };
}

export function toSecretDetail(item: KubeSecret): SecretDetail {
  return {
    ...toSecretSummary(item),
    data: item.data ?? {},
    binaryData: item.binaryData ?? {},
    labels: item.metadata?.labels ?? {},
    annotations: item.metadata?.annotations ?? {},
    raw: item,
  };
}

/** The match `IsValidSecretKey` in kube-apiserver applies to data keys. */
const KEY_PATTERN = /^[-._a-zA-Z0-9]+$/;

/** Why a key cannot be stored, or `null` when it can. */
export function secretKeyProblem(key: string): 'required' | 'pattern' | null {
  if (!key) return 'required';
  if (!KEY_PATTERN.test(key)) return 'pattern';
  return null;
}

/** The five built-in ServiceAccount secret types that kubelet manages, not people. */
const SYSTEM_SECRET_PREFIX = 'kubernetes.io/service-account';

export function isSystemManagedSecret(secret: { type: string }): boolean {
  return secret.type.startsWith(SYSTEM_SECRET_PREFIX);
}

export interface SecretInput {
  name: string;
  namespace: string;
  type: string;
  alias?: string;
  description?: string;
  /** Base64 values, as the API stores them. */
  data: Record<string, string>;
  /** Extra annotations the type editor contributes (e.g. `force-insecure`). */
  annotations?: Record<string, string>;
}

/**
 * Build the object to POST.
 *
 * Same shape as `FORM_TEMPLATES.secrets` in the old console: `apiVersion`,
 * `kind`, `metadata`, `type`, `data`. Values are already base64; the editors
 * encode on the boundary so this function stays pure and testable.
 */
export function toKubeSecret(input: SecretInput): KubeSecret {
  const annotations = { ...metadataAnnotations(input), ...(input.annotations ?? {}) };
  return {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: {
      name: input.name,
      namespace: input.namespace,
      ...(Object.keys(annotations).length ? { annotations } : {}),
    },
    type: input.type || 'Opaque',
    data: input.data,
  };
}

export function secretsApi(client: Client) {
  const api = resourceApi<KubeSecret, SecretSummary, SecretDetail>(client, {
    resource: 'secrets',
    toSummary: toSecretSummary,
    toDetail: toSecretDetail,
  });

  return {
    ...api,

    /**
     * Make `name` the namespace's default registry secret, clearing the mark from
     * `previous` in the same breath.
     *
     * The old console (`secret.default` → `secretStore.setDefault`) does exactly
     * this two-step patch: before setting a new default it finds the current one
     * and unsets it, because the image puller reads the annotation rather than a
     * policy field and two `true` values leave the choice undefined.
     */
    async setDefault(params: {
      cluster: string;
      namespace: string;
      name: string;
      /** The object currently marked default, if any. */
      previous?: string;
    }): Promise<void> {
      if (params.previous && params.previous !== params.name) {
        await api.patch({
          cluster: params.cluster,
          namespace: params.namespace,
          name: params.previous,
          body: { metadata: { annotations: { [DEFAULT_REGISTRY_ANNOTATION]: 'false' } } },
        });
      }
      await api.patch({
        cluster: params.cluster,
        namespace: params.namespace,
        name: params.name,
        body: { metadata: { annotations: { [DEFAULT_REGISTRY_ANNOTATION]: 'true' } } },
      });
    },
  };
}

export type SecretsApi = ReturnType<typeof secretsApi>;
