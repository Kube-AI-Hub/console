import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Mutation-failure contracts.
 *
 * "Never fabricate success" is a product rule, and the way it gets broken is quiet: a dialog calls
 * `mutateAsync`, the request fails, the promise rejects, and nothing renders. The reader sees a
 * form that did not close and no reason why -- or worse, the dialog closes on an optimistic path
 * and the change never happened.
 *
 * Two checks, both over source:
 *
 * 1. Every page/component that mutates must route the rejection somewhere the reader can see it.
 *    `ResourceForm` and `ManifestCreateDialog` already catch and render; anything else has to say
 *    so itself (`catch`, `onError` with a message, or a `MutationAlert`).
 * 2. A mutation must not close its dialog on the optimistic path -- `onSuccess` is the only place
 *    that may call `onOpenChange(false)`.
 */
const root = new URL('..', import.meta.url).pathname;
const srcDir = join(root, 'apps/console-next/src');

/**
 * Shared components that own the error surface, so their callers do not need one.
 *
 * Verified by reading them: `ResourceForm` wraps `await onSubmit(...)` in try/catch and renders
 * `submitError`; `ManifestCreateDialog` renders its own `role="alert"` paragraph.
 */
const OWNS_ERROR_SURFACE = ['ResourceForm', 'ManifestCreateDialog'];

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) {
        if (entry === 'node_modules' || entry === 'dist') continue;
        walk(full);
      } else if (entry.endsWith('.tsx')) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
}

const mutating = tsxFiles(srcDir)
  .map((file) => ({ relative: file.slice(srcDir.length + 1), source: readFileSync(file, 'utf8') }))
  .filter(({ source }) => source.includes('useMutation('));

/** Does this file give a failed mutation somewhere to appear? */
function surfacesFailure(source: string): boolean {
  if (OWNS_ERROR_SURFACE.some((name) => source.includes(name))) return true;
  if (source.includes('MutationAlert')) return true;
  // A component that renders the message itself: `<p role="alert">{mutation.error…}`.
  if (/\.error\b/.test(source) && /(Alert|<p|role="alert")/.test(source)) return true;
  // Handing the failure to a dialog that knows how to show it:
  //   {...(remove.error ? { error: errorMessage(t, remove.error) } : {})}
  // This is the common shape here, and it is a real surface -- the dialog renders it.
  if (/\.error\s*\?/.test(source) || /\{\s*error:/.test(source)) return true;
  if (/catch\s*\(/.test(source) && /set[A-Z]\w*Error|setError/.test(source)) return true;
  if (/onError:\s*\(/.test(source)) return true;
  return false;
}

describe('mutation failures', () => {
  it('finds the mutating files', () => {
    expect(mutating.length).toBeGreaterThan(40);
  });

  it('gives every failed mutation somewhere to be seen', () => {
    const offenders = mutating
      .filter(({ source }) => !surfacesFailure(source))
      .map(({ relative }) => relative);
    expect(
      offenders,
      `以下文件发起写请求但失败时什么都不显示（读者只会看到表单没关）：\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('closes a dialog only after the write succeeded', () => {
    const offenders: string[] = [];
    for (const { relative, source } of mutating) {
      // `onSuccess: () => { ... onOpenChange(false) ... }` is correct; a bare onOpenChange(false)
      // inside the submit path is optimistic closing.
      const submitPaths = source.split(/onSubmit=|mutationFn:/).slice(1);
      for (const path of submitPaths) {
        const head = path.slice(0, 500);
        if (/onOpenChange\(false\)/.test(head) && !/mutateAsync|onSuccess/.test(head)) {
          offenders.push(`${relative}: 提交路径里直接关闭弹窗（写入结果未知）`);
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
