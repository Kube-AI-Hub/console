import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * WCAG contrast contracts for the theme tokens.
 *
 * The app cannot be eyeballed in this environment (the cluster link is unreliable), so the part
 * of the light-theme promise that *is* checkable offline is the palette itself: every semantic
 * text token on every semantic background, in each of the six theme combinations, must reach
 * WCAG 2.1 AA for body text (4.5:1).
 *
 * This does not replace a rendered-page audit (`tests/ui/helpers/contrast.py` walks real text
 * nodes); it catches the cheaper and more common failure first -- a token pair that was never
 * readable, which no amount of correct usage can fix.
 */
const root = new URL('..', import.meta.url).pathname;
const tokensCss = join(root, '..', 'packages/ai-kit/src/styles/tokens.css');

type Triple = [number, number, number];

const css = readFileSync(tokensCss, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const blocks = [...css.matchAll(/(:root(?:\[[^\]]+\])*)\s*\{([\s\S]*?)\n\}/g)].map((match) => ({
  selector: match[1],
  props: new Map([...match[2].matchAll(/--ai-([\w-]+):\s*([^;]+);/g)].map((entry) => ['--ai-' + entry[1], entry[2].trim()])),
}));

const rawColours = new Map<string, Triple>();
for (const match of css.matchAll(/--ai-raw-([\w-]+):\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/g)) {
  rawColours.set(match[1], [Number(match[2]), Number(match[3]), Number(match[4])]);
}

/** Theme combinations the appearance settings can produce, as cascade chains. */
const THEMES: { name: string; chain: string[] }[] = [
  { name: 'default (dark)', chain: [':root'] },
  { name: 'light', chain: [':root', ":root[data-theme='light']"] },
  { name: 'violet/dark', chain: [':root', ":root[data-accent='violet'][data-theme='dark']"] },
  { name: 'violet/light', chain: [':root', ":root[data-theme='light']", ":root[data-accent='violet'][data-theme='light']"] },
  { name: 'green/dark', chain: [':root', ":root[data-accent='green'][data-theme='dark']"] },
  { name: 'green/light', chain: [':root', ":root[data-theme='light']", ":root[data-accent='green'][data-theme='light']"] },
];

// `--ai-link` is the accent as text; it belongs here because the rendered audit found the accent
// itself failing as a text colour (2.84:1) and the fix only holds if this contract keeps it honest.
/**
 * Text-on-surface pairs that do not clear AA today, with the measured ratio.
 *
 * `--ai-surface-3` is the hovered row background. Secondary and link text on it sit just under the
 * threshold, and fixing that needs a dedicated hover-text step in the palette rather than a tweak
 * to the existing tokens (which would move every other surface). Registered here so the gap is
 * visible in the contract instead of being quietly left out of the matrix; the two-way guard at the
 * bottom fails if a listed pair starts passing, so the entry cannot outlive the defect.
 */
const KNOWN_TOKEN_GAPS: Record<string, number> = {
  // Both entries that lived here (fg-secondary 3.97 and link 4.01 on the hover surface) were fixed by
  // moving `--ai-surface-3` one step darker (navy-450). The two-way guard below stays so a future
  // palette change cannot quietly reintroduce them.
  //
  // The two gaps the fixed cascade first surfaced (violet/light muted text 4.47 and link 4.41 on the
  // hover surface) were fixed by darkening that surface one step; they are cleared, and the two-way
  // guard below keeps them from coming back.
};

const TEXT_TOKENS = ['--ai-fg', '--ai-fg-secondary', '--ai-fg-muted', '--ai-link'];
const BACKGROUND_TOKENS = ['--ai-bg', '--ai-surface-1', '--ai-surface-2', '--ai-surface-3'];

function propsOf(selector: string): Map<string, string> {
  return blocks.find((block) => block.selector === selector)?.props ?? new Map();
}

function resolve(name: string, chain: string[], depth = 0): Triple | null {
  if (depth > 8) return null;
  // Later blocks override earlier ones in the cascade, so the last layer that defines the token
  // wins. Searching forwards returns `:root` for almost every token, which silently made every
  // theme check the dark palette.
  const layer = [...chain].reverse().find((selector) => propsOf(selector).has(name));
  if (layer === undefined) return null;
  const value = propsOf(layer).get(name) as string;
  const rawMatch = /var\(--ai-raw-([\w-]+)\)/.exec(value);
  if (rawMatch) return rawColours.get(rawMatch[1]) ?? null;
  const semantic = /var\((--ai-[\w-]+)\)/.exec(value);
  if (semantic) return resolve(semantic[1], chain, depth + 1);
  return null;
}

function luminance([red, green, blue]: Triple): number {
  const weights = [0.2126, 0.7152, 0.0722];
  const linear = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return linear.reduce((sum, value, index) => sum + value * weights[index], 0);
}

