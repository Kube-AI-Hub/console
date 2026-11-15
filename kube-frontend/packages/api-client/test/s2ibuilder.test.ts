import { describe, expect, it } from 'vitest';
import {
  imageBuilderTriggerLink,
  normalizeBuilderStatus,
  normalizeRunStatus,
  runImageSize,
  toImageBuilderDetail,
  toImageBuilderSummary,
  toS2iBuilderTemplate,
  toS2iRunSummary,
  type RawS2iBuilder,
  type RawS2iBuilderTemplate,
  type RawS2iRun,
} from '../src/s2ibuilder';

/**
 * Image builder mappers.
 *
 * The status strings and the fields they come from are the whole point of this page: a
 * wrong mapping turns "the controller has not reported yet" into "success", or reads the
 * revision from a field the CRD does not have. Both are pinned here.
 */

function rawBuilder(overrides: {
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  config?: Record<string, unknown>;
  status?: Record<string, unknown>;
} = {}): RawS2iBuilder {
  return {
    apiVersion: 'devops.kubesphere.io/v1alpha1',
    kind: 'S2iBuilder',
    metadata: {
      name: 'demo',
      namespace: 'default',
      creationTimestamp: '2026-11-15T00:00:00Z',
      labels: overrides.labels ?? { 's2i-type.kubesphere.io': 's2i' },
      annotations: overrides.annotations ?? { displayName: 'Demo' },
    },
    spec: {
      config: {
        builderImage: 'builder:1.0',
        builderPullPolicy: 'if-not-present',
        sourceUrl: 'https://github.com/example/app.git',
        revisionId: 'master',
        imageName: 'example/app',
        tag: 'latest',
        ...(overrides.config ?? {}),
      },
    },
    ...(overrides.status === undefined ? {} : { status: overrides.status }),
  };
}

describe('status normalisation', () => {
  it('maps the controller enums and keeps unknown/empty values honest', () => {
    expect(normalizeBuilderStatus('Running')).toBe('building');
    expect(normalizeBuilderStatus('Successful')).toBe('successful');
    expect(normalizeBuilderStatus('Failed')).toBe('failed');
    expect(normalizeBuilderStatus('')).toBe('');
    expect(normalizeBuilderStatus(undefined)).toBe('');
    expect(normalizeBuilderStatus('SomethingNew')).toBe('');
    expect(normalizeRunStatus('Success')).toBe('successful');
  });
});

describe('toImageBuilderSummary', () => {
  it('reads the builder image, output image, kind and annotations', () => {
    const summary = toImageBuilderSummary(
      rawBuilder({
        annotations: { displayName: 'Demo', serviceName: 'orders' },
        config: { isBinaryURL: true },
        status: { lastRunState: 'Failed', lastRunStartTime: '2026-11-15T01:00:00Z', lastRunName: 'run-1' },
        labels: { 's2i-type.kubesphere.io': 'b2i' },
      }),
    );
    expect(summary.name).toBe('demo');
    expect(summary.displayName).toBe('Demo');
    expect(summary.serviceName).toBe('orders');
    expect(summary.kind).toBe('b2i');
    expect(summary.isBinary).toBe(true);
    expect(summary.baseImage).toBe('builder:1.0');
    expect(summary.outputImage).toBe('example/app');
    expect(summary.pullPolicy).toBe('if-not-present');
    expect(summary.status).toBe('failed');
    expect(summary.lastRunStartTime).toBe('2026-11-15T01:00:00Z');
    expect(summary.lastRunName).toBe('run-1');
    expect(summary.createdAt).toBe('2026-11-15T00:00:00Z');
  });

  it('does not invent a status when the controller has not reported', () => {
    const summary = toImageBuilderSummary(rawBuilder({ status: {} }));
    expect(summary.status).toBe('');
    expect(summary.lastRunStartTime).toBe('');
  });
});

describe('toImageBuilderDetail', () => {
  it('carries the editable config and the annotation maps', () => {
    const detail = toImageBuilderDetail(
      rawBuilder({ annotations: { languageType: 'java', 'kubesphere.io/repoUrl': 'registry.example.com' } }),
    );
    expect(detail.config.builderImage).toBe('builder:1.0');
    expect(detail.annotations['languageType']).toBe('java');
    expect(detail.labels['s2i-type.kubesphere.io']).toBe('s2i');
    expect(detail.raw.metadata?.name).toBe('demo');
  });
});

