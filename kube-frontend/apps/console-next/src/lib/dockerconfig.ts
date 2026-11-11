import { safeAtob } from './base64';

/**
 * `.dockerconfigjson` helpers.
 *
 * The docker config file is a JSON document with one entry per registry under
 * `auths`. The old console reads the first key (`Object.keys(auths)[0]`), writes
 * a single entry, and keeps `auth` as base64 of `username:password` for older
 * clients that never learned the split fields. All three behaviours are kept:
 * dropping `auth` breaks `kubectl` on images pulled by older node runtimes, and
 * supporting several registries would be a new layout nobody's Secret has yet.
 */
export interface RegistryAuth {
  /** Registry address as typed, possibly with `http://` or `https://`. */
  url: string;
  username: string;
  password: string;
  email: string;
}

export interface DockerConfigJson {
  auths?: Record<string, { username?: string; password?: string; email?: string; auth?: string }>;
}

/** Parse a decoded `.dockerconfigjson`; an unreadable document yields `auths: {}`. */
export function parseDockerConfig(text: string): DockerConfigJson {
  if (!text.trim()) return { auths: {} };
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object') return { auths: {} };
    return parsed as DockerConfigJson;
  } catch {
    return { auths: {} };
  }
}

/** The first registry entry, which is the one the form edits. */
export function firstRegistryAuth(config: DockerConfigJson): RegistryAuth {
  const [url = ''] = Object.keys(config.auths ?? {});
  const entry = url ? (config.auths?.[url] ?? {}) : {};
  return {
    url,
    username: entry.username ?? '',
    password: entry.password ?? '',
    email: entry.email ?? '',
  };
}

/**
 * Serialise one registry entry the way the old console does:
 * `{ auths: { [url]: { username, password, email, auth } } }` with
 * `auth = base64("user:pass")`.
 *
 * `encode` is injected because base64 must be UTF-8 aware here too; the caller
 * passes `safeBtoa`.
 */
export function buildDockerConfig(auth: RegistryAuth, encode: (value: string) => string): string {
  return JSON.stringify({
    auths: {
      [auth.url]: {
        username: auth.username,
        password: auth.password,
        email: auth.email,
        auth: encode(`${auth.username}:${auth.password}`),
      },
    },
  });
}

/**
 * Whether the registry address asks for plain HTTP.
 *
 * Derived from the address rather than a separate switch: that is what the old
 * console's `handleAnnotationsByUrl` does, and it keeps the address and the
 * `force-insecure` annotation from disagreeing. Private registries inside a
 * cluster are routinely served over HTTP, and without the annotation the image
 * puller refuses the certificate rather than the connection.
 */
export function isInsecureRegistry(url: string): boolean {
  return /^http:\/\//i.test(url.trim());
}

/** What the form shows as a tip, mirroring `IMAGE_REGISTRY_VALIDATE_TIP`. */
export function registryDisplayHost(url: string): string {
  return url.trim().replace(/^https?:\/\//i, '');
}

/**
 * Decode a stored `.dockerconfigjson` value read through a plain list.
 *
 * Kept next to the parser so both call sites decode the same way; a Secret
 * fetched for display has its `data` still base64-encoded.
 */
export function decodeDockerConfig(base64: string): DockerConfigJson {
  return parseDockerConfig(safeAtob(base64));
}
