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


def _open_app(page, app: str, token: str) -> None:
    """Land in the app with a session, deterministically.

    Writing the token and navigating in one breath races the app's own boot: the app reads storage
    while the token is still absent, renders the login screen, and every later measurement is taken
    on a page that never became the app. That showed up as `ready` with zero rows -- a blank page
    recorded as a healthy one. Reloading *after* the token is stored makes the boot see it.
    """
    page.goto(f'{app}/kube-frontend/login', wait_until='domcontentloaded')
    page.evaluate("token => localStorage.setItem('kubesphere-token', token)", token)
    # Boot again with the token in place, then wait for the shell rather than for a fixed delay.
    page.reload(wait_until='domcontentloaded')
    try:
        page.wait_for_selector('[data-ai-id^="shell:"]', timeout=30_000)
    except Exception:
        # The shell handle is a convenience; a page that renders later still gets measured, but a
        # page that never renders is reported as blank rather than as ready.
        pass

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
        _open_app(page, app, token)

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
                # A redirect to /login is not a page: the login screen has its own `:surface`,
                # which used to be scored as `ready` with zero rows -- a signed-out session
                # reported as a healthy page. Report it for what it is.
                if '/login' in page.url:
                    state = 'signed-out'
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

#: Detail pages: (route segment, kapis resource, whether it is namespaced). The object name is
#: resolved from the API per cluster, because hard-coding one would rot on a shared installation.
DETAIL_PAGES = (
    ('nodes', 'nodes', False),
    ('deployments', 'deployments', True),
    ('pods', 'pods', True),
    ('configmaps', 'configmaps', True),
    ('persistentvolumeclaims', 'persistentvolumeclaims', True),
    ('services', 'services', True),
)


def _first_name(bff: str, token: str, cluster: str, resource: str, namespaced: bool, namespace: str) -> str | None:
    """The first object name of a collection on a specific cluster, or None."""
    segment = '' if cluster == 'host' else f'clusters/{cluster}/'
    ns = f'namespaces/{namespace}/' if namespaced else ''
    path = f'/kapis/{segment}resources.kubesphere.io/v1alpha3/{ns}{resource}?limit=1'
    status, text = _call(bff, token, 'GET', path)
    if status != 200:
        return None
    items = json.loads(text).get('items') or []
    return (items[0].get('metadata') or {}).get('name') if items else None


def sweep_details(
    app: str,
    bff: str,
    token: str,
    clusters: list[str],
    workspace: str,
    project: str,
) -> list[dict]:
    """Visit one detail page per kind per cluster, resolving the object name from the API."""
    from playwright.sync_api import sync_playwright

    rows: list[dict] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(viewport={'width': 1500, 'height': 1000})
        page = context.new_page()
        _open_app(page, app, token)

        for cluster in clusters:
            for segment, resource, namespaced in DETAIL_PAGES:
                name = _first_name(bff, token, cluster, resource, namespaced, project)
                if not name:
                    rows.append({'cluster': cluster, 'page': f'{segment}/<none>', 'state': 'empty', 'rows': 0, 'errors': []})
                    continue
                failures: list[tuple[int, str]] = []

                def record(response, sink=failures):
                    if response.status < 400 or response.url.endswith('/api/session/me'):
                        return
                    sink.append((response.status, response.url))

                page.on('response', record)
                url = f'{app}/kube-frontend/{workspace}/clusters/{cluster}/projects/{project}/{segment}/{name}'
                if not namespaced:
                    url = f'{app}/kube-frontend/clusters/{cluster}/{segment}/{name}'
                page.goto(url, wait_until='domcontentloaded')
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
                    'page': f'{segment}/{name}',
                    'state': state,
                    'rows': page.locator('[data-ai-row]').count(),
                    'errors': [{'status': status, 'url': url.replace(app, '')} for status, url in failures],
                })
                page.remove_listener('response', record)

        browser.close()
    return rows

#: Pages whose list interactions (sort, search, page size) are exercised, with the ai-id prefix the
#: page uses for its list. Interaction is a different request than the first paint: sorting adds
#: `sortBy`, searching adds `keyword`, a size change adds `limit` -- each is a chance to drop the
#: cluster segment.
#: (route segment, scope, ai-id prefix). The workload list derives both handles from the kind
#: (`deployments:search`, `deployments:sort:…`); the cluster pod list uses `cluster-pods` and only
#: exists at cluster scope, which is why the scope is part of the tuple.
INTERACTION_PAGES = (
    ('deployments', 'project', 'deployments'),
    ('configmaps', 'project', 'configmaps'),
    ('pods', 'cluster', 'cluster-pods'),
)


