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
import urllib.error
import urllib.request

#: Project-scoped pages, by route segment, used with `--scope project`.
PROJECT_PAGES = (
    'overview',
    'deployments',
    'statefulsets',
    'daemonsets',
    'jobs',
    'cronjobs',
    'pods',
    'services',
    'ingresses',
    'configmaps',
    'secrets',
    'serviceaccounts',
    'persistentvolumeclaims',
    'applications',
    'alertingrules',
    'custom-monitoring',
    'baseinfo',
)

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
    # Deep pages: charts, logs and provider-specific views. They read different endpoints than the
    # plain lists, so a member-cluster path bug can hide in any of them.
    'monitor',
    'gpus',
    'gpu-resource',
    'juicefs-storage',
    'events',
    'logs',
    'audit-logs',
    'log-collections',
    'members',
    'custom-resources',
    'custom-monitoring',
    'devops',
    'edgenodes',
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


def page_url(app: str, cluster: str, segment: str, scope: str, workspace: str, project: str) -> str:
    """The console URL of one page, in either scope."""
    if scope == 'project':
        return f'{app}/kube-frontend/{workspace}/clusters/{cluster}/projects/{project}/{segment}'
    return f'{app}/kube-frontend/clusters/{cluster}/{segment}'


def sweep(
    app: str,
    token: str,
    clusters: list[str],
    pages: tuple[str, ...],
    scope: str = 'cluster',
    workspace: str = 'public',
    project: str = 'spaces',
) -> list[dict]:
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
                    if response.status < 400:
                        return
                    # `/api/session/me` answering 401 is the auth handshake, not a page defect: the
                    # app asks before the token is applied. Counting it would put a red mark on
                    # whichever page happened to be open at that moment.
                    if response.url.endswith('/api/session/me'):
                        return
                    sink.append((response.status, response.url))

                page.on('response', record)
                page.goto(page_url(app, cluster, segment, scope, workspace, project), wait_until='domcontentloaded')
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

                # A 5xx here is usually the console's upstream hiccuping (observed: configz answering
                # 503 once, then 200). Reload once before calling it a failure -- a persistent 5xx
                # still fails, because the second attempt sees it too.
                transient = [entry for entry in failures if entry[0] >= 500]
                if state == 'error' and transient and len(failures) == len(transient):
                    failures.clear()
                    page.goto(page_url(app, cluster, segment, scope, workspace, project), wait_until='domcontentloaded')
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