function contrast(foreground: Triple, background: Triple): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

describe('theme contrast', () => {
  it('parses the token sheet (guards against a silently broken parser)', () => {
    expect(blocks.map((block) => block.selector)).toContain(':root');
    expect(blocks.length).toBeGreaterThanOrEqual(6);
    expect(rawColours.size).toBeGreaterThan(50);
    // One known pair, resolved by hand from the sheet: default dark text on the page background.
    const darkFg = resolve('--ai-fg', [':root']);
    expect(darkFg).not.toBeNull();
    expect(darkFg?.every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255)).toBe(true);
  });

  it('keeps every text token at WCAG AA on every background in every theme', () => {
    const failures: string[] = [];
    let worst = { ratio: Number.POSITIVE_INFINITY, where: '' };
    for (const theme of THEMES) {
      for (const background of BACKGROUND_TOKENS) {
        const backgroundColour = resolve(background, theme.chain);
        expect(backgroundColour, `${theme.name}: ${background} 解析不出来`).not.toBeNull();
        for (const text of TEXT_TOKENS) {
          const textColour = resolve(text, theme.chain);
          expect(textColour, `${theme.name}: ${text} 解析不出来`).not.toBeNull();
          const ratio = contrast(textColour as Triple, backgroundColour as Triple);
          if (ratio < worst.ratio) worst = { ratio, where: `${theme.name}: ${text} on ${background}` };
          if (ratio < 4.5) {
            const gap = KNOWN_TOKEN_GAPS[`${theme.name}: ${text} on ${background}`];
            if (gap === undefined) {
              failures.push(`${theme.name}: ${text} on ${background} = ${ratio.toFixed(2)}:1（AA 要求 4.5）`);
            } else {
              expect(Math.abs(ratio - gap), `${text} on ${background} 的比值变了（登记 ${gap}，实测 ${ratio.toFixed(2)}）：若已修复请从 KNOWN_TOKEN_GAPS 删除`).toBeLessThan(0.2);
            }
          } else {
            const key = `${theme.name}: ${text} on ${background}`;
            expect(KNOWN_TOKEN_GAPS[key], `${key} 现在通过了（${ratio.toFixed(2)}:1），请从 KNOWN_TOKEN_GAPS 删除`).toBeUndefined();
          }
        }
      }
    }
    expect(failures, `${failures.join('\n')}\n最差对比度：${worst.ratio.toFixed(2)}:1 @ ${worst.where}`).toEqual([]);
    // Record where the floor is. While a gap is registered the floor may sit inside it; with no
    // gaps the whole matrix has to clear AA outright -- which is the state this palette is in now.
    const registered = Object.values(KNOWN_TOKEN_GAPS);
    if (registered.length > 0) {
      expect(worst.ratio).toBeGreaterThanOrEqual(Math.min(...registered) - 0.2);
    } else {
      expect(worst.ratio, `最差对比度 ${worst.ratio.toFixed(2)}:1 @ ${worst.where}`).toBeGreaterThan(4.5);
    }
  });
  /*
   * The focus ring is a non-text indicator: WCAG 2.1 SC 1.4.11 asks for 3:1 against what it sits
   * on, not 4.5:1. It is checked here because the ring is the one thing a keyboard user relies on,
   * and because a light-theme ring that fades into the surface is invisible in a screenshot review.
   *
   * `Button` draws it as `ring-ai-ring` with `ring-offset-ai-bg`, so the pair is ring vs page
   * background.
   */
  it('keeps the focus ring visible on every theme (SC 1.4.11, 3:1)', () => {
    // The dark ring was violet-100 on a dark page (2.38:1) and is fixed by taking the lighter step;
    // mint-300 on a light page (2.29:1). Both need a brighter/darker step; registered so the gap is
    // tracked, and the guard below fails if one starts passing (then delete its entry).
    const KNOWN_RING_GAPS: Record<string, number> = {};
    const failures: string[] = [];
    for (const theme of THEMES) {
      const ring = resolve('--ai-ring', theme.chain);
      const background = resolve('--ai-bg', theme.chain);
      expect(ring, `${theme.name} 没有可解析的 --ai-ring`).not.toBeNull();
      expect(background, `${theme.name} 没有可解析的 --ai-bg`).not.toBeNull();
      const ratio = contrast(ring as Triple, background as Triple);
      const gap = KNOWN_RING_GAPS[theme.name];
      if (gap === undefined && ratio < 3) {
        failures.push(`${theme.name}: --ai-ring on --ai-bg = ${ratio.toFixed(2)}:1（1.4.11 要求 3）`);
      } else if (gap !== undefined) {
        expect(Math.abs(ratio - gap), `${theme.name} 的焦点环比值变了（登记 ${gap}，实测 ${ratio.toFixed(2)}）：若已修复请从 KNOWN_RING_GAPS 删除`).toBeLessThan(0.2);
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });
});
