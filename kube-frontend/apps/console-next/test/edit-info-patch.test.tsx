import { describe, expect, it } from 'vitest';
import { annotationMergePatch } from '@/components/resource/EditInfoDialog';

/**
 * Turning an edited annotation map into a JSON merge patch.
 *
 * Under RFC 7386 an absent key means "leave it alone" and `null` means "delete".
 * Omitting a cleared annotation therefore did nothing: the dialog closed, the alias
 * stayed on the object, and the edit looked saved. Verified against the live cluster
 * before the fix — clearing an alias left `kubesphere.io/alias-name` in place.
 */
describe('annotationMergePatch', () => {
  it('sends null for a cleared annotation', () => {
    const before = { 'kubesphere.io/alias-name': '旧别名', 'kubesphere.io/creator': 'admin' };
    const after = { 'kubesphere.io/creator': 'admin' };
    expect(annotationMergePatch(before, after)).toEqual({ 'kubesphere.io/alias-name': null });
  });

  it('omits annotations the dialog did not change', () => {
    const before = { 'kubesphere.io/alias-name': 'a', 'kubesphere.io/creator': 'admin' };
    const after = { 'kubesphere.io/alias-name': 'b', 'kubesphere.io/creator': 'admin' };
    // Only the changed key is sent, so a concurrent change to the creator is not undone.
    expect(annotationMergePatch(before, after)).toEqual({ 'kubesphere.io/alias-name': 'b' });
  });

  it('sends a new annotation as its value', () => {
    expect(annotationMergePatch({}, { 'kubesphere.io/alias-name': '新' })).toEqual({ 'kubesphere.io/alias-name': '新' });
  });

  it('sends nothing when the dialog made no change', () => {
    expect(annotationMergePatch({ a: '1' }, { a: '1' })).toEqual({});
  });
});
