import { describe, expect, it, beforeEach } from 'vitest';
import { lastClusterKey, readLastCluster, rememberLastCluster } from '@/lib/lastCluster';

/**
 * The remembered cluster.
 *
 * The old console keys this on the username, and it matters: this is a shared browser
 * more often than not, and one administrator's last cluster is not another's.
 */
describe('last cluster', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('keys the preference on the user', () => {
    rememberLastCluster('admin', 'host');
    rememberLastCluster('someone-else', 'member');
    expect(readLastCluster('admin')).toBe('host');
    expect(readLastCluster('someone-else')).toBe('member');
    expect(lastClusterKey('admin')).not.toBe(lastClusterKey('someone-else'));
  });

  it('returns an empty string when nothing was remembered', () => {
    expect(readLastCluster('admin')).toBe('');
  });

  it('falls back to a shared key when no user is known yet', () => {
    rememberLastCluster('', 'host');
    expect(readLastCluster('')).toBe('host');
    expect(lastClusterKey('')).toBe(lastClusterKey('anonymous'));
  });

  it('does not throw when storage is unavailable', () => {
    const original = window.localStorage.setItem;
    // Private mode and storage-blocked browsers throw on write; the preference simply does
    // not survive, and a page that crashes over it would be worse than the lost preference.
    window.localStorage.setItem = () => {
      throw new Error('blocked');
    };
    try {
      expect(() => rememberLastCluster('admin', 'host')).not.toThrow();
    } finally {
      window.localStorage.setItem = original;
    }
  });
});
