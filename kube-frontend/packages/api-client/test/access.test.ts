import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import {
  isProtectedPlatformUser,
  passwordChecks,
  passwordProblem,
  platformRoleOf,
  toClusterRoleSummary,
  toLoginRecord,
  toUserSummary,
  toWorkspaceSummary,
  userDetailApi,
  usersWriteApi,
} from '../src/access';

/**
 * Platform access mapping.
 *
 * Every field that matters lives in metadata, and the platform has used more than
 * one key over time — so "which key" is the specification here.
 */

describe('platform role', () => {
  it('prefers the platform-role annotation', () => {
    expect(
      platformRoleOf({ metadata: { annotations: { 'iam.kubesphere.io/platform-role': 'platform-admin' } } }),
    ).toBe('platform-admin');
  });

  it('falls back to the legacy globalrole key', () => {
    // Older objects carry `globalrole`; reading only the new key shows an empty
    // column for accounts that do have a role.
    expect(
      platformRoleOf({ metadata: { annotations: { 'iam.kubesphere.io/globalrole': 'platform-regular' } } }),
    ).toBe('platform-regular');
  });

  it('is empty when neither key exists', () => {
    expect(platformRoleOf({ metadata: { annotations: {} } })).toBe('');
  });
});

describe('user summary', () => {
  it('treats a user with no status as active', () => {
    expect(toUserSummary({ metadata: { name: 'alice' } }).status).toBe('Active');
  });

  it('reports a disabled account as disabled', () => {
    expect(toUserSummary({ metadata: { name: 'bob' }, status: { state: 'Disabled' } }).status).toBe('Disabled');
  });

  it('prefers status.lastLoginTime over the annotation, which also changes on password reset', () => {
    const user = toUserSummary({
      metadata: {
        name: 'carol',
        annotations: { 'iam.kubesphere.io/last-login-time': '2026-01-01T00:00:00Z' },
      },
      status: { lastLoginTime: '2026-11-01T08:00:00Z' },
    });
    expect(user.lastLogin).toBe('2026-11-01T08:00:00Z');
  });

  it('falls back to the last-login annotation when status has none', () => {
    const user = toUserSummary({
      metadata: {
        name: 'carol',
        annotations: { 'iam.kubesphere.io/last-login-time': '2026-11-01T08:00:00Z' },
      },
    });
    expect(user.lastLogin).toBe('2026-11-01T08:00:00Z');
    expect(toUserSummary({ metadata: { name: 'nobody' } }).lastLogin).toBe('');
  });

  /*
   * `spec.email` wins over the annotation.
   *
   * Every write path in this console (create, admin edit, personal settings) sets the spec
   * field, and so does the old console's mapper; reading the annotation first left the 邮箱
   * column blank for every account that had one. The annotation stays as a fallback for
   * installations that only carry it.
   */
  it('prefers spec.email and falls back to the annotation', () => {
    const withSpec = toUserSummary({
      metadata: { name: 'carol', annotations: { email: 'stale@example.com' } },
      spec: { email: 'c@example.com' },
    });
    expect(withSpec.email).toBe('c@example.com');

    const annotationOnly = toUserSummary({
      metadata: { name: 'dave', annotations: { email: 'd@example.com' } },
    });
    expect(annotationOnly.email).toBe('d@example.com');
  });
});

describe('cluster role summary', () => {
  it('marks template roles and counts rules', () => {
    const role = toClusterRoleSummary({
      metadata: { name: 'role-template-manage-users' },
      rules: [{}, {}],
    });
    expect(role.system).toBe(true);
    expect(role.ruleCount).toBe(2);
  });

  it('does not mark a regular role as a template', () => {
    expect(toClusterRoleSummary({ metadata: { name: 'platform-admin' } }).system).toBe(false);
  });
});

