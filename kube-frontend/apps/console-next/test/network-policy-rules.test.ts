import { describe, expect, it } from 'vitest';
import { peersText, policyRuleSections, portsText, selectorText, toRuleRows } from '@/pages/settings/networkPolicyRules';

/**
 * 网络策略规则投影（2026-11-19）。
 *
 * One mapper serves two surfaces (the project's rule view and a policy's own detail), so the
 * cases pin the shapes both rely on: a peer that carries two selectors, an ipBlock with
 * `except`, a port range, and a policy with only one direction.
 */

const policy = {
  metadata: { name: 'web-allow' },
  spec: {
    podSelector: { matchLabels: { app: 'web' } },
    ingress: [
      {
        from: [
          { namespaceSelector: { matchLabels: { env: 'prod' } }, podSelector: { matchLabels: { role: 'frontend' } } },
          { ipBlock: { cidr: '10.0.0.0/8', except: ['10.1.0.0/16'] } },
        ],
        ports: [{ protocol: 'TCP', port: 80 }, { protocol: 'UDP', port: 53 }],
      },
    ],
    egress: [{ to: [{ podSelector: { matchLabels: { app: 'db' } } }], ports: [{ protocol: 'TCP', port: 5432, endPort: 5433 }] }],
  },
};

describe('网络策略规则投影', () => {
  it('prints a peer with both selectors, an ipBlock with except, and a port range', () => {
    expect(selectorText({ matchLabels: { app: 'web' } })).toBe('app=web');
    expect(peersText([{ namespaceSelector: { matchLabels: { env: 'prod' } }, podSelector: { matchLabels: { role: 'frontend' } } }])).toBe(
      'namespaceSelector: env=prod + podSelector: role=frontend',
    );
    expect(peersText([{ ipBlock: { cidr: '10.0.0.0/8', except: ['10.1.0.0/16'] } }])).toBe('ipBlock: 10.0.0.0/8 except 10.1.0.0/16');
    expect(portsText([{ protocol: 'TCP', port: 5432, endPort: 5433 }])).toBe('TCP/5432-5433');
    // A port entry without a number allows every port of that protocol — not port 0.
    expect(portsText([{ protocol: 'TCP' }])).toBe('TCP');
    // No peers / no ports means "everything", which Kubernetes spells as an empty object.
    expect(peersText([])).toBe('*');
    expect(portsText(undefined)).toBe('*');
  });

  it('splits one policy into its ingress and egress rules, keeping the order', () => {
    const sections = policyRuleSections(policy);
    expect(sections.target).toBe('app=web');
    expect(sections.ingress).toHaveLength(1);
    expect(sections.ingress[0]).toMatchObject({
      direction: 'Ingress',
      peers: 'namespaceSelector: env=prod + podSelector: role=frontend / ipBlock: 10.0.0.0/8 except 10.1.0.0/16',
      ports: 'TCP/80, UDP/53',
    });
    expect(sections.egress).toHaveLength(1);
    expect(sections.egress[0]).toMatchObject({ direction: 'Egress', peers: 'podSelector: app=db', ports: 'TCP/5432-5433' });
  });

  it('reports a policy with no rules of one direction as empty, not as a wildcard row', () => {
    const sections = policyRuleSections({ metadata: { name: 'only-egress' }, spec: { podSelector: {}, egress: [{ to: [] }] } });
    expect(sections.ingress).toEqual([]);
    expect(sections.egress).toHaveLength(1);
    // An empty `to` list is "allow to anywhere" — that is a rule, printed as `*`.
    expect(sections.egress[0]?.peers).toBe('*');
    expect(policyRuleSections(undefined)).toEqual({ target: '*', ingress: [], egress: [] });
  });

  it('keeps every policy in the project-wide view, sorted by name', () => {
    const rows = toRuleRows([{ metadata: { name: 'b' }, spec: { ingress: [{}] } }, policy]);
    expect(rows.map((row) => row.policy)).toEqual(['b', 'web-allow', 'web-allow']);
  });
});
