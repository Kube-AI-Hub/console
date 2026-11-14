import { describe, expect, it } from 'vitest';
import { passwordChecks, passwordProblem, platformRoleOf, toClusterRoleSummary, toUserSummary, toWorkspaceSummary } from '../src/access';

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

  it('reads the last sign-in from its annotation', () => {
    const user = toUserSummary({
      metadata: {
        name: 'carol',
        annotations: { 'iam.kubesphere.io/last-login-time': '2026-11-01T08:00:00Z' },
      },
    });
    expect(user.lastLogin).toBe('2026-11-01T08:00:00Z');
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

