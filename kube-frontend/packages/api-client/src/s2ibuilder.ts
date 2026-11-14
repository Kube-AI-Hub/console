import type { Client } from './client';

/**
 * 镜像构建器（S2I）.
 *
 * The devops API group serves two versions: v1alpha3 has pipelines/projects, while the
 * S2I resources (s2ibuilders, s2iruns, s2ibuildertemplates) live in **v1alpha1**. Asking
 * v1alpha3 for s2ibuilders answers 404 — that is the version split, not a missing feature.
 *
 * A builder is a namespaced CRD (devops.kubesphere.io/v1alpha1). The old console reads it
 * from the raw group, not from kapis, and so does this client: the raw list is the same
 * object the controller writes, with no aggregate to translate.
 */
const S2I = '/apis/devops.kubesphere.io/v1alpha1';

/** S2I builds from source; B2I builds from an uploaded binary. */
export type ImageBuilderKind = 's2i' | 'b2i';

/** One image builder row. */
export interface ImageBuilderSummary {
  name: string;
  /** `displayName` annotation when present; the page falls back to `name`. */
  displayName: string;
  /** `spec.config.builderImage` — the builder image the build runs in. */
  baseImage: string;
  kind: ImageBuilderKind;
  /** Raw `status.lastRunState` (`Running`, `Successful`, `Failed`, empty before the first run). */
  status: string;
  /** `serviceName` annotation; the workload the built image is deployed as. */
  serviceName: string;
  createdAt: string;
}

interface RawS2iBuilder {
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec?: {
    config?: {
      builderImage?: string;
      imageName?: string;
      tag?: string;
      sourceUrl?: string;
      isBinaryURL?: boolean;
    };
  };
  status?: {
    lastRunState?: string;
  };
}

export function toImageBuilderSummary(raw: RawS2iBuilder): ImageBuilderSummary {
  const labels = raw.metadata?.labels ?? {};
  const annotations = raw.metadata?.annotations ?? {};
  return {
    name: raw.metadata?.name ?? '',
    displayName: annotations['displayName'] ?? '',
    baseImage: raw.spec?.config?.builderImage ?? '',
    // The controller labels binary builds explicitly; absence has always meant source builds.
    kind: labels['s2i-type.kubesphere.io'] === 'b2i' ? 'b2i' : 's2i',
    status: raw.status?.lastRunState ?? '',
    serviceName: annotations['serviceName'] ?? '',
    createdAt: raw.metadata?.creationTimestamp ?? '',
  };
}

export function imageBuildersApi(client: Client) {
  return {
    /**
     * Every builder in one project.
     *
     * The CRD list has no server-side pagination here and the old console read it whole;
     * S2I builders are configuration objects (a handful per project), so sorting newest
     * first client-side is enough and keeps the row order deterministic.
     */
    async list(params: { namespace: string; signal?: AbortSignal }): Promise<{ items: ImageBuilderSummary[]; total: number }> {
      const body = await client.request<{ items?: RawS2iBuilder[] }>(
        `${S2I}/namespaces/${encodeURIComponent(params.namespace)}/s2ibuilders`,
        {
          ...(params.signal ? { signal: params.signal } : {}),
        },
      );
      const items = (body?.items ?? [])
        .map(toImageBuilderSummary)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return { items, total: items.length };
    },
  };
}

export type ImageBuildersApi = ReturnType<typeof imageBuildersApi>;
