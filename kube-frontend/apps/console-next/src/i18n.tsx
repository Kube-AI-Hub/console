import * as React from 'react';
import {
  createTranslator,
  type Locale,
  type LocaleKey,
  type Translate,
  type TranslateParams,
} from '@kube-ai-hub/locales';

const LOCALE_KEY = 'kube-frontend-locale';

/**
 * Read the stored language.
 *
 * Done during render rather than in an effect: the shell paints immediately, and
 * a post-paint switch would flash Chinese on an English reader's screen on every
 * load.
 */
function readStoredLocale(): Locale | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(LOCALE_KEY);
    return value === 'zh' || value === 'en' ? value : null;
  } catch {
    // Private browsing can throw on access; the default is fine.
    return null;
  }
}

interface I18nValue {
  locale: Locale;
  t: Translate;
  setLocale: (next: Locale) => void;
}

const I18nContext = React.createContext<I18nValue | null>(null);

/**
 * Provides the translator and lets the reader change language.
 *
 * The old console changed language by writing `spec.lang` to the user resource
 * and reloading the page, because its strings were baked into a bundle. This app
 * carries both dictionaries, so switching is a state change: no reload, no
 * second network round trip.
 */
export function I18nProvider({
  locale: initialLocale,
  children,
}: {
  /** Forces a language, for tests and stories. Stored choice wins when omitted. */
  locale?: Locale;
  children: React.ReactNode;
}): React.ReactElement {
  const [locale, setLocaleState] = React.useState<Locale>(() => initialLocale ?? readStoredLocale() ?? 'zh');

  const setLocale = React.useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_KEY, next);
    } catch {
      // Ignore: persistence is a convenience, not a requirement.
    }
  }, []);

  const value = React.useMemo<I18nValue>(
    () => ({ locale, setLocale, t: createTranslator(locale) }),
    [locale, setLocale],
  );

  React.useEffect(() => {
    // Keeps assistive tech and the browser's own spell-check on the right
    // language; a Chinese page announced as English mispronounces every label.
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    // The tab title is chrome too: leaving it in the other language makes the
    // browser's own UI the last untranslated surface.
    document.title = createTranslator(locale)('app.name');
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

const fallback: I18nValue = {
  locale: 'zh',
  t: createTranslator('zh'),
  setLocale: () => undefined,
};

/** Current language and the setter. Falls back to `zh` outside a provider. */
export function useLocale(): I18nValue {
  return React.useContext(I18nContext) ?? fallback;
}

/** Translate a key. */
export function useT(): Translate {
  return useLocale().t;
}

export const LOCALE_STORAGE_KEY = LOCALE_KEY;

export type { Locale, LocaleKey, TranslateParams };
