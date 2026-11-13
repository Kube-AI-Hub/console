import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { statusLabel } from '@/lib/status';
import { zh } from '@kube-ai-hub/locales';

/**
 * One table for the status values shown to users.
 *
 * The same concept appears on more than one page — a claim is `Bound` on the storage
 * list, on the storage detail and on a persistent volume — and two copies of the mapping
 * drift, so one page says 已绑定 and the other `Bound` for the same thing.
 */
const t = (key: string) => (zh as Record<string, string>)[key] ?? key;

describe('statusLabel', () => {
  it('translates the phases a claim, a volume and a pod share', () => {
    expect(statusLabel(t as never, 'Bound')).toBe('已绑定');
    expect(statusLabel(t as never, 'Pending')).toBe('等待中');
    expect(statusLabel(t as never, 'Running')).toBe('运行中');
    expect(statusLabel(t as never, 'Succeeded')).toBe('已完成');
    expect(statusLabel(t as never, 'Failed')).toBe('失败');
  });

  it('translates the phases only a volume has', () => {
    expect(statusLabel(t as never, 'Available')).toBe('可用');
    expect(statusLabel(t as never, 'Released')).toBe('已释放');
  });

  it('leaves a value it does not know alone', () => {
    // An untranslated status is visibly an API value; a guessed label would be a lie.
    expect(statusLabel(t as never, 'SomeFuturePhase')).toBe('SomeFuturePhase');
    expect(statusLabel(t as never, '')).toBe('');
  });
});
