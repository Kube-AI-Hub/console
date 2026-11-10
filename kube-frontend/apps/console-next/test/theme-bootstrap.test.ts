import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { themeBootstrapScript } from '@kube-ai-hub/ui';

/**
 * The theme must be restored before React runs.
 *
 * `index.html` carries an inline copy of ai-kit's `themeBootstrapScript`, because
 * a module export cannot be interpolated into a static template without a build
 * plugin. Two copies drift: someone renames the `ai-kit-theme` key in the
 * provider, the template keeps reading the old one, and the symptom is a flash of
 * the wrong theme for exactly the people who chose one — the least likely to be
 * caught in review.
 */

// `import.meta.url` is not a file URL under the jsdom environment, so resolve
// from the package root that vitest runs in.
const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');

/** The storage keys and attribute names the restored script must agree on. */
function semantics(script: string): string[] {
  const keys = ['ai-kit-theme', 'ai-kit-accent', 'light', 'dark', 'violet', 'green', 'data-theme', 'data-accent'];
  return keys.filter((key) => script.includes(key));
}

describe('theme bootstrap', () => {
  it('index.html inlines a script at all', () => {
    expect(html).toMatch(/<script>[\s\S]*localStorage[\s\S]*<\/script>/);
  });

  it('reads the same keys the provider writes', () => {
    const inline = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';
    expect(semantics(inline)).toEqual(semantics(themeBootstrapScript));
  });

  it('keeps the html element on the provider defaults', () => {
    // A mismatch here is a one-frame flash for a reader with no stored choice:
    // the template paints `data-theme`/`data-accent` before the provider applies
    // its own defaults.
    expect(html).toContain('<html lang="zh-CN" data-theme="dark" data-accent="violet">');
  });
});
