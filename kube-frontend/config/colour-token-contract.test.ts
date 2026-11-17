import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Colour-token contracts for the light/dark themes.
 *
 * The design system exposes two layers: raw palette steps (`--ai-raw-navy-800`, fixed colours)
 * and semantic tokens (`--ai-bg`, `--ai-fg`, `--ai-surface-1`, …) that the light theme
 * redefines. App code must use the semantic layer, because a raw step does not change when the
 * theme does -- that is exactly how a page ends up unreadable in light mode.
 *
 * Three ways to break it, all invisible to `tsc`:
 *
 * 1. A literal colour (`#1f2937`, `rgb(31 41 55)`) baked into a page: ignores both themes.
 * 2. `rgb(…)` built from something other than a `var(--ai-…)` token (e.g. a computed number).
 * 3. A raw palette step used directly in app code -- allowed only where showing a palette's own
 *    colour is the point (the appearance swatches), and listed explicitly below.
 */
const root = new URL('..', import.meta.url).pathname;
const appSrc = join(root, 'apps/console-next/src');
// `console/kube-frontend` -> `console/packages/ai-kit`
const tokensCss = join(root, '..', 'packages/ai-kit/src/styles/tokens.css');

/** Files allowed to reference raw palette steps, with the reason it is correct there. */
const RAW_TOKEN_EXCEPTIONS: Record<string, string> = {
  'pages/platform/PlatformInfoPage.tsx':
    '外观设置里每个色板要显示「它自己」的颜色，用语义 token 只会显示当前生效的那个色板',
};

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) {
        if (entry === 'node_modules' || entry === 'dist') continue;
        walk(full);
      } else if (/\.(tsx?|css)$/.test(entry)) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
}

const files = sourceFiles(appSrc).map((file) => ({
  file,
  relative: file.slice(appSrc.length + 1),
  source: readFileSync(file, 'utf8'),
}));

describe('colour tokens', () => {
  it('ships semantic tokens and a light theme', () => {
    const css = readFileSync(tokensCss, 'utf8');
    for (const token of ['--ai-bg:', '--ai-fg:', '--ai-accent:', '--ai-surface-1:', '--ai-line:']) {
      expect(css.includes(token), `tokens.css 缺少语义 token ${token}`).toBe(true);
    }
    expect(css).toContain("[data-theme='light']");
    // The accent × theme matrix is what the appearance settings switch between.
    expect(css).toContain("[data-accent='green'][data-theme='light']");
  });

  it('has no literal colours in app code', () => {
    const literal = /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*[0-9]|hsla?\(\s*[0-9]/;
    const offenders = files
      .filter(({ source }) => literal.test(source))
      .map(({ relative }) => relative);
    expect(offenders, `以下文件把颜色写死了，切换主题不会变色：${offenders.join(', ')}`).toEqual([]);
  });

  it('builds every rgb()/rgba() from a design token', () => {
    const offenders: string[] = [];
    for (const { relative, source } of files) {
      for (const match of source.matchAll(/rgba?\(([^)]*)\)/g)) {
        if (!match[1]?.includes('var(--ai-')) offenders.push(`${relative}: rgba?(${match[1]})`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('uses raw palette steps only where showing a palette is the point', () => {
    const offenders: string[] = [];
    for (const { relative, source } of files) {
      if (!source.includes('--ai-raw-')) continue;
      if (RAW_TOKEN_EXCEPTIONS[relative]) continue;
      offenders.push(relative);
    }
    expect(
      offenders,
      `以下文件直接用了原始色阶（切主题不变色）；若确有需要，请连同原因加进 RAW_TOKEN_EXCEPTIONS：${offenders.join(', ')}`,
    ).toEqual([]);
  });

  it('keeps the exception list honest', () => {
    for (const [relative, reason] of Object.entries(RAW_TOKEN_EXCEPTIONS)) {
      const entry = files.find((candidate) => candidate.relative === relative);
      expect(entry, `RAW_TOKEN_EXCEPTIONS 里的 ${relative} 不存在`).toBeDefined();
      expect(entry?.source.includes('--ai-raw-'), `${relative} 已不再使用原始色阶，请从例外清单移除`).toBe(true);
      expect(reason.length).toBeGreaterThan(10);
    }
  });
});
