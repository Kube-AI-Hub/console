/**
 * Kubernetes field dictionary for editor completion.
 *
 * A static table rather than a fetched OpenAPI schema: the app has to work in
 * air-gapped clusters where no schema server is reachable, and the fields people
 * actually type in a YAML dialog are a small, stable subset. Extending coverage
 * is adding rows here — no build step, no download.
 *
 * `paths` are dotted from the document root. A trailing `.[]` marks a map whose
 * keys are user-chosen (labels, ConfigMap data), where completion offers a
 * placeholder instead of a fixed name.
 */

export interface FieldSpec {
  /** Dotted path from the root, e.g. `metadata.labels`. */
  path: string;
  /** Short hint shown beside the completion. */
  detail: string;
}

/** Fields every object carries. */
const COMMON: FieldSpec[] = [
  { path: 'apiVersion', detail: 'API 版本，如 v1' },
  { path: 'kind', detail: '资源类型' },
  { path: 'metadata', detail: '元数据' },
  { path: 'metadata.name', detail: '名称，DNS 子域名' },
  { path: 'metadata.namespace', detail: '所属项目' },
  { path: 'metadata.labels', detail: '标签，键值对' },
  { path: 'metadata.annotations', detail: '注解，键值对' },
  { path: 'metadata.creationTimestamp', detail: '创建时间（只读）' },
  { path: 'metadata.resourceVersion', detail: '资源版本（只读）' },
];

/** Per-kind fields. A kind missing here still gets COMMON. */
const BY_KIND: Record<string, FieldSpec[]> = {
  ConfigMap: [
    { path: 'data', detail: '键值数据，值必须是字符串' },
    { path: 'binaryData', detail: '二进制数据，值为 base64' },
    { path: 'immutable', detail: '设为 true 后不可修改' },
  ],
  Secret: [
    { path: 'data', detail: '数据，值为 base64' },
    { path: 'stringData', detail: '明文数据，写入时自动转 base64' },
    { path: 'type', detail: '类型，如 Opaque、kubernetes.io/tls' },
    { path: 'immutable', detail: '设为 true 后不可修改' },
  ],
  Deployment: [
    { path: 'spec', detail: '规格' },
    { path: 'spec.replicas', detail: '副本数' },
    { path: 'spec.selector', detail: '标签选择器' },
    { path: 'spec.selector.matchLabels', detail: '匹配的标签' },
    { path: 'spec.template', detail: 'Pod 模板' },
    { path: 'spec.template.metadata', detail: 'Pod 元数据' },
    { path: 'spec.template.spec', detail: 'Pod 规格' },
    { path: 'spec.template.spec.containers', detail: '容器列表' },
    { path: 'spec.template.spec.containers.[]', detail: '容器的 name、image、ports、env' },
    { path: 'spec.template.spec.volumes', detail: '卷列表' },
  ],
  Service: [
    { path: 'spec', detail: '规格' },
    { path: 'spec.type', detail: 'ClusterIP、NodePort、LoadBalancer' },
    { path: 'spec.selector', detail: '选择后端 Pod 的标签' },
    { path: 'spec.ports', detail: '端口列表' },
    { path: 'spec.ports.[]', detail: '端口的 port、targetPort、protocol' },
  ],
};

/** The kind declared in the document, when one is present. */
export function detectKind(text: string): string | undefined {
  const match = /^\s*kind:\s*([A-Za-z0-9]+)\s*$/m.exec(text);
  return match?.[1];
}

/** Fields to offer for a document. */
export function fieldsFor(text: string): FieldSpec[] {
  const kind = detectKind(text);
  return [...COMMON, ...(kind ? (BY_KIND[kind] ?? []) : Object.values(BY_KIND).flat())];
}

/**
 * The completion label for a dotted path.
 *
 * Only the last segment is inserted: YAML completion works on the node the cursor
 * is in, and typing `metadata.` followed by a full path would produce
 * `metadata.metadata.name`.
 */
export function lastSegment(path: string): string {
  const parts = path.split('.');
  return parts[parts.length - 1] ?? path;
}

/** Path depth, used to decide which fields belong at the cursor. */
export function depthOf(path: string): number {
  return path.split('.').length - 1;
}