def sweep_interactions(
    app: str, token: str, clusters: list[str], workspace: str, project: str,
) -> list[dict]:
    """Sort, search, resize, page, hide a column and filter the list, watching for failures.

    Each interaction is a different request shape (`sortBy`, `keyword`, `limit`, `page`, a filter
    value), and any of them can drop the cluster segment. A page that renders correctly can still
    be broken the moment someone sorts it.

    Every interaction records whether it actually happened: a missing handle must not look like a
    pass. A 5xx that goes away on a retry is this installation hiccuping, not a defect -- the same
    rule the page sweep uses.
    """
    from playwright.sync_api import sync_playwright

    results: list[dict] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(viewport={'width': 1500, 'height': 1000})
        page = context.new_page()
        _open_app(page, app, token)

        for cluster in clusters:
            for segment, scope, prefix in INTERACTION_PAGES:
                url = (f'{app}/kube-frontend/{workspace}/clusters/{cluster}/projects/{project}/{segment}'
                       if scope == 'project' else f'{app}/kube-frontend/clusters/{cluster}/{segment}')
                # A fresh page per list: a menu or modal left open by the previous list swallowed
                # every later click, which showed up as a run of silent SKIPs.
                if page is not None:
                    page.close()
                page = context.new_page()
                _open_app(page, app, token)

                def run_once():
                    failures: list[tuple[int, str]] = []
                    acted = {'sort': False, 'search': False, 'page_size': False, 'next_page': False,
                             'columns': False, 'filter': False, 'requests': 0}

                    def record(response, sink=failures):
                        if response.status < 400 or response.url.endswith('/api/session/me'):
                            return
                        sink.append((response.status, response.url))

                    def count_request(request, sink=acted):
                        if '/kapis/' in request.url or '/apis/' in request.url:
                            sink['requests'] += 1

                    page.on('response', record)
                    page.on('request', count_request)
                    page.goto(url, wait_until='domcontentloaded')
                    page.wait_for_timeout(7000)

                    sort = page.locator(f'[data-ai-id^="{prefix}:sort:"]').first
                    if sort.count():
                        before = acted['requests']
                        sort.click()
                        page.wait_for_timeout(3000)
                        acted['sort'] = acted['requests'] > before

                    search = page.locator(f'[data-ai-id="{prefix}:search"]').first
                    if search.count():
                        before = acted['requests']
                        search.fill('zzz-no-such-object')
                        page.wait_for_timeout(3000)
                        acted['search'] = acted['requests'] > before
                        search.fill('')
                        page.wait_for_timeout(1500)

                    page_size = page.locator(f'[data-ai-id="{prefix}:page-size"]').first
                    if page_size.count():
                        before = acted['requests']
                        page_size.click()
                        page.wait_for_timeout(800)
                        options = page.locator('[role="option"]')
                        if options.count() > 1:
                            options.nth(1).click()
                            page.wait_for_timeout(3000)
                        else:
                            page.keyboard.press('Escape')
                        acted['page_size'] = acted['requests'] > before

                    next_page = page.locator(f'[data-ai-id="{prefix}:page:next"]').first
                    if next_page.count() and not next_page.is_disabled():
                        before = acted['requests']
                        next_page.click()
                        page.wait_for_timeout(3000)
                        acted['next_page'] = acted['requests'] > before

                    # Column visibility is client-side: no request is expected, so the evidence is
                    # that a checkbox really toggled and that nothing errored.
                    columns = page.locator(f'[data-ai-id="{prefix}:columns"]').first
                    if columns.count():
                        headers_before = page.locator('thead th').count()
                        columns.click()
                        page.wait_for_timeout(1000)
                        # Each toggle carries `columns:<key>`; `:reset` is the last item and is not
                        # a toggle, so it is excluded rather than clicked by accident.
                        toggles = page.locator(f'[data-ai-id^="{prefix}:columns:"]:not([data-ai-id$=":reset"])')
                        if toggles.count():
                            toggles.first.click()
                            page.wait_for_timeout(1200)
                            headers_after = page.locator('thead th').count()
                            # Evidence: a column really disappeared, not merely a click that landed.
                            acted['columns'] = headers_after != headers_before
                            toggles.first.click()
                            page.wait_for_timeout(800)
                        page.keyboard.press('Escape')
                        page.wait_for_timeout(600)

                    filter_control = page.locator(f'[data-ai-id^="{prefix}:filter:"]').first
                    if filter_control.count():
                        before = acted['requests']
                        filter_control.click()
                        page.wait_for_timeout(800)
                        options = page.locator('[role="option"]')
                        if options.count() > 1:
                            options.nth(1).click()
                            page.wait_for_timeout(3000)
                            acted['filter'] = acted['requests'] > before
                        else:
                            page.keyboard.press('Escape')

                    page.remove_listener('response', record)
                    page.remove_listener('request', count_request)
                    return acted, failures

                acted, failures = run_once()
                # A 5xx that disappears on a second attempt is the installation hiccuping (the pods
                # list of a member cluster is a ~470 KB response and times out under load). The
                # evidence from the first attempt is kept: a retry that lands on a slow page must
                # not erase the interactions the first attempt did perform.
                if failures and all(status >= 500 for status, _ in failures):
                    retry_acted, failures = run_once()
                    acted = {key: (acted[key] or retry_acted[key]) if isinstance(acted[key], bool) else acted[key]
                             for key in acted}
                    acted['requests'] = max(acted['requests'], retry_acted['requests'])

                results.append({
                    'cluster': cluster,
                    'page': segment,
                    'acted': acted,
                    'errors': [{'status': status, 'url': url_.replace(app, '')} for status, url_ in failures],
                })

        browser.close()
    return results

