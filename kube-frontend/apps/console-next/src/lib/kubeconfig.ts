import { safeBtoa } from './base64';

/**
 * kubeconfig built from a ServiceAccount token Secret.
 *
 * Same document the old console's `ServiceAccounts/Detail/.../Secret.jsx`
 * renders: one cluster pointing at the in-cluster API server, one user holding
 * the token, one context that pins the Secret's namespace. The point is to let a
 * person use the account from `kubectl` without assembling `ca.crt` and `token`
 * by hand — so every field is copied from the Secret rather than invented.
 *
 * `getValue()` there produced YAML; this returns the object and leaves
 * serialisation to the caller, so the preview, the copy button and the download
 * all render one document.
 */

export interface KubeconfigClusterContext {
  serviceAccountName: string;
  /** Secret namespace, which becomes the context's default namespace. */
  namespace: string;
  /** `data.token`, base64. */
  tokenData: string;
  /** `data['ca.crt']`, base64; empty when the Secret carries none (some clusters omit it). */
  caData: string;
}

export interface Kubeconfig {
  apiVersion: 'v1';
  kind: 'Config';
  clusters: Array<{
    name: string;
    cluster: { server: string; 'certificate-authority-data'?: string };
  }>;
  users: Array<{ name: string; user: { token: string } }>;
  contexts: Array<{
    name: string;
    context: { user: string; cluster: string; namespace: string };
  }>;
  'current-context': string;
}

/** The server address a pod inside the cluster reaches; the old console hard-codes it too. */
export const IN_CLUSTER_SERVER = 'https://kubernetes.default.svc:443';

/**
 * Base64 of a base64 string.
 *
 * A `certificate-authority-data` value is base64 of the PEM certificate, and
 * the Secret stores that base64 text with one more layer around it, so the
 * kubeconfig wants it re-encoded.
 */
const doubleEncode = (value: string): string => safeBtoa(value);

/** The raw JWT a kubeconfig `user.token` needs, from a stored `data.token`. */
export function tokenForKubeconfig(tokenData: string): string {
  return decodeToken(tokenData);
}

export function buildKubeconfig(input: KubeconfigClusterContext): Kubeconfig {
  const name = `${input.serviceAccountName}@local`;
  const token = tokenForKubeconfig(input.tokenData);
  return {
    apiVersion: 'v1',
    kind: 'Config',
    clusters: [
      {
        name,
        cluster: {
          server: IN_CLUSTER_SERVER,
          ...(input.caData ? { 'certificate-authority-data': doubleEncode(input.caData) } : {}),
        },
      },
    ],
    users: [{ name: input.serviceAccountName, user: { token } }],
    contexts: [
      {
        name,
        context: { user: input.serviceAccountName, cluster: name, namespace: input.namespace },
      },
    ],
    'current-context': name,
  };
}

/**
 * The value of a base64-encoded ASCII field (JWT, PEM certificate text).
 *
 * The rule is strictly "decode once when it decodes cleanly as base64, otherwise
 * pass through" — `atob` answers that authoritatively.
 */
export function decodeBase64Field(base64: string): string {
  if (!base64) return '';
  try {
    return atob(base64);
  } catch {
    // Already raw text; a Secret written with `stringData` can reach the page
    // with the value the user typed.
    return base64;
  }
}

/** `data.token` is base64 text; `kubectl` expects the decoded JWT. */
export function decodeToken(base64: string): string {
  const decoded = decodeBase64Field(base64);
  // A token Secret written with `stringData: token` arrives as the raw JWT, which
  // is not valid base64; passing it through keeps that Secret usable.
  if (decoded && decoded !== base64 && decoded.includes('.')) return decoded;
  return base64;
}

/**
 * Hide credentials inside a *rendered* kubeconfig.
 *
 * Used by the service-account detail page so that the preview cannot leak the
 * token the page's own eye toggle is hiding. The document keeps its shape — the
 * `token:` line stays in place with a masked value — and copy/download always use
 * the unmasked text.
 *
 * **Mask by location, not by value.** An earlier version replaced every
 * occurrence of the token string; when the stored token was not the same text the
 * document carried (a rotated token, or one the API server had rewritten), nothing
 * matched and the preview hid nothing. When the YAML serializer quoted or folded
 * the long token, a plain `split`/`join` could also fail to match. Masking the
 * value after `token:` relies on the document's own structure, which the builder
 * above guarantees.
 */
export function maskKubeconfig(documentText: string, token: string): string {
  if (!token) return documentText;
  const masked = `'${'*'.repeat(Math.min(token.length, 24))}'`;
  return documentText.replace(/(^|\n)(\s*-?\s*token:\s*)(.*)$/gm, (whole, start: string, prefix: string, value: string) =>
    value.trim() ? `${start}${prefix}${masked}` : whole,
  );
}

/** File name the old console saves under, so habits carry over. */
export const KUBECONFIG_FILENAME = 'kubeconfig.yaml';