describe('workspace summary', () => {
  it('calls a workspace with no clusters the host cluster', () => {
    // `spec.clusters` empty means "this cluster only", which the old console labels
    // "Cluster"; showing nothing there reads as missing data.
    expect(toWorkspaceSummary({ metadata: { name: 'ws' }, spec: { clusters: [] } }).clusters).toBe('Cluster');
  });

  it('counts multi-cluster associations', () => {
    const ws = toWorkspaceSummary({ metadata: { name: 'ws' }, spec: { clusters: [{}, {}, {}] }, status: { phase: 'Active' } });
    expect(ws.clusters).toBe('Multi-cluster (3)');
    expect(ws.status).toBe('Active');
  });
});

/**
 * Password rules.
 *
 * The console is stricter than the apiserver: the CRD wants 8–64 bytes plus lower case, upper
 * case and a digit, while the copy the reader sees also promises a special character. These
 * cases pin the whole rule, because the difference between "the form refused" and "the server
 * refused with a 422 full of regex" is exactly this function.
 */
describe('user detail', () => {
  it('reads lastLoginTime from status and does not substitute the annotation', async () => {
    const client = createClient({
      fetchImpl: (async () =>
        Response.json({
          metadata: {
            name: 'alice',
            creationTimestamp: '2026-01-01T00:00:00Z',
            annotations: {
              'iam.kubesphere.io/last-login-time': '2026-01-02T00:00:00Z',
              'kubesphere.io/description': 'ops',
            },
          },
          spec: { email: 'a@example.com' },
          status: { state: 'Active', lastLoginTime: '2026-11-01T08:00:00Z' },
        })) as typeof fetch,
    });
    const detail = await userDetailApi(client).get({ name: 'alice' });
    expect(detail.lastLoginTime).toBe('2026-11-01T08:00:00Z');
    expect(detail.email).toBe('a@example.com');
    expect(detail.description).toBe('ops');
    expect(detail.state).toBe('Active');
  });
});

describe('login records', () => {
  it('keeps missing success undefined and empty IP empty', () => {
    const mapped = toLoginRecord({
      metadata: { name: 'admin-1', creationTimestamp: '2026-11-14T21:00:23Z' },
      spec: { reason: 'authenticated successfully' },
    });
    expect(mapped.success).toBeUndefined();
    expect(mapped.sourceIP).toBe('');
    expect(mapped.reason).toBe('authenticated successfully');
  });

  it('maps a failed sign-in without turning a missing flag into false', () => {
    const failed = toLoginRecord({
      metadata: { name: 'admin-2' },
      spec: { success: false, sourceIP: '10.0.0.1', reason: 'invalid password' },
    });
    expect(failed.success).toBe(false);
    expect(failed.sourceIP).toBe('10.0.0.1');
    expect(toLoginRecord({ metadata: { name: 'x' }, spec: { success: 'yes' } }).success).toBeUndefined();
  });

  it('pages with sortBy createTime and uses totalItems, not the page length', async () => {
    const urls: URL[] = [];
    const client = createClient({
      fetchImpl: (async (input) => {
        urls.push(new URL(String(input), 'http://localhost'));
        return Response.json({
          totalItems: 100,
          items: Array.from({ length: 10 }, (_, index) => ({
            metadata: { name: `admin-${index}`, creationTimestamp: '2026-11-14T21:00:23Z' },
            spec: { success: true, sourceIP: '10.233.76.4', reason: 'authenticated successfully' },
          })),
        });
      }) as typeof fetch,
    });
    const page = await userDetailApi(client).loginRecords({ name: 'admin', page: 2, limit: 10 });
    expect(page.total).toBe(100);
    expect(page.items).toHaveLength(10);
    expect(page.items[0]?.success).toBe(true);
    expect(Object.fromEntries(urls[0]!.searchParams)).toMatchObject({
      page: '2',
      limit: '10',
      sortBy: 'createTime',
      ascending: 'false',
    });
  });

  it('does not invent a total when totalItems is missing', async () => {
    const client = createClient({
      fetchImpl: (async () => Response.json({ items: [{ metadata: { name: 'a' }, spec: {} }] })) as typeof fetch,
    });
    const page = await userDetailApi(client).loginRecords({ name: 'alice' });
    expect(page.total).toBe(1);
  });
});