#: Collections compared across clusters to catch "the page rendered, but with another cluster's data".
#: (label, kapis group/version, resource, namespaced)
IDENTITY_RESOURCES = (
    ('nodes', 'resources.kubesphere.io/v1alpha3', 'nodes', False),
    ('storageclasses', 'resources.kubesphere.io/v1alpha3', 'storageclasses', False),
    ('namespaces', 'resources.kubesphere.io/v1alpha3', 'namespaces', False),
    ('persistentvolumes', 'resources.kubesphere.io/v1alpha3', 'persistentvolumes', False),
    ('cluster alerts', 'alerting.kubesphere.io/v2beta1', 'globalalerts', False),
    ('alert rule groups', 'alerting.kubesphere.io/v2beta1', 'rulegroups', False),
    # Project-scoped: the same namespace exists on both clusters, so an identical set is normal --
    # the useful signal here is a member that cannot answer at all.
    ('secrets (project)', 'resources.kubesphere.io/v1alpha3', 'secrets', True),
    ('configmaps (project)', 'resources.kubesphere.io/v1alpha3', 'configmaps', True),
    ('deployments (project)', 'resources.kubesphere.io/v1alpha3', 'deployments', True),
)


def data_identity(bff: str, token: str, clusters: list[str], namespace: str) -> list[dict]:
    """Compare each collection between the host and every member.

    A page that renders rows is not proof the data belongs to the cluster being viewed: a hardcoded
    host path renders happily on a member. The signature is *the member's collection is unavailable
    while the host's is not* -- then any data on that member page came from the host.
    """
    findings: list[dict] = []
    for label, group, resource, namespaced in IDENTITY_RESOURCES:
        ns = f'namespaces/{namespace}/' if namespaced else ''
        host_path = f'/kapis/{group}/{ns}{resource}?limit=-1'
        host_status, host_body = _call(bff, token, 'GET', host_path)
        host_names = _name_set(host_status, host_body)
        for cluster in clusters:
            if cluster == 'host':
                continue
            member_path = f'/kapis/clusters/{cluster}/{group}/{ns}{resource}?limit=-1'
            status, body = _call(bff, token, 'GET', member_path)
            member_names = _name_set(status, body)
            if status != 200 and host_status == 200:
                verdict = 'SUSPECT'
            elif member_names is not None and member_names == host_names:
                verdict = 'IDENTICAL'
            else:
                verdict = 'OK'
            findings.append({
                'label': label,
                'cluster': cluster,
                'host_status': host_status,
                'member_status': status,
                'host_count': None if host_names is None else len(host_names),
                'member_count': None if member_names is None else len(member_names),
                'verdict': verdict,
            })
    return findings


def _name_set(status: int, body: str) -> set[str] | None:
    if status != 200:
        return None
    try:
        items = json.loads(body).get('items') or []
    except json.JSONDecodeError:
        return None
    return {str((item.get('metadata') or {}).get('name')) for item in items}

