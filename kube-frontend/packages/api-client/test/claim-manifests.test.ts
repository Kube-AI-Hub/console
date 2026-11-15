import { describe, expect, it } from 'vitest';
import {
  claimCloneManifest,
  claimManifest,
  snapshotManifest,
  toStorageClassSummary,
  toStorageSummary,
} from '../src/storage';

/**
 * The claim builders are where "create a volume" actually happens: the dialog only collects
 * values, and these functions decide which fields reach the API. They are pure so the shapes can
 * be asserted without a cluster.
 */
describe('claimManifest', () => {
  it('writes class, modes and size for a new claim', () => {
    const body = claimManifest({
      name: 'data',
      namespace: 'team-a',
      storageClass: 'juicefs-shared',
      accessModes: ['ReadWriteMany'],
      storage: '20Gi',
    });
    expect(body).toMatchObject({
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: { name: 'data', namespace: 'team-a' },
      spec: {
        accessModes: ['ReadWriteMany'],
        resources: { requests: { storage: '20Gi' } },
        storageClassName: 'juicefs-shared',
      },
    });
    // No dataSource: a claim provisioned from nothing must not look like a restore.
    expect(body.spec).not.toHaveProperty('dataSource');
  });

  it('omits the class when the default one should decide', () => {
    const body = claimManifest({ name: 'x', namespace: 'ns', storageClass: '', accessModes: ['ReadWriteOnce'], storage: '1Gi' });
    expect(body.spec).not.toHaveProperty('storageClassName');
  });

  it('restores from a snapshot and drops the class', () => {
    const body = claimManifest({
      name: 'restored',
      namespace: 'ns',
      storageClass: 'ignored-when-restoring',
      accessModes: ['ReadWriteOnce'],
      storage: '5Gi',
      fromSnapshot: { name: 'snap-1' },
    });
    expect(body.spec).toMatchObject({
      dataSource: { kind: 'VolumeSnapshot', name: 'snap-1', apiGroup: 'snapshot.storage.k8s.io' },
    });
    // A restored claim inherits its class from the snapshot; sending one conflicts with it.
    expect(body.spec).not.toHaveProperty('storageClassName');
  });

  it('carries alias and description as annotations only when given', () => {
    const plain = claimManifest({ name: 'a', namespace: 'ns', storageClass: '', accessModes: ['ReadWriteOnce'], storage: '1Gi' });
    expect(plain.metadata).not.toHaveProperty('annotations');

    const described = claimManifest({
      name: 'b',
      namespace: 'ns',
      storageClass: '',
      accessModes: ['ReadWriteOnce'],
      storage: '1Gi',
      alias: '  数据集  ',
      description: '模型缓存',
    });
    expect(described.metadata?.annotations).toEqual({
      'kubesphere.io/alias-name': '数据集',
      'kubesphere.io/description': '模型缓存',
    });
  });
});

describe('claimCloneManifest', () => {
  it('points dataSource at the source claim and inherits its shape', () => {
    const body = claimCloneManifest(
      { name: 'source', namespace: 'team-b', storageClass: 'openebs-hostpath', accessModes: ['RWO'], capacity: '8Gi' },
      'source-clone',
    );
    expect(body).toMatchObject({
      metadata: { name: 'source-clone', namespace: 'team-b' },
      spec: {
        accessModes: ['RWO'],
        resources: { requests: { storage: '8Gi' } },
        dataSource: { kind: 'PersistentVolumeClaim', name: 'source' },
        storageClassName: 'openebs-hostpath',
      },
    });
  });

  it('leaves the class out when the source had none', () => {
    const body = claimCloneManifest(
      { name: 's', namespace: 'ns', storageClass: '', accessModes: ['RWO'], capacity: '1Gi' },
      's2',
    );
    expect(body.spec).not.toHaveProperty('storageClassName');
  });
});

describe('snapshotManifest', () => {
  it('names the class and the source claim', () => {
    const body = snapshotManifest({ name: 'snap', namespace: 'ns', claim: 'data', snapshotClass: 'csi-snap' });
    expect(body).toMatchObject({
      apiVersion: 'snapshot.storage.k8s.io/v1',
      kind: 'VolumeSnapshot',
      spec: {
        volumeSnapshotClassName: 'csi-snap',
        source: { kind: 'PersistentVolumeClaim', persistentVolumeClaimName: 'data' },
      },
    });
  });

  it('omits an empty class so the driver default applies', () => {
    const body = snapshotManifest({ name: 'snap', namespace: 'ns', claim: 'data', snapshotClass: '' });
    expect(body.spec).not.toHaveProperty('volumeSnapshotClassName');
  });
});

describe('storage class capabilities', () => {
  it('reads the allow-clone annotation the live cluster actually sets', () => {
    // The first version of this mapper only knew allow-cloning/allowVolumeCloning and therefore
    // hid the clone control on a class that allows cloning.
    const row = toStorageClassSummary({
      metadata: { name: 'juicefs-shared', annotations: { 'storageclass.kubesphere.io/allow-clone': 'true' } },
    });
    expect(row.allowCloning).toBe(true);
  });

  it('keeps both older spellings working', () => {
    expect(
      toStorageClassSummary({ metadata: { name: 'a', annotations: { 'storageclass.kubesphere.io/allow-cloning': 'true' } } }).allowCloning,
    ).toBe(true);
    expect(toStorageClassSummary({ metadata: { name: 'b' }, allowVolumeCloning: true } as never).allowCloning).toBe(true);
  });

  it('parses declared access modes and falls back to "class does not say"', () => {
    const declared = toStorageClassSummary({
      metadata: {
        name: 'c',
        annotations: { 'storageclass.kubesphere.io/supported-access-modes': '["ReadWriteMany"]' },
      },
    });
    expect(declared.supportedAccessModes).toEqual(['ReadWriteMany']);
    // A malformed annotation must not read as "no mode is supported": that would block creation.
    expect(
      toStorageClassSummary({ metadata: { name: 'd', annotations: { 'storageclass.kubesphere.io/supported-access-modes': 'nonsense' } } })
        .supportedAccessModes,
    ).toEqual([]);
  });

  it('reads size bounds from the class parameters with the old defaults', () => {
    const configured = toStorageClassSummary({
      metadata: { name: 'e' },
      parameters: { minSize: '10', maxSize: '100', stepSize: '5' },
    } as never);
    expect(configured.sizeConfig).toEqual({ min: 10, max: 100, step: 5 });
    expect(toStorageClassSummary({ metadata: { name: 'f' } }).sizeConfig).toEqual({ min: 0, max: 2048, step: 1 });
  });

  it('recognises the KubeSphere default marker', () => {
    const row = toStorageClassSummary({
      metadata: { name: 'g', annotations: { 'storageclass.kubesphere.io/is-default-class': 'true' } },
    });
    expect(row.isDefault).toBe(true);
  });
});

describe('storage summary', () => {
  it('exposes the bound volume so the list can link it', () => {
    const row = toStorageSummary('persistentvolumeclaims', {
      metadata: { name: 'p' },
      spec: { storageClassName: 'sc', volumeName: 'pvc-1234', accessModes: ['ReadWriteOnce'], resources: { requests: { storage: '1Gi' } } },
      status: { phase: 'Bound' },
    } as never);
    expect(row.volumeName).toBe('pvc-1234');
  });
});
