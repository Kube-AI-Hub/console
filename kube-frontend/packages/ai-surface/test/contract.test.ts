import { describe, expect, it } from 'vitest';
import {
  AI_ID_ATTR,
  AI_NEEDS_ATTR,
  AI_STATE_ATTR,
  actionProps,
  cancelled,
  failed,
  getManifest,
  isSuccess,
  ok,
  planFor,
  registerPage,
  rowProps,
  surfaceProps,
} from '../src';

/**
 * Agent contract.
 *
 * These attributes are what an automation relies on, so their shape is pinned:
 * renaming one is a breaking change for every agent, not a refactor.
 */

describe('attribute helpers', () => {
  it('surface publishes state and id', () => {
    expect(surfaceProps('loading', 'x:surface')).toEqual({ [AI_STATE_ATTR]: 'loading', [AI_ID_ATTR]: 'x:surface' });
  });

  it('action carries its prerequisites', () => {
    expect(actionProps('x:delete', { needs: ['x:select'] })).toEqual({
      [AI_ID_ATTR]: 'x:delete',
      [AI_NEEDS_ATTR]: 'x:select',
    });
  });

  it('action omits empty needs instead of rendering an empty attribute', () => {
    expect(actionProps('x:click')).not.toHaveProperty(AI_NEEDS_ATTR);
  });

  it('row is keyed by the resource name', () => {
    expect(rowProps('app-config')).toEqual({ 'data-ai-row': 'app-config' });
  });
});

describe('action results', () => {
  it('ok wraps data', () => {
    const result = ok(42);
    expect(isSuccess(result)).toBe(true);
    expect(isSuccess(failed('nope'))).toBe(false);
  });

  it('failed keeps the code when given', () => {
    expect(failed('boom', 'forbidden')).toEqual({ status: 'error', message: 'boom', code: 'forbidden' });
  });

  it('cancelled is distinct from failure', () => {
    // The UI must not show an error banner when a user dismisses a confirm.
    expect(cancelled().status).toBe('cancelled');
  });
});

describe('manifest', () => {
  const page = {
    path: '/test',
    title: 'Test',
    description: 'a page',
    surfaceId: 'test:surface',
    states: { ready: 'loaded' },
    actions: [
      { id: 'test:select', description: 'select a row' },
      { id: 'test:delete', description: 'delete the selection', mutating: true, requires: ['test:select'] },
    ],
  };

  it('registers pages by path', () => {
    registerPage(page);
    expect(getManifest().some((entry) => entry.path === '/test')).toBe(true);
  });

  it('withholds an action until its prerequisite is satisfied', () => {
    registerPage(page);
    expect(planFor('/test', 'delete')).toEqual([]);
    expect(planFor('/test', 'delete', ['test:select']).map((action) => action.id)).toEqual(['test:delete']);
  });

  it('returns nothing for an unknown path', () => {
    expect(planFor('/nope', 'delete')).toEqual([]);
  });
});