describe('toS2iRunSummary', () => {
  const run: RawS2iRun = {
    metadata: { name: 'demo-run', namespace: 'default', creationTimestamp: '2026-11-15T00:00:00Z' },
    spec: { builderName: 'demo' },
    status: {
      runState: 'Running',
      startTime: '2026-11-15T00:01:00Z',
      kubernetesJobName: 'demo-job',
      logURL: 'http://apiserver/logs?x=1',
      s2iBuildSource: {
        sourceUrl: 'https://github.com/example/app.git',
        builderImage: 'builder:1.0',
        revisionId: 'release-1',
        binaryName: 'app.jar',
        binarySize: '47B',
      },
      s2iBuildResult: {
        imageName: 'example/app:latest',
        imageSize: 12345678,
        commandPull: 'docker pull example/app:latest',
        imageCreated: '2026-11-15T00:02:00Z',
      },
    },
  };

  it('maps the run state and reads the revision from the build source, not from the result', () => {
    const summary = toS2iRunSummary(run);
    expect(summary.status).toBe('building');
    expect(summary.statusRaw).toBe('Running');
    expect(summary.builderName).toBe('demo');
    expect(summary.revisionId).toBe('release-1');
    expect(summary.sourceUrl).toBe('https://github.com/example/app.git');
    expect(summary.builderImage).toBe('builder:1.0');
    expect(summary.binaryName).toBe('app.jar');
    expect(summary.imageName).toBe('example/app:latest');
    expect(summary.imageSize).toBe(12345678);
    expect(summary.imagePullCommand).toBe('docker pull example/app:latest');
    expect(summary.jobName).toBe('demo-job');
    expect(summary.logURL).toBe('http://apiserver/logs?x=1');
  });
});

describe('runImageSize', () => {
  it('keeps a formatted string verbatim and parses numeric strings', () => {
    expect(runImageSize(1024)).toBe(1024);
    expect(runImageSize('2048')).toBe(2048);
    expect(runImageSize('47B')).toBe('47B');
    expect(runImageSize('')).toBe('');
    expect(runImageSize(undefined)).toBe('');
  });
});

describe('imageBuilderTriggerLink', () => {
  it('builds the operator trigger URL with and without the token', () => {
    const base =
      'http://s2ioperator-trigger-service.kubesphere-devops-system.svc/s2itrigger/v1alpha1/general/namespaces/default/s2ibuilders/demo/';
    expect(imageBuilderTriggerLink('default', 'demo', '')).toBe(base);
    expect(imageBuilderTriggerLink('default', 'demo', 'abc123')).toBe(base + '?secretCode=abc123');
  });
});

describe('toS2iBuilderTemplate', () => {
  const template: RawS2iBuilderTemplate = {
    metadata: {
      name: 'java',
      labels: {
        'builder-type.kubesphere.io/s2i': 's2i',
        'builder-type.kubesphere.io/b2i': 'b2i',
        'binary-type.kubesphere.io': 'jar',
      },
      annotations: { 'devops.kubesphere.io/s2i-template-url': 'https://example.com/java' },
    },
    spec: {
      codeFramework: 'java',
      defaultBaseImage: 'builder:1.0',
      containerInfo: [{ builderImage: 'builder:1.0' }],
      environment: [{ key: 'MAVEN_ARGS', defaultValue: '' }],
    },
  };

  it('exposes both build modes and the template metadata the create form needs', () => {
    const mapped = toS2iBuilderTemplate(template);
    expect(mapped.name).toBe('java');
    expect(mapped.s2i).toBe(true);
    expect(mapped.b2i).toBe(true);
    expect(mapped.binaryType).toBe('jar');
    expect(mapped.codeFramework).toBe('java');
    expect(mapped.docUrl).toBe('https://example.com/java');
    expect(mapped.containerInfo?.[0]?.builderImage).toBe('builder:1.0');
    expect(mapped.environment?.[0]?.key).toBe('MAVEN_ARGS');
  });
});