describe('protected platform users', () => {
  it('protects preset accounts and the signed-in user, not an ordinary name', () => {
    expect(isProtectedPlatformUser('admin')).toBe(true);
    expect(isProtectedPlatformUser('sonarqube')).toBe(true);
    expect(isProtectedPlatformUser('alice', 'alice')).toBe(true);
    expect(isProtectedPlatformUser('alice', 'admin')).toBe(false);
    expect(isProtectedPlatformUser('ui-test')).toBe(false);
    expect(isProtectedPlatformUser('')).toBe(true);
  });
});

describe('user create', () => {
  it('always marks the account uninitialized and only sends a description when given one', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const client = createClient({
      fetchImpl: (async (_input, init) => {
        bodies.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
        return Response.json({ metadata: { name: 'alice' } });
      }) as typeof fetch,
    });
    await usersWriteApi(client).create({
      name: 'alice',
      email: 'a@example.com',
      password: 'TcE2e@2026A',
      platformRole: 'platform-regular',
    });
    await usersWriteApi(client).create({
      name: 'bob',
      email: 'b@example.com',
      password: 'TcE2e@2026A',
      platformRole: 'platform-admin',
      description: 'temporary',
    });
    const first = (bodies[0]?.['metadata'] as { annotations: Record<string, string> }).annotations;
    const second = (bodies[1]?.['metadata'] as { annotations: Record<string, string> }).annotations;
    expect(first['iam.kubesphere.io/uninitialized']).toBe('true');
    expect(first['iam.kubesphere.io/platform-role']).toBe('platform-regular');
    expect(first).not.toHaveProperty('kubesphere.io/description');
    expect(second['iam.kubesphere.io/uninitialized']).toBe('true');
    expect(second['kubesphere.io/description']).toBe('temporary');
  });
});

describe('administrator password reset', () => {
  it('PUTs only the new password, never currentPassword', async () => {
    let url = '';
    let body: unknown;
    const client = createClient({
      fetchImpl: (async (input, init) => {
        url = String(input);
        body = JSON.parse(String(init?.body ?? '{}'));
        return Response.json({ message: 'success' });
      }) as typeof fetch,
    });
    await usersWriteApi(client).resetPassword({ name: 'alice', password: 'TcE2e@2026B' });
    expect(url).toContain('/kapis/iam.kubesphere.io/v1alpha2/users/alice/password');
    expect(body).toEqual({ password: 'TcE2e@2026B' });
    expect(body).not.toHaveProperty('currentPassword');
  });
});

describe('password problem', () => {
  it('accepts a password that satisfies every requirement', () => {
    expect(passwordProblem('Abcdefg1@')).toBeNull();
  });

  it('names the first unmet requirement, shortest first', () => {
    expect(passwordProblem('Abc1@')).toBe('too-short');
    expect(passwordProblem('12345678')).toBe('no-letter');
    expect(passwordProblem('ABCDEFG1@')).toBe('no-lower');
    expect(passwordProblem('abcdefg1@')).toBe('no-upper');
    expect(passwordProblem('Abcdefgh@')).toBe('no-digit');
  });

  it('requires a special character, which the apiserver does not', () => {
    // The platform accepts this one; the console does not, on purpose.
    expect(passwordProblem('Abcdefg1')).toBe('no-special');
  });

  it('caps the length in bytes, not characters', () => {
    // 30 Chinese characters: 30 characters but 90 bytes, and the CRD counts bytes.
    expect(passwordProblem('密'.repeat(30) + 'Aa1@')).toBe('too-long');
  });

  it('reports each requirement for the strength panel', () => {
    expect(passwordChecks('abc')).toEqual({ length: false, letterCase: false, digit: false, special: false });
    expect(passwordChecks('Abcdefg1')).toEqual({ length: true, letterCase: true, digit: true, special: false });
    expect(passwordChecks('Abcdefg1@')).toEqual({ length: true, letterCase: true, digit: true, special: true });
  });
});

