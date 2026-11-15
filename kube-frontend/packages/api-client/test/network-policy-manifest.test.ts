import { describe, expect, it } from 'vitest';
import { networkPolicyManifest, type PolicyCreateInput } from '../src/iam';

/** The manifest a whitelist wizard must produce, asserted without a cluster. */
function build(patch: Partial<PolicyCreateInput> = {}) {
  return networkPolicyManifest({
    namespace: 'demo',
    name: 'allow-frontend',
    podSelector: 'app=backend',
    ingress: [],
    egress: [],
    ...patch,
  }) as Record<string, unknown>;
}

describe('networkPolicyManifest', () => {
  it('wraps a pod peer instead of sending a bare selector', () => {
    const manifest = build({ ingress: [{ peer: { kind: 'pod', value: 'tier=frontend' } }] });
    const spec = manifest['spec'] as Record<string, unknown>;
    expect(spec['ingress']).toEqual([{ from: [{ podSelector: { matchLabels: { tier: 'frontend' } } }] }]);
    expect(spec['policyTypes']).toEqual(['Ingress']);
  });

  it('selects a namespace by the name label Kubernetes sets itself', () => {
    const manifest = build({ ingress: [{ peer: { kind: 'namespace', value: 'team-a' } }] });
    const spec = manifest['spec'] as Record<string, unknown>;
    expect((spec['ingress'] as unknown[])[0]).toEqual({
      from: [{ namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': 'team-a' } } }],
    });
  });

  it('writes an address range as ipBlock', () => {
    const manifest = build({ ingress: [{ peer: { kind: 'ipBlock', value: '10.0.0.0/8' } }] });
    const spec = manifest['spec'] as Record<string, unknown>;
    expect((spec['ingress'] as unknown[])[0]).toEqual({ from: [{ ipBlock: { cidr: '10.0.0.0/8' } }] });
  });

  it('attaches a single port, and a range as port plus endPort', () => {
    const single = build({ ingress: [{ peer: { kind: 'pod', value: 'app=db' }, port: { protocol: 'TCP', port: '5432' } }] });
    expect(((single['spec'] as Record<string, unknown>)['ingress'] as unknown[])[0]).toEqual({
      from: [{ podSelector: { matchLabels: { app: 'db' } } }],
      ports: [{ protocol: 'TCP', port: 5432 }],
    });
    const range = build({ ingress: [{ peer: { kind: 'pod', value: 'app=db' }, port: { protocol: 'UDP', port: '80-90' } }] });
    expect(((range['spec'] as Record<string, unknown>)['ingress'] as unknown[])[0]).toEqual({
      from: [{ podSelector: { matchLabels: { app: 'db' } } }],
      ports: [{ protocol: 'UDP', port: 80, endPort: 90 }],
    });
  });

  it('omits ports when none is given, so the rule covers every port', () => {
    const manifest = build({ ingress: [{ peer: { kind: 'pod', value: 'app=db' }, port: { protocol: 'TCP', port: ' ' } }] });
    const rule = ((manifest['spec'] as Record<string, unknown>)['ingress'] as unknown[])[0] as Record<string, unknown>;
    expect('ports' in rule).toBe(false);
  });

  it('names only the directions that actually have rules', () => {
    const manifest = build({ egress: [{ peer: { kind: 'namespace', value: 'team-b' } }] });
    const spec = manifest['spec'] as Record<string, unknown>;
    expect(spec['policyTypes']).toEqual(['Egress']);
    expect(spec['ingress']).toBeUndefined();
    expect(((spec['egress'] as unknown[])[0] as Record<string, unknown>)['to']).toEqual([
      { namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': 'team-b' } } },
    ]);
  });

  it('keeps both directions when both have rules', () => {
    const manifest = build({
      ingress: [{ peer: { kind: 'pod', value: 'app=a' } }],
      egress: [{ peer: { kind: 'pod', value: 'app=b' } }],
    });
    expect((manifest['spec'] as Record<string, unknown>)['policyTypes']).toEqual(['Ingress', 'Egress']);
  });

  it('an empty pod selector selects every pod, not none', () => {
    const manifest = build({ podSelector: '' });
    expect((manifest['spec'] as Record<string, unknown>)['podSelector']).toEqual({});
  });

  it('writes the description as the KubeSphere annotation only when given', () => {
    const withDescription = build({ description: '  allow frontend  ' });
    expect((withDescription['metadata'] as Record<string, unknown>)['annotations']).toEqual({
      'kubesphere.io/description': 'allow frontend',
    });
    const without = build({ description: '   ' });
    expect((without['metadata'] as Record<string, unknown>)['annotations']).toBeUndefined();
  });
});
