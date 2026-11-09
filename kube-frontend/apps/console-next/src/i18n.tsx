import * as React from 'react';
import {
  createTranslator,
  type Locale,
  type LocaleKey,
  type Translate,
  type TranslateParams,
} from '@kube-ai-hub/locales';

interface I18nValue {
  locale: Locale;
  t: Translate;
}

const I18nContext = React.createContext<I18nValue | null>(null);

/**
 * Provides the translator.
 *
 * The signature has a default so a test that mounts a component in isolation
 * does not need to wrap it — the default simply fixes `zh`.
 */
export function I18nProvider({
  locale = 'zh',
  children,
}: {
  locale?: Locale;
  children: React.ReactNode;
}): React.ReactElement {
  const value = React.useMemo<I18nValue>(() => ({ locale, t: createTranslator(locale) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

const fallback: I18nValue = { locale: 'zh', t: createTranslator('zh') };

/** Translate a key. Falls back to `zh` outside a provider so stories render. */
export function useT(): Translate {
  return (React.useContext(I18nContext) ?? fallback).t;
}

export type { LocaleKey, TranslateParams };