def _repo_state() -> str:
    """HEAD and the number of modified files, so a baseline record can be attributed.

    In a shared checkout a teammate's uncommitted work can break every page; without this line a
    failing baseline looks like a defect in whatever was last committed.
    """
    import subprocess

    def run(*args: str) -> str:
        try:
            return subprocess.run(args, capture_output=True, text=True, timeout=20).stdout.strip()
        except (OSError, subprocess.SubprocessError):
            return ''

    head = run('git', 'rev-parse', '--short', 'HEAD') or 'unknown'
    dirty = run('git', 'status', '--porcelain')
    changed = len([line for line in dirty.splitlines() if line.strip()])
    return f'{head} (dirty files: {changed})'

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

    identity = data_identity(args.bff, token, clusters, args.project)
    suspects = [f for f in identity if f['verdict'] == 'SUSPECT']
    identical = [f for f in identity if f['verdict'] == 'IDENTICAL']
    failures += len(suspects)
    identity_flag = 'OK  ' if not suspects else 'FAIL'
    print(f'{identity_flag} identity read: {len(identity)} collections, {len(identity) - len(suspects) - len(identical)} distinct, {len(identical)} identical, {len(suspects)} suspect')
    for finding in suspects[:5]:
        print(f"       {finding['label']} @ {finding['cluster']}: host={finding['host_status']} member={finding['member_status']}")

    detail_rows = sweep_details(args.app, args.bff, token, clusters, args.workspace, args.project)
    detail_broken = [row for row in detail_rows if row['state'] == 'error' or row['errors']]
    failures += len(detail_broken)
    detail_flag = 'OK  ' if not detail_broken else 'FAIL'
    print(f'{detail_flag} detail   read: {len(detail_rows)} visits, {sum(1 for row in detail_rows if row["state"] in ("ready", "empty"))} ok, {len(detail_broken)} broken')
    for row in detail_broken[:5]:
        print(f"       {row['cluster']} {row['page']}: {row['state']} {row['errors'][:1]}")

    interaction_rows = sweep_interactions(args.app, token, clusters, args.workspace, args.project)
    acted = [row for row in interaction_rows if row['acted']['sort'] or row['acted']['search']]
    interaction_broken = [row for row in interaction_rows if row['errors']]
    failures += len(interaction_broken)
    interaction_flag = 'OK  ' if not interaction_broken else 'FAIL'
    print(f'{interaction_flag} interact read: {len(interaction_rows)} lists, {len(acted)} interacted, {len(interaction_rows) - len(acted)} skipped, {len(interaction_broken)} broken')
    for row in interaction_broken[:5]:
        print(f"       {row['cluster']} {row['page']}: {row['errors'][:1]}")

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
    print(f'baseline {verdict} in {elapsed:.0f}s | repo {_repo_state()}')
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
    parser.add_argument('--details', action='store_true', help='also visit one detail page per kind per cluster')
    parser.add_argument('--interactions', action='store_true', help='sort and search the list on each cluster')
    parser.add_argument('--data-identity', action='store_true', help="compare each collection between host and members")
    args = parser.parse_args()

    env = _env(args.env_file)
    token = login(args.bff, env.get('KA_USERNAME', 'admin'), env.get('KA_PASSWORD', ''))
    default_pages = PROJECT_PAGES if args.scope == 'project' else PAGES
    pages = tuple(p.strip() for p in args.pages.split(',') if p.strip()) or default_pages
    clusters = [c.strip() for c in args.clusters.split(',') if c.strip()]

    if args.data_identity and not args.baseline:
        findings = data_identity(args.bff, token, clusters, args.project)
        bad = 0
        for f in findings:
            flag = {'SUSPECT': 'FAIL', 'IDENTICAL': 'WARN', 'OK': 'OK  '}[f['verdict']]
            bad += 1 if f['verdict'] == 'SUSPECT' else 0
            print(f"{flag} {f['label']:18s} {f['cluster']:6s} host={f['host_status']}/{f['host_count']} member={f['member_status']}/{f['member_count']}")
        return 1 if bad else 0

    if args.interactions and not args.baseline:
        rows = sweep_interactions(args.app, token, clusters, args.workspace, args.project)
        bad = 0
        for row in rows:
            noisy = [e for e in row['errors'] if e['status'] in (401, 403, 404, 500, 502, 503)]
            bad += 1 if noisy else 0
            # An interaction that never fired a request is not evidence; say so instead of passing.
            acted = row['acted']
            performed = any(acted[key] for key in ('sort', 'search', 'page_size', 'next_page', 'columns', 'filter'))
            flag = 'FAIL' if noisy else ('OK  ' if performed else 'SKIP')
            # SKIP is not a failure: a list with no rows renders no toolbar, so there is nothing to
            # interact with. It is printed rather than hidden, so nobody mistakes it for coverage.
            bad += 1 if noisy else 0
            print(f"{flag} {row['cluster']:6s} {row['page']:20s} sort={acted['sort']} search={acted['search']} size={acted['page_size']} next={acted['next_page']} cols={acted['columns']} filter={acted['filter']} requests={acted['requests']} errors={len(noisy)}")
            for entry in noisy[:3]:
                print(f"       {entry['status']} {entry['url'][:120]}")
        return 1 if bad else 0

    if args.details and not args.baseline:
        rows = sweep_details(args.app, args.bff, token, clusters, args.workspace, args.project)
        bad = 0
        for row in rows:
            broken = row['state'] == 'error'
            noisy = [e for e in row['errors'] if e['status'] in (401, 403, 404, 500, 502, 503)]
            bad += 1 if broken or noisy else 0
            flag = 'FAIL' if broken or noisy else 'OK  '
            print(f"{flag} {row['cluster']:6s} {row['page'][:44]:44s} state={row['state']:8s} errors={len(noisy)}")
        return 1 if bad else 0

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
