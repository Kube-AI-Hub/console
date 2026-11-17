import { describe, expect, it } from 'vitest';
import { safeReturnPath } from '../apps/console-next/src/routes/return-path';

/**
 * The post-login redirect guard.
 *
 * `redirect` and `referer` arrive from the query string, so they are attacker-controlled. Only a
 * same-origin absolute path may be returned; everything else must be rejected so the caller falls
 * back to the console root. `//host` and `/\host` are protocol-relative in browsers, which is the
 * whole reason this exists.
 */
describe('safeReturnPath', () => {
  it('accepts same-origin absolute paths', () => {
    expect(safeReturnPath('/kube-frontend/clusters/host/overview')).toBe('/kube-frontend/clusters/host/overview');
    expect(safeReturnPath('  /kube-frontend/  ')).toBe('/kube-frontend/');
  });

  it('rejects protocol-relative and backslash forms', () => {
    expect(safeReturnPath('//evil.example')).toBeNull();
    expect(safeReturnPath('/\\evil.example')).toBeNull();
  });

  it('rejects absolute URLs and relative paths', () => {
    expect(safeReturnPath('https://evil.example')).toBeNull();
    expect(safeReturnPath('javascript:alert(1)')).toBeNull();
    expect(safeReturnPath('kube-frontend/')).toBeNull();
  });

  it('rejects empty values', () => {
    expect(safeReturnPath('')).toBeNull();
    expect(safeReturnPath('   ')).toBeNull();
    expect(safeReturnPath(null)).toBeNull();
    expect(safeReturnPath(undefined)).toBeNull();
  });
});
