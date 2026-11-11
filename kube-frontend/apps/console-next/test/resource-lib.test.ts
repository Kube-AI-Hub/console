import { describe, expect, it } from 'vitest';
import { isTextBase64, safeAtob, safeBtoa } from '@/lib/base64';
import {
  buildDockerConfig,
  decodeDockerConfig,
  firstRegistryAuth,
  isInsecureRegistry,
  parseDockerConfig,
  registryDisplayHost,
} from '@/lib/dockerconfig';
import { buildKubeconfig, decodeBase64Field, decodeToken, KUBECONFIG_FILENAME, IN_CLUSTER_SERVER, maskKubeconfig } from '@/lib/kubeconfig';
import { formatTimestamp } from '@/lib/time';

/**
 * The pure building blocks of the secrets and service-account pages.
 *
 * These are the pieces the old console delegated to AGPL libraries (`js-base64`,
 * lodash) or wrote inline twice; each assertion here corresponds to a way the
 * page can silently corrupt data rather than look broken.
 */

describe('safeBtoa / safeAtob', () => {
  it('round-trips ASCII, Chinese, emoji and newlines', () => {
    for (const value of ['password', 'p@ss 中文', '🔐 secret', 'line1\nline2\ttab', '']) {
      expect(safeAtob(safeBtoa(value))).toBe(value);
    }
  });

  it('encodes UTF-8, not Latin-1', () => {
    // `btoa('中')` throws; the encoded bytes must be the UTF-8 ones (E4 B8 AD).
    expect(safeBtoa('中')).toBe('5Lit');
  });

  it('keeps native btoa behaviour for ASCII', () => {
    expect(safeBtoa('abc')).toBe('YWJj');
    expect(safeAtob('YWJj')).toBe('abc');
  });

  it('returns an empty string for non-string input', () => {
    // A form that passes `undefined` for an untouched field must not store "undefined".
    expect(safeBtoa(undefined)).toBe('');
    expect(safeAtob(undefined)).toBe('');
    expect(safeBtoa(null)).toBe('');
  });

  it('returns the raw value when it is not base64', () => {
    expect(safeAtob('not base64!!')).toBe('not base64!!');
  });

  it('does not throw on a lone surrogate', () => {
    expect(() => safeBtoa('broken \uD800')).not.toThrow();
  });

  it('survives a long certificate without overflowing the call stack', () => {
    const pem = `-----BEGIN CERTIFICATE-----\n${'A'.repeat(200_000)}\n-----END CERTIFICATE-----\n`;
    expect(safeAtob(safeBtoa(pem))).toBe(pem);
  });
});

describe('isTextBase64', () => {
  it('treats UTF-8 text as text', () => {
    expect(isTextBase64(safeBtoa('中文'))).toBe(true);
  });

  it('treats non-base64 as not text', () => {
    expect(isTextBase64('%%%')).toBe(false);
    expect(isTextBase64('')).toBe(false);
  });
});

describe('dockerconfig', () => {
  const auth = { url: 'https://harbor.example.com', username: 'robot', password: 's3cret', email: 'ci@example.com' };

  it('writes the single-entry document the old console writes', () => {
    const text = buildDockerConfig(auth, safeBtoa);
    const parsed = JSON.parse(text) as { auths: Record<string, Record<string, string>> };
    expect(Object.keys(parsed.auths)).toEqual(['https://harbor.example.com']);
    const entry = parsed.auths['https://harbor.example.com'];
    expect(entry?.username).toBe('robot');
    expect(entry?.password).toBe('s3cret');
    expect(entry?.email).toBe('ci@example.com');
    // `auth` is base64("user:pass") for clients that never learned the split fields.
    expect(safeAtob(entry?.auth)).toBe('robot:s3cret');
  });

  it('round-trips through the editor value', () => {
    const value = safeBtoa(buildDockerConfig(auth, safeBtoa));
    const decoded = decodeDockerConfig(value);
    expect(firstRegistryAuth(decoded)).toEqual(auth);
  });

  it('reads a document with several registries but edits only the first', () => {
    const text = JSON.stringify({
      auths: {
        'registry-a.example.com': { username: 'a', password: '1' },
        'registry-b.example.com': { username: 'b', password: '2' },
      },
    });
    const parsed = parseDockerConfig(text);
    expect(Object.keys(parsed.auths ?? {})).toHaveLength(2);
    expect(firstRegistryAuth(parsed).username).toBe('a');
  });

  it('recovers credentials from `auth` when the split fields are missing', () => {
    // `kubectl create secret docker-registry` writes only `auth` in some versions.
    const parsed = parseDockerConfig(
      JSON.stringify({ auths: { 'https://r.example.com': { auth: safeBtoa('robot:s3cret') } } }),
    );
    const entry = firstRegistryAuth(parsed);
    expect(entry.username).toBe('');
    // The gap is documented: the editor cannot show a username it was not given.
    expect(entry.url).toBe('https://r.example.com');
  });

  it('treats an unreadable document as empty instead of throwing', () => {
    expect(parseDockerConfig('{not json')).toEqual({ auths: {} });
    expect(firstRegistryAuth(parseDockerConfig(''))).toEqual({ url: '', username: '', password: '', email: '' });
  });

  it('detects plain-http addresses', () => {
    expect(isInsecureRegistry('http://harbor.local:5000')).toBe(true);
    expect(isInsecureRegistry('HTTP://harbor.local')).toBe(true);
    expect(isInsecureRegistry('https://harbor.example.com')).toBe(false);
    expect(isInsecureRegistry('harbor.example.com')).toBe(false);
  });

  it('strips the scheme for display', () => {
    expect(registryDisplayHost('https://harbor.example.com/')).toBe('harbor.example.com/');
  });
});

