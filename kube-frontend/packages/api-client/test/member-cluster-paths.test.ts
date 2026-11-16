import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import { clusterScoped, corePath, coreWritePath } from '../src/paths';
import { configMapsApi } from '../src/configmaps';

/**
 * Where the member-cluster segment goes, and where a write may not go at all.
 *
 * Both rules were measured on a two-cluster deployment (A100: `host` + `xc`) and both were broken:
 *
 *  - the segment was appended after the group/version, which 404s on a member;
 *  - writes went through the core group, which has no member form, so a ConfigMap created from a
 *    member-cluster page silently landed on the host cluster.
 *
 * These assertions are cheap and they are the only thing that will notice a regression: the pages
 * themselves look fine while writing to the wrong cluster.
 */
describe('member-cluster paths', () => {
  it('puts the cluster segment before the group, not after the version', () => {
    expect(clusterScoped('/kapis/resources.kubesphere.io/v1alpha3', 'xc', 'nodes')).toBe(
      '/kapis/clusters/xc/resources.kubesphere.io/v1alpha3/nodes',
    );
    expect(clusterScoped('/apis/apps/v1', 'xc', 'namespaces/ns/deployments')).toBe(
      '/apis/clusters/xc/apps/v1/namespaces/ns/deployments',
    );
    // The host cluster keeps its original path: `clusters/host/...` is not the same request.
    expect(clusterScoped('/kapis/resources.kubesphere.io/v1alpha3', 'host', 'nodes')).toBe(
      '/kapis/resources.kubesphere.io/v1alpha3/nodes',
    );
    expect(clusterScoped('/kapis/resources.kubesphere.io/v1alpha3', undefined, 'nodes')).toBe(
      '/kapis/resources.kubesphere.io/v1alpha3/nodes',
    );
  });

  it('routes a core read of a member through the kapis proxy', () => {
    expect(corePath('xc', 'namespaces/ns/secrets')).toBe(
      '/kapis/clusters/xc/resources.kubesphere.io/v1alpha3/namespaces/ns/secrets',
    );
    expect(corePath('host', 'nodes')).toBe('/api/v1/nodes');
  });

  it('refuses a core write on a member instead of writing to the host cluster', () => {
    expect(coreWritePath('host', 'namespaces/ns/configmaps')).toBe('/api/v1/namespaces/ns/configmaps');
    expect(() => coreWritePath('xc', 'namespaces/ns/configmaps')).toThrow(/成员集群/);
  });

  it('keeps a grouped write on the member cluster, where it is supported', () => {
    // `/apis/<group>` has a member form, so an ingress/job create is allowed there.
    expect(clusterScoped('/apis/networking.k8s.io/v1', 'xc', 'namespaces/ns/ingresses')).toBe(
      '/apis/clusters/xc/networking.k8s.io/v1/namespaces/ns/ingresses',
    );
  });

  it('never sends a create to the host cluster when the page is showing a member', async () => {
    const calls: string[] = [];
    const client = createClient({ fetchImpl: (async (input) => {
      calls.push(String(input));
      return new Response('{}', { headers: { 'content-type': 'application/json' } });
    }) as typeof fetch });

    await expect(configMapsApi(client).create({ namespace: 'spaces', name: 'x', data: {} } as never, 'xc'))
      .rejects.toThrow(/成员集群/);
    expect(calls, '拒绝时不应发出任何请求').toEqual([]);
  });
});