def _call(bff: str, token: str, method: str, path: str, body: dict | None = None) -> tuple[int, str]:
    """One request through the BFF, returning (status, text)."""
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(
        f'{bff}{path}', data=data, method=method,
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            return response.status, response.read().decode()
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode()


def _collection(prefix: str, cluster: str, namespace: str, resource: str) -> str:
    """A grouped-resource collection on a specific cluster (the member form puts the segment first)."""
    segment = '' if cluster == 'host' else f'clusters/{cluster}/'
    return f'/{prefix}/{segment}namespaces/{namespace}/{resource}'


def _names(bff: str, token: str, path: str) -> set[str] | None:
    status, text = _call(bff, token, 'GET', f'{path}?limit=-1')
    if status != 200:
        return None
    return {(item.get('metadata') or {}).get('name') for item in (json.loads(text).get('items') or [])}


def write_check(bff: str, token: str, cluster: str, host: str, namespace: str) -> dict:
    """Prove a grouped write lands on the cluster it was sent to -- and only there.

    The failure this exists for: a ConfigMap created from a member-cluster page used to land on the
    host cluster, because the write path dropped the cluster segment. A page-level check cannot see
    that; listing *both* clusters can.

    A uniquely named Ingress is created, looked for on both clusters, then deleted. The name is
    unique per run so a parallel run cannot collide, and the delete happens in a `finally`.
    """
    import uuid

    name = f'tc-sweep-{uuid.uuid4().hex[:8]}'
    member_path = _collection('apis/clusters/' + cluster + '/networking.k8s.io/v1', cluster, namespace, 'ingresses')
    member_path = f'/apis/clusters/{cluster}/networking.k8s.io/v1/namespaces/{namespace}/ingresses'
    host_path = f'/apis/networking.k8s.io/v1/namespaces/{namespace}/ingresses'
    body = {
        'apiVersion': 'networking.k8s.io/v1',
        'kind': 'Ingress',
        'metadata': {'name': name},
        'spec': {'rules': [{'host': f'{name}.example.test', 'http': {'paths': [
            {'path': '/', 'pathType': 'Prefix', 'backend': {'service': {'name': 'nginx', 'port': {'number': 80}}}},
        ]}}]},
    }
    result = {'cluster': cluster, 'name': name, 'created': None, 'on_target': None, 'on_host': None, 'deleted': None, 'gone': None}
    try:
        status, _ = _call(bff, token, 'POST', member_path, body)
        result['created'] = status
        target_names = _names(bff, token, member_path) or set()
        host_names = _names(bff, token, host_path) or set()
        result['on_target'] = name in target_names
        result['on_host'] = name in host_names
    finally:
        status, _ = _call(bff, token, 'DELETE', f'{member_path}/{name}')
        result['deleted'] = status
        import time
        time.sleep(2)
        result['gone'] = name not in (_names(bff, token, member_path) or set())
    return result

def baseline(args, token: str, clusters: list[str]) -> int:
    """Everything that has to hold on a multi-cluster install, in one command.

    Two read sweeps (cluster-scoped and project-scoped) plus the write-landing check. Prints one
    line per phase and returns non-zero if any phase fails, so it can gate a release or a commit.
    """
    import time

    started = time.monotonic()
    failures = 0

    for scope, pages in (('cluster', PAGES), ('project', PROJECT_PAGES)):
        rows = sweep(args.app, token, clusters, pages, scope, args.workspace, args.project)
        broken = [row for row in rows if row['state'] == 'error']
        noisy = [row for row in rows if row['errors']]
        failures += len(broken)
        ready = sum(1 for row in rows if row['state'] == 'ready')
        empty = sum(1 for row in rows if row['state'] == 'empty')
        failed_requests = sum(len(row['errors']) for row in noisy)
        flag = 'OK  ' if not broken and not noisy else 'FAIL'
        print(f'{flag} {scope:8s} read: {len(rows)} visits, {ready} ready, {empty} empty, {len(broken)} error, {failed_requests} failed requests')
        for row in (broken + noisy)[:5]:
            print(f"       {row['cluster']} {row['page']}: {row['state']} {row['errors'][:1]}")

    for cluster in clusters:
        outcome = write_check(args.bff, token, cluster, 'host', args.namespace)
        ok = (
            outcome['created'] in (200, 201)
            and outcome['on_target'] is True
            and (cluster == 'host' or outcome['on_host'] is False)
            and outcome['deleted'] in (200, 202)
            and outcome['gone'] is True
        )
        failures += 0 if ok else 1
        flag = 'OK  ' if ok else 'FAIL'
        print(f'{flag} write    {cluster:8s}: {outcome}')

    elapsed = time.monotonic() - started
    verdict = 'PASS' if failures == 0 else 'FAIL'
    print(f'baseline {verdict} in {elapsed:.0f}s')
    return 0 if failures == 0 else 1

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--app', default='http://localhost:5179')
    parser.add_argument('--bff', default='http://127.0.0.1:8093')
    parser.add_argument('--clusters', default='host')
    parser.add_argument('--pages', default='')
    parser.add_argument('--scope', default='cluster', choices=('cluster', 'project'))
    parser.add_argument('--workspace', default='public')
    parser.add_argument('--project', default='spaces')
    parser.add_argument('--env-file', default='.env')
    parser.add_argument('--out', default='')
    parser.add_argument('--write-check', action='store_true', help='prove a grouped write lands on the right cluster')
    parser.add_argument('--namespace', default='spaces')
    parser.add_argument('--baseline', action='store_true', help='run read sweeps (both scopes) and the write check')
    args = parser.parse_args()

    env = _env(args.env_file)
    token = login(args.bff, env.get('KA_USERNAME', 'admin'), env.get('KA_PASSWORD', ''))
    default_pages = PROJECT_PAGES if args.scope == 'project' else PAGES
    pages = tuple(p.strip() for p in args.pages.split(',') if p.strip()) or default_pages
    clusters = [c.strip() for c in args.clusters.split(',') if c.strip()]

    if args.baseline:
        return baseline(args, token, clusters)

    if args.write_check:
        bad = 0
        for cluster in clusters:
            outcome = write_check(args.bff, token, cluster, 'host', args.namespace)
            # For the host cluster the "target" and "host" collections are the same one, so the
            # cross-cluster assertion only means something for a member.
            ok = (
                outcome['created'] in (200, 201)
                and outcome['on_target'] is True
                and (cluster == 'host' or outcome['on_host'] is False)
                and outcome['deleted'] in (200, 202)
                and outcome['gone'] is True
            )
            bad += 0 if ok else 1
            print(f"{'OK  ' if ok else 'FAIL'} write-check {cluster}: {outcome}")
        return 1 if bad else 0

    rows = sweep(args.app, token, clusters, pages, args.scope, args.workspace, args.project)

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
