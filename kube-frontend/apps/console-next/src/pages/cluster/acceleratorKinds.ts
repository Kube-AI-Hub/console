/**
 * Accelerator resource metadata: what the platform says each card family is.
 *
 * The authoritative list is served at
 * `GET /kapis/config.kubesphere.io/v1alpha2/configs/gpu/kinds`, straight from the
 * cluster's `ClusterConfiguration` (`gpu.kinds`) — the same endpoint the old console's
 * server read to build `globals.config.supportGpuType` /
 * `supportGpuTypeMetadata`. Reading it at runtime means an operator who adds a vendor
 * to the installer gets correct names and units without a console rebuild.
 *
 * There is no bundled copy of that list. A second copy would have to be kept in step
 * with the installer by hand, and a stale one is worse than none: it would name a card
 * family the cluster no longer has. When the read fails the caller falls back to the
 * resource key itself, which is honest about what is unknown.
 *
 * Why the table is needed at all: a node's `capacity` names each family's
 * sub-resources in its own way. NVIDIA publishes only `nvidia.com/gpu` (a card count),
 * while Cambricon splits one card into several keys —
 * `cambricon.com/mlu.smlu.vmemory` for memory, `.smlu.vcore` for cores. Printed raw, a
 * node page shows four lookalike identifiers and no way to tell the card count from the
 * memory. The table is what turns each key into a name plus the right unit.
 *
 * `memoryUnit` is not always a size. It can be:
 * - `Mi` / `Gi` — a size, formatted as GiB;
 * - `%` — a percentage (Cambricon's smlu memory);
 * - `*256Mi` — a *count of 256Mi units* (Iluvatar, MThreads), which is why the unit
 *   string carries a multiplier rather than a plain suffix.
 */
export interface AcceleratorKind {
  /** The extended resource key, e.g. `nvidia.com/gpu`. */
  resourceName: string;
  /** What the platform prints for this resource, e.g. `GPU - Nvidia/英伟达`. */
  displayName: string;
  resourceType: string;
  /** Only one kind is the installation's default; the rest are opt-in. */
  isDefault: boolean;
  /** Unit of `memoryName`'s value. Absent when the kind has no memory sub-resource. */
  memoryUnit?: string;
  /** Resource key carrying this kind's memory. */
  memoryName?: string;
  /** Resource key carrying this kind's core/vcore allocation. */
  vcoresName?: string;
}


/** Lookup by resource key. */
export function acceleratorByResource(kinds: readonly AcceleratorKind[], key: string): AcceleratorKind | undefined {
  return kinds.find((kind) => kind.resourceName === key);
}

/**
 * The kind that owns a given sub-resource key (memory or vcores).
 *
 * The node's `capacity` lists sub-resources by their own names, so rendering a row
 * needs to walk back from `cambricon.com/mlu.smlu.vmemory` to the `vMLU` kind that
 * explains it. Returns `undefined` for a key no kind claims.
 */
export function acceleratorForSubResource(kinds: readonly AcceleratorKind[], key: string): { kind: AcceleratorKind; role: 'memory' | 'vcores' } | undefined {
  for (const kind of kinds) {
    if (kind.memoryName === key) return { kind, role: 'memory' };
    if (kind.vcoresName === key) return { kind, role: 'vcores' };
  }
  return undefined;
}

/**
 * Vendor prefixes, for keys no kind names explicitly.
 *
 * `cambricon.com/real-mlu-counts` is on the node but in no `gpu.kinds` entry; the old
 * console still shows it under the accelerator heading because it shares the vendor's
 * prefix. Deriving prefixes from the table rather than hardcoding a list keeps a new
 * vendor working without a code change.
 */
export function acceleratorPrefixes(kinds: readonly AcceleratorKind[]): string[] {
  return Array.from(new Set(
    kinds.map((kind) => kind.resourceName.split('/')[0]).filter((prefix): prefix is string => Boolean(prefix)),
  )).map((prefix) => `${prefix}/`);
}
