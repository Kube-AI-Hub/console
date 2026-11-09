import * as React from 'react';

/**
 * Renderer registries.
 *
 * The schema layer knows how to lay out a page, not how to render every
 * possible field. Domain-specific types (GPU count, RDMA device, JuiceFS volume)
 * are registered by the consuming application, so the library never needs a
 * release to support a console-specific concept.
 *
 * Registration is global and idempotent: re-registering a type replaces it,
 * which is what a hot reload or a test wants.
 */

export interface FieldRendererContext<TValue = unknown> {
  value: TValue;
  onChange: (next: TValue) => void;
  /** `id` for label association; the renderer must forward it. */
  id: string;
  invalid: boolean;
  disabled: boolean;
  placeholder?: string;
}

export type FieldRenderer<TValue = unknown> = (
  context: FieldRendererContext<TValue>,
) => React.ReactElement;

/**
 * Storage is type-erased: the map holds renderers for unrelated value types, and
 * only the caller that registered one knows its shape. `unknown` is the honest
 * bound here — casting through it keeps the lookup callable without pretending
 * the value type is known.
 */
const fieldRenderers = new Map<string, FieldRenderer<unknown>>();

export function registerFieldType<TValue>(type: string, renderer: FieldRenderer<TValue>): void {
  fieldRenderers.set(type, renderer as FieldRenderer<unknown>);
}

export function getFieldRenderer(type: string): FieldRenderer<unknown> | undefined {
  return fieldRenderers.get(type);
}

export interface ColumnRendererContext<TRow> {
  row: TRow;
  value: unknown;
  rowIndex: number;
}

export type ColumnRenderer<TRow> = (context: ColumnRendererContext<TRow>) => React.ReactNode;

const columnRenderers = new Map<string, ColumnRenderer<unknown>>();

export function registerColumnType<TRow>(type: string, renderer: ColumnRenderer<TRow>): void {
  columnRenderers.set(type, renderer as ColumnRenderer<unknown>);
}

export function getColumnRenderer(type: string): ColumnRenderer<unknown> | undefined {
  return columnRenderers.get(type);
}

/** Test seam: clear all custom types between cases. */
export function clearRendererRegistry(): void {
  fieldRenderers.clear();
  columnRenderers.clear();
}

/** Read a nested value by dot path, e.g. `metadata.labels.app`. */
export function getByPath(source: unknown, path: string): unknown {
  if (!path) return source;
  let current: unknown = source;
  for (const segment of path.split('.')) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/** Write a nested value by dot path, returning a new object. */
export function setByPath<T>(source: T, path: string, value: unknown): T {
  const segments = path.split('.');
  const clone: Record<string, unknown> = { ...(source as Record<string, unknown>) };
  let cursor = clone;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index] as string;
    const existing = cursor[segment];
    const next = existing && typeof existing === 'object' ? { ...(existing as object) } : {};
    cursor[segment] = next;
    cursor = next as Record<string, unknown>;
  }
  cursor[segments[segments.length - 1] as string] = value;
  return clone as T;
}
