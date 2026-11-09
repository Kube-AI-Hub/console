import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Token format guard.
 *
 * Tailwind's alpha-aware colour utilities emit `rgb(var(--token) / <alpha>)`,
 * which is the modern CSS colour syntax. That syntax requires **space-separated**
 * channels: `249 251 253`. A comma-separated triple (`249, 251, 253`) or a hex
 * value makes the whole declaration invalid, and the browser then falls back to
 * black — the entire palette silently disappears while the page still lays out
 * correctly, so nothing looks broken enough to investigate.
 *
 * This test fails loudly instead of shipping a colourless UI.
 */

const tokensPath = resolve(__dirname, '../src/styles/tokens.css');
const tokens = readFileSync(tokensPath, 'utf8');

describe('token format', () => {
  it('declares every colour triple with space-separated channels', () => {
    const commaTriples = tokens.match(/--ai-[\w-]+:\s*\d{1,3},\s*\d{1,3},\s*\d{1,3};/g) ?? [];
    expect(commaTriples).toEqual([]);
  });

  it('never stores a hex value in a token that feeds a Tailwind colour', () => {
    // `rgb(var(--x) / 1)` cannot consume a hex string.
    const hexTokens = tokens.match(/--ai-(?:raw-)?[\w-]+:\s*#[0-9a-fA-F]{3,8};/g) ?? [];
    expect(hexTokens).toEqual([]);
  });

  it('keeps the raw ramps as channel triples so alpha composition works', () => {
    const raw = tokens.match(/--ai-raw-[\w-]+:\s*[\d\s]+;/g) ?? [];
    expect(raw.length).toBeGreaterThan(30);
  });

  it('scopes every accent palette to a theme, so the two axes stay independent', () => {
    // Regression: an unqualified `[data-accent='violet']` matched in both modes
    // and the light values leaked into dark.
    const accentRules = tokens.match(/:root\[data-accent='\w+'\](?!\[data-theme)/g) ?? [];
    expect(accentRules).toEqual([]);
  });

  it('gives each accent its own dark shell, not just its own accent colour', () => {
    // A violet interface on a navy page reads as an unfinished theme. Each
    // dark palette must redefine the surface ramp, not only --ai-accent.
    for (const accent of ['violet', 'green']) {
      const block = tokens.match(
        new RegExp(`:root\\[data-accent='${accent}'\\]\\[data-theme='dark'\\]\\s*\\{([\\s\\S]*?)\\n\\}`),
      )?.[1];
      expect(block, `${accent} dark block missing`).toBeTruthy();
      expect(block).toContain('--ai-bg:');
      expect(block).toContain('--ai-surface-1:');
      expect(block).toContain('--ai-accent:');
    }
  });

  it('gives each accent its own light shell, including borders', () => {
    // The light theme must tint surfaces and lines per accent as well, otherwise
    // green mode is a green button on a blue-grey page.
    for (const accent of ['violet', 'green']) {
      const block = tokens.match(
        new RegExp(`:root\\[data-accent='${accent}'\\]\\[data-theme='light'\\]\\s*\\{([\\s\\S]*?)\\n\\}`),
      )?.[1];
      expect(block, `${accent} light block missing`).toBeTruthy();
      expect(block).toContain('--ai-bg:');
      expect(block).toContain('--ai-surface-2:');
      expect(block).toContain('--ai-line:');
      expect(block).toContain('--ai-accent:');
    }
  });

  it('tints every shell token per accent, in both modes', () => {    // Regression: the dark palettes only overrode the surface ramp, so borders
    // stayed navy while the page turned violet — the two looked mismatched.
    const required = [
      '--ai-bg',
      '--ai-bg-elevated',
      '--ai-bg-overlay',
      '--ai-bg-deep',
      '--ai-surface-1',
      '--ai-surface-2',
      '--ai-surface-3',
      '--ai-line',
      '--ai-line-strong',
      '--ai-th-bg',
      '--ai-row-hover-bg',
      '--ai-nav-bg',
      '--ai-accent',
    ];
    for (const accent of ['violet', 'green']) {
      for (const theme of ['dark', 'light']) {
        const block = tokens.match(
          new RegExp(`:root\\[data-accent='${accent}'\\]\\[data-theme='${theme}'\\]\\s*\\{([\\s\\S]*?)\\n\\}`),
        )?.[1];
        expect(block, `${accent}/${theme} block missing`).toBeTruthy();
        const missing = required.filter((token) => !block?.includes(`${token}:`));
        expect(missing, `${accent}/${theme} missing ${missing.join(', ')}`).toEqual([]);
      }
    }
  });

  it('keeps the two light shells visually distinct', () => {    const violetBg = tokens.match(/--ai-raw-violet-lite-bg:\s*(\d+)\s+(\d+)\s+(\d+);/);
    const greenBg = tokens.match(/--ai-raw-green-lite-bg:\s*(\d+)\s+(\d+)\s+(\d+);/);
    expect(violetBg).toBeTruthy();
    expect(greenBg).toBeTruthy();
    expect(violetBg?.slice(1).join(' ')).not.toBe(greenBg?.slice(1).join(' '));
  });

  it('keeps the violet dark shell in the blue-violet hue band', () => {
    // Regression: the violet palette briefly reused the teal `abyss` ramp,
    // which rendered the purple theme visibly green. Hue is the check that
    // catches a "looks about as dark" substitution.
    const block = tokens.match(
      /:root\[data-accent='violet'\]\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/,
    )?.[1];
    expect(block).toBeTruthy();

    const resolved = block?.match(/--ai-bg:\s*var\(--ai-raw-([\w-]+)\)/)?.[1];
    expect(resolved, 'violet dark --ai-bg must come from a named raw token').toBeTruthy();
    expect(resolved).not.toContain('abyss');

    const rgb = tokens.match(new RegExp(`--ai-raw-${resolved}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+);`));
    expect(rgb).toBeTruthy();
    const [r, g, b] = rgb!.slice(1).map(Number) as [number, number, number];

    // Hue in degrees; console's navy ramp sits at ~229. Accept a band around it
    // so a future re-tint is allowed, but reject anything in the teal/green
    // region (150-200) where `abyss` lives.
    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    const l = (max + min) / 2;
    const d = max - min;
    let hue = 0;
    if (d !== 0) {
      if (max === r / 255) hue = ((g - b) / 255 / d) % 6;
      else if (max === g / 255) hue = (b - r) / 255 / d + 2;
      else hue = (r - g) / 255 / d + 4;
      hue *= 60;
      if (hue < 0) hue += 360;
    }
    expect(l).toBeLessThan(0.3); // still a dark shell
    expect(hue).toBeGreaterThan(210);
    expect(hue).toBeLessThan(250);
  });

  it('uses dataelem\'s own shell for the green dark palette', () => {
    const block = tokens.match(
      /:root\[data-accent='green'\]\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/,
    )?.[1];
    expect(block).toContain('--ai-raw-abyss-950');
  });
});
