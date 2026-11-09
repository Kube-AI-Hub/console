import { describe, expect, it } from 'vitest';
import { createTranslator, dictionaries, zh, type LocaleKey } from '../src';

/**
 * Copy coverage.
 *
 * A missing translation is a visible bug, so the two dictionaries are checked
 * against each other rather than trusted to stay in sync by review.
 */

describe('dictionaries', () => {
  it('every language has exactly the same keys', () => {
    const reference = Object.keys(zh).sort();
    for (const [locale, dictionary] of Object.entries(dictionaries)) {
      expect(Object.keys(dictionary).sort(), locale).toEqual(reference);
    }
  });

  it('no string is empty', () => {
    for (const [locale, dictionary] of Object.entries(dictionaries)) {
      for (const [key, value] of Object.entries(dictionary)) {
        expect(value.trim(), `${locale}:${key}`).not.toBe('');
      }
    }
  });
});

describe('createTranslator', () => {
  const t = createTranslator('zh');

  it('returns the string for a known key', () => {
    expect(t('common.delete')).toBe('删除');
  });

  it('interpolates parameters', () => {
    expect(t('common.selected', { count: 3 })).toBe('已选择 3 项');
  });

  it('leaves an unknown placeholder visible rather than printing undefined', () => {
    // A literal `{name}` in the UI is a bug someone will report; `undefined` is a
    // bug that gets misdiagnosed as a data problem.
    expect(t('common.selected')).toBe('已选择 {count} 项');
  });

  it('falls back to the key itself for an unknown key', () => {
    const missing = 'this.key.does.not.exist' as LocaleKey;
    expect(t(missing)).toBe('this.key.does.not.exist');
  });

  it('switches language', () => {
    expect(createTranslator('en')('common.delete')).toBe('Delete');
  });
});
