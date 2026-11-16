import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import type { ServerResponse } from 'node:http';

/**
 * Serving the built SPA from the BFF process.
 *
 * The app and its API share one container in production: the reverse proxy in
 * front (the old console) forwards `/kube-frontend/*` here with the prefix
 * stripped, so a request for `/system-workspace/.../configmaps` arrives as a path
 * with no file behind it and has to be answered with `index.html` for the client
 * router to take over. Splitting the static tree into a second container would
 * mean a second Service and a second thing to keep in sync with the build, for no
 * benefit — the BFF is already the only process that knows this app's routes.
 */

/** The prefix the app is mounted on; requests may arrive with or without it. */
export const APP_PREFIX = '/kube-frontend';

/** Extension → media type. Only what the build actually emits, plus sourcemaps. */
const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.yml': 'text/yaml; charset=utf-8',
};

/**
 * Remove the mount prefix, if present.
 *
 * Both shapes have to work: the reverse proxy strips the prefix before
 * forwarding, while a direct call (local development, a health probe, `curl`
 * against the pod) keeps it. Accepting both is what lets the same build run behind
 * either.
 */
export function stripAppPrefix(pathname: string): string {
  if (pathname === APP_PREFIX) return '/';
  if (pathname.startsWith(`${APP_PREFIX}/`)) return pathname.slice(APP_PREFIX.length);
  return pathname;
}

/**
 * Map a URL path to a file inside the static directory, or `null`.
 *
 * `normalize` + a `startsWith(root + sep)` check is what stops `..%2f..%2fetc`
 * from reading outside the build: `join` alone would happily resolve it.
 *
 * `root` is resolved first: a relative `STATIC_DIR` (as a local run uses) would
 * otherwise never satisfy the containment comparison, and every asset would 404.
 */
export function resolveStaticPath(root: string, pathname: string): string | null {
  const decoded = safeDecode(pathname);
  if (decoded === null) return null;
  const absoluteRoot = resolve(root);
  const candidate = resolve(absoluteRoot, `.${normalize(decoded)}`);
  if (candidate !== absoluteRoot && !candidate.startsWith(absoluteRoot + sep)) return null;
  return candidate;
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    // A malformed escape is not a file path.
    return null;
  }
}

/** Whether a path looks like a file request rather than a client route. */
export function looksLikeAsset(pathname: string): boolean {
  return extname(pathname) !== '';
}

function sendFile(response: ServerResponse, file: string, size: number, contentType: string, immutable: boolean): void {
  response.writeHead(200, {
    'content-type': contentType,
    'content-length': String(size),
    /*
     * Vite writes a content hash into every asset name, so a year-long immutable
     * cache is safe there — and is what makes a reload after a deploy cheap. The
     * shell and anything unhashed must revalidate, or a reader keeps the previous
     * build until the cache expires.
     */
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).pipe(response);
}

export interface StaticResult {
  /** True when this module answered the request. */
  handled: boolean;
}

/**
 * Answer a GET/HEAD from the static directory, falling back to the SPA shell.
 *
 * The fallback is deliberately narrow: only a request that accepts HTML and has
 * no file extension can be a client route. An API-shaped path or a missing `.js`
 * chunk must 404 rather than return HTML — a script tag receiving `index.html`
 * fails with a syntax error that says nothing about the real problem.
 */
export async function serveStatic(
  root: string,
  pathname: string,
  method: string | undefined,
  accept: string | undefined,
  response: ServerResponse,
): Promise<StaticResult> {
  if (method !== 'GET' && method !== 'HEAD') return { handled: false };
  const absoluteRoot = resolve(root);

  const candidate = resolveStaticPath(root, pathname);
  if (candidate !== null) {
    const info = await stat(candidate).catch(() => null);
    if (info?.isFile()) {
      const type = CONTENT_TYPES[extname(candidate).toLowerCase()] ?? 'application/octet-stream';
      // Only the hashed asset tree is immutable; everything else revalidates.
      sendFile(response, candidate, info.size, type, candidate.includes(`${sep}assets${sep}`));
      return { handled: true };
    }
  }

  /*
   * The shell is only for a navigation. `text/html` is what a browser sends; the
   * wildcard type curl and most probes send is treated as one too, because
   * refusing it turns a working deployment into a 404 for every command-line
   * check. An explicit `application/json` still gets a 404 rather than HTML,
   * which is the case that matters — an API client parsing `index.html` fails
   * incomprehensibly.
   */
  const accepts = (accept ?? '').trim();
  const wantsHtml = accepts === '' || accepts.includes('*/*') || accepts.includes('text/html');
  if (!looksLikeAsset(pathname) && wantsHtml) {
    const shell = join(absoluteRoot, 'index.html');
    const info = await stat(shell).catch(() => null);
    if (info?.isFile()) {
      sendFile(response, shell, info.size, CONTENT_TYPES['.html'] ?? 'text/html; charset=utf-8', false);
      return { handled: true };
    }
  }
  return { handled: false };
}
