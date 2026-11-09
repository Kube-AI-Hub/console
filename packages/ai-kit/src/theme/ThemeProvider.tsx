import * as React from 'react';

export type ThemeMode = 'dark' | 'light';
export type AccentPalette = 'violet' | 'green';

const MODE_KEY = 'ai-kit-theme';
const ACCENT_KEY = 'ai-kit-accent';
const MODE_ATTR = 'data-theme';
const ACCENT_ATTR = 'data-accent';

/**
 * Inline script that restores mode and accent before first paint.
 *
 * Running this in the document head avoids a flash of the wrong colours: React
 * cannot run early enough. Exported as a string so the host can drop it into
 * its own HTML template without depending on this module's runtime.
 */
export const themeBootstrapScript = `(function(){try{var m=localStorage.getItem('${MODE_KEY}');if(m==='light'||m==='dark'){document.documentElement.setAttribute('${MODE_ATTR}',m);}var a=localStorage.getItem('${ACCENT_KEY}');if(a==='violet'||a==='green'){document.documentElement.setAttribute('${ACCENT_ATTR}',a);}}catch(e){}})();`;

export function readStoredMode(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(MODE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    // Private browsing can throw on access; a missing preference is fine.
    return null;
  }
}

export function readStoredAccent(): AccentPalette | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(ACCENT_KEY);
    return value === 'violet' || value === 'green' ? value : null;
  } catch {
    return null;
  }
}

export function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute(MODE_ATTR, mode);
}

export function applyAccent(accent: AccentPalette): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute(ACCENT_ATTR, accent);
}

interface ThemeContextValue {
  theme: ThemeMode;
  accent: AccentPalette;
  setTheme: (mode: ThemeMode) => void;
  setAccent: (accent: AccentPalette) => void;
  toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: React.ReactNode;
  /** Mode used when nothing is stored. */
  defaultTheme?: ThemeMode;
  /** Accent used when nothing is stored. */
  defaultAccent?: AccentPalette;
  /** Persist both choices so the bootstrap script can restore them. */
  persist?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = 'dark',
  defaultAccent = 'violet',
  persist = true,
}: ThemeProviderProps): React.ReactElement {
  const [theme, setThemeState] = React.useState<ThemeMode>(
    () => readStoredMode() ?? defaultTheme,
  );
  const [accent, setAccentState] = React.useState<AccentPalette>(
    () => readStoredAccent() ?? defaultAccent,
  );

  // Both attributes live on <html> so portalled content (dialogs, menus) is
  // themed as well — a provider-scoped attribute would leave them unstyled.
  React.useEffect(() => {
    applyTheme(theme);
    if (!persist) return;
    try {
      window.localStorage.setItem(MODE_KEY, theme);
    } catch {
      // Ignore: persistence is a convenience, not a requirement.
    }
  }, [theme, persist]);

  React.useEffect(() => {
    applyAccent(accent);
    if (!persist) return;
    try {
      window.localStorage.setItem(ACCENT_KEY, accent);
    } catch {
      // Ignore.
    }
  }, [accent, persist]);

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      accent,
      setTheme: setThemeState,
      setAccent: setAccentState,
      toggleTheme: () => setThemeState((current) => (current === 'dark' ? 'light' : 'dark')),
    }),
    [theme, accent],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
}
