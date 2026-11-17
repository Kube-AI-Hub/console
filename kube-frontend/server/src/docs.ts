/**
 * Documentation links the console header shows (帮助菜单).
 *
 * The old console read these from its server config (`client.documents` in
 * `console/server/config.yaml`) and served them as globals; the new BFF is that server,
 * so it reads the same idea from env and exposes it at `GET /api/config`. Defaults match
 * the old deployment's relative paths, which are served by the same origin; a deployment
 * that hosts docs elsewhere overrides them without rebuilding the SPA.
 */
export interface DocsLink {
  /** User guide root. */
  url: string;
  /** API reference root. */
  api: string;
}

export interface DocsUrls {
  zh: DocsLink;
  en: DocsLink;
}

export const DEFAULT_DOCS: DocsUrls = {
  zh: { url: '/kube-docs/zh/docs/', api: '/kube-docs/zh/docs/reference/api-docs/' },
  en: { url: '/kube-docs/docs/', api: '/kube-docs/docs/reference/api-docs/' },
};

type Env = Record<string, string | undefined>;

/**
 * Read one URL from env.
 *
 * **Unset** falls back to the old console's relative path (so a stock deployment shows the
 * help entry); an explicitly empty value means "this deployment hosts no docs" and is
 * passed through as empty, which makes the SPA hide the entry rather than render a dead
 * link. The two states are different and must not collapse into the default.
 */
function url(env: Env, key: string, fallback: string): string {
  const value = env[key];
  return value === undefined ? fallback : value.trim();
}

/** Docs config from the BFF environment. */
export function loadDocs(env: Env = {}): DocsUrls {
  return {
    zh: {
      url: url(env, 'KS_DOCS_URL_ZH', DEFAULT_DOCS.zh.url),
      api: url(env, 'KS_DOCS_API_ZH', DEFAULT_DOCS.zh.api),
    },
    en: {
      url: url(env, 'KS_DOCS_URL_EN', DEFAULT_DOCS.en.url),
      api: url(env, 'KS_DOCS_API_EN', DEFAULT_DOCS.en.api),
    },
  };
}