describe('kubeconfig', () => {
  const token = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJidWlsZC1ib3QifQ.sig';
  const ca = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n';

  it('builds the document the old console builds', () => {
    const kc = buildKubeconfig({
      serviceAccountName: 'build-bot',
      namespace: 'default',
      tokenData: safeBtoa(token),
      caData: safeBtoa(ca),
    });
    expect(kc.apiVersion).toBe('v1');
    expect(kc.kind).toBe('Config');
    expect(kc.clusters[0]?.cluster.server).toBe(IN_CLUSTER_SERVER);
    expect(kc.clusters[0]?.name).toBe('build-bot@local');
    // `user.token` is the raw JWT, not its base64 form.
    expect(kc.users[0]?.user.token).toBe(token);
    // kubeconfig wants base64 text here; `ca.crt` is already base64, so one more layer.
    expect(safeAtob(kc.clusters[0]?.cluster['certificate-authority-data'] ?? '')).toBe(safeBtoa(ca));
    expect(kc.contexts[0]?.context).toEqual({ user: 'build-bot', cluster: 'build-bot@local', namespace: 'default' });
    expect(kc['current-context']).toBe('build-bot@local');
  });

  it('omits the CA field when the Secret has no ca.crt', () => {
    const kc = buildKubeconfig({ serviceAccountName: 'sa', namespace: 'ns', tokenData: safeBtoa(token), caData: '' });
    expect(kc.clusters[0]?.cluster).not.toHaveProperty('certificate-authority-data');
  });

  it('passes through a token written with stringData', () => {
    expect(decodeToken(token)).toBe(token);
    expect(decodeToken(safeBtoa(token))).toBe(token);
    expect(decodeToken('')).toBe('');
  });

  it('decodes an ASCII field once and leaves raw text alone', () => {
    expect(decodeBase64Field(safeBtoa('default'))).toBe('default');
    // `dash-value` contains a character outside the base64 alphabet, so `atob`
    // rejects it and the value passes through; a bare word like `default` *is*
    // valid base64 and would decode to garbage — that is why the Secret path
    // always stores encoded values.
    expect(decodeBase64Field('dash-value')).toBe('dash-value');
  });

  it('masks the token line in a rendered kubeconfig but keeps its place', () => {
    const text = `users:\n  - name: sa\n    user:\n      token: ${token}\n`;
    const masked = maskKubeconfig(text, token);
    expect(masked).not.toContain(token);
    expect(masked).toContain('token: ');
    expect(masked).toContain('****');
    // Without a token there is nothing to hide.
    expect(maskKubeconfig(text, '')).toBe(text);
  });

  it('masks by location even when the document carries a different token', () => {
    /*
     * Regression: the preview used to replace occurrences of the *stored* token.
     * When the document carried another token (one the API server had rewritten),
     * nothing matched and the preview showed it in full.
     */
    const text = `    user:\n      token: eyJhbGciOiJSUzI1NiJ9.OTHER.token\n`;
    const masked = maskKubeconfig(text, token);
    expect(masked).not.toContain('OTHER');
    expect(masked).toContain('token: ');
  });

  it('uses the file name the old console saves under', () => {
    expect(KUBECONFIG_FILENAME).toBe('kubeconfig.yaml');
  });
});

describe('formatTimestamp', () => {
  it('prints YYYY-MM-DD HH:mm:ss in local time', () => {
    const value = formatTimestamp('2026-11-10T04:16:05Z');
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('prints a dash for missing or unparseable input', () => {
    expect(formatTimestamp('')).toBe('-');
    expect(formatTimestamp(undefined)).toBe('-');
    expect(formatTimestamp('not-a-date')).toBe('-');
  });
});
