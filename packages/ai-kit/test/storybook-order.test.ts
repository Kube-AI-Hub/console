import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Storybook sidebar order guard.
 *
 * Storybook's default sort is *configure order* — the order story files are
 * discovered. That looked alphabetical only for as long as files happened to be
 * created in alphabetical order, so the first components added later
 * (`DescriptionList`, `PasswordStrength`) appeared after `Tree` instead of in
 * their alphabetical place.
 *
 * The fix lives in `.storybook/preview.tsx`: `order` pins the **sections**, and
 * `method: 'alphabetical'` orders the entries inside them. Adding a story titled
 * `Components/<Name>` is therefore enough to put a new component in the right
 * place — there is no allow-list to remember. These checks keep that property
 * from regressing:
 *
 * 1. The sort config must stay alphabetical and must not grow a per-component
 *    allow-list (a nested array): a list cannot know about components that do
 *    not exist yet, which is exactly how the ordering broke.
 * 2. Every story must live under a known section, so a title written without its
 *    prefix does not create a stray top-level group.
 * 3. Titles must be unique, so two files never merge into one sidebar entry.
 * 4. The configured sections must match the sections actually in use: adding a
 *    section is a deliberate act that updates the preview config and this test.
 *
 * `stories/**\/*.stories.tsx` is discovered by a glob in `.storybook/main.ts`;
 * a new file needs no registration. README §开发 (`Storybook 侧的约定`) repeats
 * the short version for whoever adds the next component.
 */

const root = resolve(__dirname, '..');
const previewSource = readFileSync(resolve(root, '.storybook/preview.tsx'), 'utf8');

/** The sections the sidebar groups stories under; new sections update this list. */
const SECTIONS = ['Foundation', 'Components', 'Charts', 'Schema', 'Primitives'] as const;

/**
 * Extract the balanced block that starts at the first `{` or `[` after a marker.
 *
 * Reading source instead of importing the preview config keeps this check out of
 * Storybook's runtime (the preview module pulls in CSS, React decorators and
 * Storybook blocks; none of that belongs in a unit test).
 */
function blockAfter(source: string, marker: string): string {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) throw new Error(`"${marker}" not found in .storybook/preview.tsx`);

  const openerIndex = source.slice(markerIndex).search(/[[{]/);
  if (openerIndex === -1) throw new Error(`no block after "${marker}"`);

  const start = markerIndex + openerIndex;
  const open = source[start]!;
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === open) depth += 1;
    else if (char === close) {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unbalanced "${open}" after "${marker}"`);
}

const storySort = blockAfter(previewSource, 'storySort:');
const orderBlock = blockAfter(storySort, 'order:');
const orderSections = [...orderBlock.matchAll(/'([^']+)'/g)].map((match) => match[1]!);

const storiesDir = resolve(root, 'stories');
const storyFiles = readdirSync(storiesDir)
  .filter((file) => file.endsWith('.stories.tsx'))
  .sort();

/** The section-prefixed `meta.title` of one story file. */
function metaTitle(file: string): string {
  const source = readFileSync(resolve(storiesDir, file), 'utf8');
  // Only the meta title carries a section prefix; the `title` fields inside a
  // schema or a table column are plain labels such as `名称`.
  const titles = [...source.matchAll(/title:\s*['"]([^'"]+)['"]/g)]
    .map((match) => match[1]!)
    .filter((title) => title.includes('/'));
  expect(titles, `${file}: 必须且只能声明一个带分类前缀的 meta.title（如 Components/Button）`).toHaveLength(1);
  return titles[0]!;
}

const metas = storyFiles.map((file) => ({ file, title: metaTitle(file) }));

describe('storybook sidebar order', () => {
  it('sorts alphabetically inside each section', () => {
    // Without `method: 'alphabetical'`, Storybook keeps configure order and a new
    // component is appended to the bottom of the sidebar.
    expect(storySort).toMatch(/method:\s*'alphabetical'/);
  });

  it('pins sections, not individual components', () => {
    // The old configuration held an explicit array of component names. A nested
    // array here means the allow-list is back: it cannot include a component that
    // is added later, so that component silently falls to the end of the list.
    expect(orderBlock.slice(1, -1)).not.toContain('[');
    expect([...orderSections].sort()).toEqual([...SECTIONS].sort());
  });

  it('keeps every story under a known section', () => {
    const offenders = metas.filter(({ title }) => !(SECTIONS as readonly string[]).includes(title.split('/')[0]!));
    expect(offenders).toEqual([]);
  });

  it('gives every story a unique title', () => {
    const filesByTitle = new Map<string, string[]>();
    for (const { file, title } of metas) {
      filesByTitle.set(title, [...(filesByTitle.get(title) ?? []), file]);
    }
    expect([...filesByTitle].filter(([, files]) => files.length > 1)).toEqual([]);
  });

  it('names Components entries after the component, not by position', () => {
    // The alphabetical sort is what places entries; a numeric prefix would pin an
    // entry in place and hide the fact that it sits outside the alphabetical order.
    const components = metas
      .filter(({ title }) => title.startsWith('Components/'))
      .map(({ title }) => title.slice('Components/'.length));
    expect(components.filter((name) => /^[0-9]/.test(name))).toEqual([]);
  });

  it('still discovers story files by glob', () => {
    // If the glob is replaced by an explicit file list, a new story is not shown at
    // all — no sort configuration can make up for that.
    const mainSource = readFileSync(resolve(root, '.storybook/main.ts'), 'utf8');
    expect(mainSource).toContain("stories: ['../stories/**/*.stories.@(ts|tsx)']");
  });
});
