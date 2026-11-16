"""Sweep every cluster-scoped page across every cluster, and report what breaks.

Why this exists: the console is deployed on multi-cluster installations, and a path built for the
host cluster is *not* the path a member cluster needs -- `clusters/<id>` goes before the API group,
not after the version. A page that works on `host` can therefore be entirely broken on a member,
and nothing in the unit tests notices. Checking each page by hand does not scale past a handful.

So: log in once, then for each cluster and each page record

  - the page's surface state (`ready` / `empty` / `error` / `loading`),
  - how many rows it rendered,
  - how many requests answered 4xx/5xx,

and print a table plus a JSON file. `error` with a 404 is the signature of a member-cluster path bug.

Usage:

    python3 tools/multicluster_sweep.py --clusters host,xc --out .artifacts/sweep.json
"""

from __future__ import annotations

import argparse
import json
import os
import urllib.request

#: Cluster-scoped pages, by route segment. Keep this list to pages that exist on every cluster;
#: the sweep is about the cluster dimension, not about feature availability.
PAGES = (
    'overview',
    'nodes',
    'namespaces',
    'deployments',
    'statefulsets',
    'daemonsets',
    'pods',
    'services',
    'ingresses',
    'configmaps',
    'secrets',
    'serviceaccounts',
    'persistentvolumeclaims',
    'storageclasses',
    'persistentvolumes',
    'gateways',
    'networkpolicies',
    'ippools',
    'components',
    'alerting-policies',
    'alerting-messages',
    'monitor-resource',
    'node-usage',
)


def _env(path: str) -> dict[str, str]:
    values: dict[str, str] = {}
    if not os.path.exists(path):
        return values
    for line in open(path, encoding='utf-8'):
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            values[key.strip()] = value.strip()
    return values


def login(bff: str, username: str, password: str) -> str:
    """Token from the BFF, so the sweep uses the same session the pages do."""
    request = urllib.request.Request(
        f'{bff}/api/session/login',
        data=json.dumps({'username': username, 'password': password}).encode(),
        headers={'content-type': 'application/json'},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)['token']


def sweep(app: str, token: str, clusters: list[str], pages: tuple[str, ...]) -> list[dict]:
    from playwright.sync_api import sync_playwright

    rows: list[dict] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(viewport={'width': 1500, 'height': 1000})
        page = context.new_page()
        page.goto(f'{app}/kube-frontend/login', wait_until='domcontentloaded')
        page.evaluate("token => localStorage.setItem('kubesphere-token', token)", token)

        for cluster in clusters:
            for segment in pages:
                failures: list[tuple[int, str]] = []

                def record(response, sink=failures):
                    # Kept as a named function with a default arg: Playwright wraps handlers, so a
                    # lambda cannot be passed to `remove_listener` afterwards.
                    if response.status >= 400:
                        sink.append((response.status, response.url))

                page.on('response', record)
                page.goto(f'{app}/kube-frontend/clusters/{cluster}/{segment}', wait_until='domcontentloaded')
                # Wait for the page to settle instead of a fixed sleep: this cluster answers a
                # list in 1s when healthy and in tens of seconds when it is not, and a fixed wait
                # reports "ready with 0 rows" for a page that simply had not loaded yet.
                surface = page.locator('[data-ai-id$=":surface"]').last
                state = 'none'
                for _ in range(30):
                    page.wait_for_timeout(2000)
                    if surface.count() == 0:
                        continue
                    state = surface.get_attribute('data-ai-state') or 'none'
                    if state != 'loading':
                        break
                rows.append({
                    'cluster': cluster,
                    'page': segment,
                    'state': state,
                    'rows': page.locator('[data-ai-row]').count(),
                    'errors': [{'status': status, 'url': url.replace(app, '')} for status, url in failures],
                })
                page.remove_listener('response', record)

        browser.close()
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--app', default='http://localhost:5179')
    parser.add_argument('--bff', default='http://127.0.0.1:8093')
    parser.add_argument('--clusters', default='host')
    parser.add_argument('--pages', default='')
    parser.add_argument('--env-file', default='.env')
    parser.add_argument('--out', default='')
    args = parser.parse_args()

    env = _env(args.env_file)
    token = login(args.bff, env.get('KA_USERNAME', 'admin'), env.get('KA_PASSWORD', ''))
    pages = tuple(p.strip() for p in args.pages.split(',') if p.strip()) or PAGES
    rows = sweep(args.app, token, [c.strip() for c in args.clusters.split(',') if c.strip()], pages)

    for row in rows:
        bad = [e for e in row['errors'] if e['status'] in (401, 403, 404, 500, 502, 503)]
        flag = 'FAIL' if row['state'] == 'error' else '    '
        print(f"{flag} {row['cluster']:6s} {row['page']:24s} state={row['state']:8s} rows={row['rows']:<3d} errors={len(bad)}")
        for entry in bad[:3]:
            print(f"       {entry['status']} {entry['url'][:130]}")

    if args.out:
        with open(args.out, 'w', encoding='utf-8') as sink:
            json.dump(rows, sink, ensure_ascii=False, indent=1)
    broken = [row for row in rows if row['state'] == 'error']
    return 1 if broken else 0


if __name__ == '__main__':
    raise SystemExit(main())
