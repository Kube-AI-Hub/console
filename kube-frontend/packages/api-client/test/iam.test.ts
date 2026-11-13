import { describe, expect, it } from 'vitest';
import { isTemplateRole, toMemberSummary, toRoleSummary, toRoleRule } from '../src/iam';

/**
 * Project access mapping.
 *
 * Both KubeSphere fields that matter here live in annotations rather than in the
 * object body, so "which annotation" is the whole specification. These cases pin it
 * down so a future refactor cannot quietly read the wrong place.
 */

describe('template roles', () => {
  it('recognises the platform\'s building blocks', () => {
    expect(isTemplateRole('role-template-view-volumes')).toBe(true);
    // A plain role that merely mentions the word is not a template.
    expect(isTemplateRole('viewer')).toBe(false);
    expect(isTemplateRole('my-role-template')).toBe(false);
  });

  it('marks a template role in the summary and counts its rules', () => {
    const summary = toRoleSummary({
      metadata: { name: 'role-template-manage-secrets' },
      rules: [{ apiGroups: [''], resources: ['secrets'], verbs: ['get'] }],
    });
    expect(summary.system).toBe(true);
    expect(summary.ruleCount).toBe(1);
  });
});

describe('role rules', () => {
  it('joins the array fields for display', () => {
    expect(toRoleRule({ apiGroups: ['apps', 'batch'], resources: ['deployments'], verbs: ['get', 'list'] })).toEqual({
      apiGroups: 'apps, batch',
      resources: 'deployments',
      verbs: 'get, list',
    });
  });

  it('keeps a wildcard as written instead of expanding it', () => {
    expect(toRoleRule({ apiGroups: ['*'], resources: ['*'], verbs: ['*'] }).verbs).toBe('*');
  });

  it('does not throw on a missing field', () => {
    expect(toRoleRule({})).toEqual({ apiGroups: '', resources: '', verbs: '' });
  });
});

describe('members', () => {
  const member = {
    metadata: {
      name: 'alice',
      annotations: {
        'iam.kubesphere.io/role': 'operator',
        'iam.kubesphere.io/last-password-change-time': '2026-03-31T08:43:25Z',
      },
    },
    status: { state: 'Active' },
  };

  it('reads the role from the annotation, not from a field', () => {
    expect(toMemberSummary(member).role).toBe('operator');
  });

  it('reports the last password change as the closest activity marker', () => {
    expect(toMemberSummary(member).lastActive).toBe('2026-03-31T08:43:25Z');
  });

  it('treats a projection without status as active', () => {
    // A member is a user reference: if the platform has not reported a state, the
    // account is not known to be disabled, and showing "inactive" would be a lie.
    expect(toMemberSummary({ metadata: { name: 'bob' } }).active).toBe(true);
  });

  it('reports a disabled account as inactive', () => {
    expect(toMemberSummary({ metadata: { name: 'bob' }, status: { state: 'Disabled' } }).active).toBe(false);
  });
});
