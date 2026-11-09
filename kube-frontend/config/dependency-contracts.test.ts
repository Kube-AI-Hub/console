import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Dependency ownership.
 *
 * The workspace pins shared versions in `catalog:`. A package that writes a
 * literal version instead is how the same library ends up installed twice at
 * different versions — the failure mode is a React hook error at runtime, not a
 * build error, so it has to be caught here.
 */

const root = new URL('..', import.meta.url).pathname;

interface Manifest {
  name?: string;
  private?: boolean;
  license?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function manifest(path: string): Manifest {
  return JSON.parse(readFileSync(`${root}${path}/package.json`, 'utf8')) as Manifest;
}

const WORKSPACE_PACKAGES = [
  'apps/console-next',
  'packages/ui',
  'packages/ai-surface',
  'packages/api-client',
  'packages/locales',
  'server',
] as const;

/** Packages the catalog owns; a literal version here means drift. */
const CATALOG_OWNED = [
  'react',
  'react-dom',
  '@types/react',
  '@types/react-dom',
  '@tanstack/react-router',
  '@tanstack/react-query',
  'tailwindcss',
  'typescript',
  'vite',
  'vitest',
] as const;

describe('catalog ownership', () => {
  for (const pkg of WORKSPACE_PACKAGES) {
    it(`${pkg} declares shared deps via catalog`, () => {
      const { dependencies = {}, devDependencies = {} } = manifest(pkg);
      const combined = { ...dependencies, ...devDependencies };
      const drifted = CATALOG_OWNED.filter((name) => name in combined && combined[name] !== 'catalog:');
      expect(drifted).toEqual([]);
    });
  }

  it('every package is private: nothing here is published from the workspace', () => {
    // ai-kit is the one thing that ships; these packages are consumed through
    // `workspace:*` and source exports, so publishing them would create a copy
    // that immediately drifts.
    for (const pkg of WORKSPACE_PACKAGES) {
      expect(manifest(pkg).private, pkg).toBe(true);
    }
  });
});

describe('licence boundary', () => {
  /**
   * The whole reason this project exists is that console is AGPL-3.0. A single
   * import from `console/src` would put this code under AGPL again, so the rule
   * is checked rather than remembered.
   */
  it('no package depends on the AGPL console sources', () => {
    for (const pkg of WORKSPACE_PACKAGES) {
      const { dependencies = {}, devDependencies = {} } = manifest(pkg);
      const combined = { ...dependencies, ...devDependencies };
      const offenders = Object.keys(combined).filter(
        (name) => name === '@ks-console' || name.startsWith('@ks-console/') || name.includes('console/src'),
      );
      expect(offenders, pkg).toEqual([]);
    }
  });

  it('declares Apache-2.0 for the workspace and every package', () => {
    expect(manifest('.').license).toBe('Apache-2.0');
    for (const pkg of WORKSPACE_PACKAGES) {
      expect(manifest(pkg).license, pkg).toBe('Apache-2.0');
    }
  });
});
