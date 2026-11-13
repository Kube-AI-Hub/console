import { describe, expect, it } from 'vitest';
import { expectedConfirmation } from '@/components/resource/DeleteDialog';

/**
 * What the delete dialog asks the reader to type.
 *
 * One object is confirmed by its name — the friction that stops a mis-click. A batch
 * is confirmed by its count, because asking for `a, b, c` exactly is friction nobody
 * satisfies: the confirm button stayed disabled however carefully the names were
 * copied, which made bulk deletion impossible rather than merely awkward.
 */
describe('expectedConfirmation', () => {
  it('asks for the name when deleting one object', () => {
    expect(expectedConfirmation(['web-config'])).toBe('web-config');
  });

  it('asks for the count when deleting a batch', () => {
    expect(expectedConfirmation(['a', 'b'])).toBe('2');
    expect(expectedConfirmation(['a', 'b', 'c', 'd'])).toBe('4');
  });

  it('asks for an empty string when nothing is selected', () => {
    // The confirm button then stays disabled, which is the right outcome for a
    // delete that has no target.
    expect(expectedConfirmation([])).toBe('');
  });
});
