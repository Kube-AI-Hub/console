import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Keyboard and focus contracts.
 *
 * The migration replaced a Knative-era UI with ai-kit primitives, and the whole point of using
 * the primitives is that focus trapping, Escape handling, tab order and accessible names come
 * with them. Three kinds of hand-rolled shortcut quietly undo that, and none of them is a type
 * error:
 *
 * 1. `onClick` on a `div`/`span`: mouse-only. A keyboard user cannot reach it, and screen
 *    readers do not announce it as interactive.
 * 2. A hand-rolled overlay (`role="dialog"` plus manual Escape handling): no focus trap, no
 *    focus restore, and every future fix has to be made twice. ai-kit's `Modal`/`Dialog` owns
 *    this.
 * 3. A button with no accessible name: an icon-only control announced as just "button".
 */
const root = new URL('..', import.meta.url).pathname;
const srcDir = join(root, 'apps/console-next/src');

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

const files = tsxFiles(srcDir).map((file) => ({
  relative: file.slice(srcDir.length + 1),
  source: readFileSync(file, 'utf8'),
}));

/** Visible text makes a button nameable; so does an explicit aria-label or title. */
function hasAccessibleName(buttonSource: string): boolean {
  if (/aria-label|aria-labelledby|title=/.test(buttonSource)) return true;
  const children = buttonSource.slice(buttonSource.indexOf('>') + 1).replace(/<\/?(?:Icon|SvgIcon)\b[^>]*>/g, '');
  return /[\u4e00-\u9fffA-Za-z]/.test(children.replace(/<[^>]+>/g, ''));
}

/**
 * Return the opening tag starting at `start` (`<div …>`), tolerating `>` inside JSX expression
 * attributes: `onClick={() => …}` contains a `>` that a naive `[^>]*` stops at -- which is how the
 * first version of this contract missed a planted `<div onClick=…>`.
 */
function openingTag(source: string, start: number): string {
  let braces = 0;
  let quote: string | null = null;
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') braces += 1;
    else if (char === '}') braces -= 1;
    else if (char === '>' && braces <= 0) return source.slice(start, index + 1);
  }
  return source.slice(start, start + 400);
}

/** Every opening tag of a non-interactive element that carries an `onClick`. */
function clickableNonInteractive(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/<(div|span|li|td|tr)\b/g)) {
    const tag = openingTag(source, match.index ?? 0);
    if (/\bonClick\b/.test(tag)) found.push(tag.slice(0, 100));
  }
  return found;
}
describe('keyboard and focus', () => {
  it('never puts a click handler on a non-interactive element', () => {
    const offenders: string[] = [];
    for (const { relative, source } of files) {
      for (const tag of clickableNonInteractive(source)) offenders.push(`${relative}: ${tag}`);
    }
    expect(
      offenders,
      `以下位置把点击挂在非交互元素上——键盘用户无法触达：\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('lets ai-kit own dialogs instead of hand-rolling an overlay', () => {
    const offenders = files
      .filter(({ source }) => source.includes('role="dialog"') && !source.includes('Modal'))
      .map(({ relative }) => relative);
    const escapes = files
      .filter(({ source }) => /key\s*===\s*'Escape'/.test(source))
      .map(({ relative }) => relative);
    expect(offenders, `以下文件自己写了弹层（没有焦点陷阱）；改用 ai-kit 的 Modal：${offenders.join(', ')}`).toEqual([]);
    expect(escapes, `以下文件手工处理 Escape——弹层应交给 ai-kit：${escapes.join(', ')}`).toEqual([]);
  });

  it('gives every button an accessible name', () => {
    const offenders: string[] = [];
    for (const { relative, source } of files) {
      // Split on button openings so each element body is considered on its own.
      const parts = source.split(/<(?=Button\b|AiButton\b|IconButton\b)/g).slice(1);
      for (const part of parts) {
        const body = part.slice(0, 400);
        if (!hasAccessibleName(body)) offenders.push(`${relative}: ${body.split('\n')[0].slice(0, 60)}`);
      }
    }
    expect(offenders, `以下按钮没有可访问名称（图标按钮必须加 aria-label）：\n${offenders.join('\n')}`).toEqual([]);
  });
});
