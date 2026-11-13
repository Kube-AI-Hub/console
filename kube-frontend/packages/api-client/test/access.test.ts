import { describe, expect, it } from 'vitest';
import { platformRoleOf, toClusterRoleSummary, toUserSummary, toWorkspaceSummary } from '../src/access';

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

  it('reads the last sign-in and email from annotations', () => {
    const user = toUserSummary({
      metadata: {
        name: 'carol',
        annotations: { 'iam.kubesphere.io/last-login-time': '2026-11-01T08:00:00Z', email: 'c@example.com' },
      },
    });
    expect(user.lastLogin).toBe('2026-11-01T08:00:00Z');
    expect(user.email).toBe('c@example.com');
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
