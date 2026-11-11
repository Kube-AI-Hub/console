import { KNOWN_SECRET_TYPES } from '@kube-ai-hub/api-client';

/**
 * The four type-specific editors.
 *
 * The old console offers the same four (`SecretSettings.getTypeOptions`); any
 * other type a Secret may already carry is shown read-only in the settings
 * dialog rather than being offered for creation. Typed as a small table so the
 * label keys and the data keys live together and cannot drift.
 */

/** i18n key per stored type; matches the old `SECRET_TYPES` map. */
export const SECRET_TYPE_LABEL: Record<string, string> = {
  Opaque: 'secrets.type.opaque',
  'kubernetes.io/tls': 'secrets.type.tls',
  'kubernetes.io/dockerconfigjson': 'secrets.type.dockerconfigjson',
  'kubernetes.io/basic-auth': 'secrets.type.basicAuth',
  // A system-managed account token is never picked by hand, but a detail page
  // can still be reached by URL for one.
  'kubernetes.io/service-account-token': 'secrets.type.serviceAccountToken',
};

export type SecretType = (typeof KNOWN_SECRET_TYPES)[number];

/** The keys each type must carry, per kube-apiserver's validation. */
export const REQUIRED_KEYS: Record<string, readonly string[]> = {
  Opaque: [],
  'kubernetes.io/tls': ['tls.crt', 'tls.key'],
  'kubernetes.io/dockerconfigjson': ['.dockerconfigjson'],
  'kubernetes.io/basic-auth': ['username', 'password'],
};

export function isKnownSecretType(type: string): type is SecretType {
  return (KNOWN_SECRET_TYPES as readonly string[]).includes(type);
}

/**
 * Whether the settings dialog may change `data` for this type.
 *
 * An unknown type (e.g. `kubernetes.io/ssh-auth`, or a CRD operator's own layout)
 * has no editor here; showing the generic key/value list would let a save
 * silently drop the type's required field set, so the dialog explains instead.
 */
export function isEditableSecretType(type: string): boolean {
  return isKnownSecretType(type);
}
