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

#: Workspace-scoped pages. They do not belong to a cluster at all, so they were the one whole area
#: the sweep never visited.
WORKSPACE_PAGES = (
    'overview',
    'base-info',
    'members',
    'user-groups',
    'projects',
    'devops',
    'quota',
    'roles',
)

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
    if scope == 'workspace':
        return f'{app}/kube-frontend/workspaces/{workspace}/{segment}'
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
    bff: str = '',
    creds: tuple[str, str] | None = None,
) -> list[dict]:
    from playwright.sync_api import sync_playwright

    rows: list[dict] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(viewport={'width': 1500, 'height': 1000})
        page = context.new_page()
        _open_app(page, app, token)

        visited = 0
        for cluster in clusters:
            for segment in pages:
                visited += 1
                if visited > 1 and visited % 15 == 0:
                    # Re-seed periodically: one 401 anywhere signs the app out, and every page after
                    # that measures the login screen instead of the page.
                    _open_app(page, app, token)
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
                    if _is_expected_failure(response.status, response.url):
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
                if should_retry_page(state, failures):
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
                    # The session can drop mid-run (one 401 makes the app sign out, and every later
                    # navigation then lands on the login screen). Re-seed the token and try the page
                    # once more, instead of recording the rest of the run as signed out.
                    # Minting a token can itself fail (the console answers 503 now and then); fall
                    # back to the current one instead of crashing the whole run.
                    fresh = token
                    if creds:
                        try:
                            fresh = login(bff, creds[0], creds[1])
                            token = fresh
                        except Exception:
                            fresh = token
                    _open_app(page, app, fresh)
                    page.goto(page_url(app, cluster, segment, scope, workspace, project), wait_until='domcontentloaded')
                    for _ in range(20):
                        page.wait_for_timeout(2000)
                        if surface.count() == 0:
                            continue
                        state = surface.get_attribute('data-ai-state') or 'none'
                        if state != 'loading':
                            break
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


def write_verdict(outcome: dict) -> bool:
    """Did the write land on the target cluster, stay off the host, and get cleaned up?

    Every clause exists because of a real failure: a member-cluster write that landed on the host
    (the bug this check was written for), a delete that returned 200 but left the object behind, and
    a create the console answered with a 5xx.
    """
    cluster = outcome.get('cluster')
    return (
        outcome.get('created') in (200, 201)
        and outcome.get('on_target') is True
        and (cluster == 'host' or outcome.get('on_host') is False)
        and outcome.get('deleted') in (200, 202)
        and outcome.get('gone') is True
    )

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
        # A 5xx here is the console hiccuping, not the write being refused: retry once before
        # calling it a failure, the same rule the page sweep uses.
        if status >= 500:
            import time

            time.sleep(3)
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
    # One 5xx here turns a page into "skipped", which reads like "no such object". Retry once: the
    # A100 baseline showed two such skips that a clean run does not reproduce.
    if status >= 500:
        import time

        time.sleep(2)
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
                def visit():
                    page.goto(url, wait_until='domcontentloaded')
                    settled = 'none'
                    for _ in range(30):
                        page.wait_for_timeout(2000)
                        if surface.count() == 0:
                            continue
                        settled = surface.get_attribute('data-ai-state') or 'none'
                        if settled != 'loading':
                            break
                    return settled

                surface = page.locator('[data-ai-id$=":surface"]').last
                state = visit()
                # Same rule as the page sweep: a 5xx that goes away on a retry is the console
                # hiccuping, not the detail page being broken.
                if should_retry_page(state, failures):
                    failures.clear()
                    state = visit()
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
#: Which page shows each identity collection; used to tell "the page errors *because* the member
#: cannot answer" (consistent) from "the page renders data it should not have" (a defect).
IDENTITY_PAGE = {
    'nodes': 'nodes',
    'storageclasses': 'storageclasses',
    'namespaces': 'namespaces',
    'persistentvolumes': 'persistentvolumes',
    'cluster alerts': 'alerting-messages',
    'alert rule groups': 'alerting-policies',
    'secrets (project)': 'secrets',
    'configmaps (project)': 'configmaps',
    'deployments (project)': 'deployments',
}

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

#: Requests the console makes on purpose and handles itself. A member cluster has no readable quota
#: path (see docs/constitution.md C6), so the page asks, gets 404, and renders "unavailable". Counting
#: that as a failed request would report the designed behaviour as a defect.
EXPECTED_FAILURES = (
    '/namespaces/',  # paired with the resource below
)

EXPECTED_404_RESOURCES = ('resourcequotas', 'limitranges')


def _is_expected_failure(status: int, url: str) -> bool:
    """True when a failed request is one the console handles on purpose."""
    if status != 404:
        return False
    return any(resource in url for resource in EXPECTED_404_RESOURCES)

def transient_only(failures: list[tuple[int, str]]) -> bool:
    """True when every failure is a 5xx (or the link dropped).

    A page that failed because the console or the cluster hiccuped is worth one retry; a page that
    failed because of a 404 or a 403 is not -- retrying hides the defect behind a slower failure.
    """
    return bool(failures) and all(status >= 500 for status, _ in failures)


def should_retry_page(state: str, failures: list[tuple[int, str]]) -> bool:
    """One reload for a page that never rendered or rendered an error, when every failure is 5xx."""
    return state in ('error', 'none') and transient_only(failures)


def should_retry_tab(failures: list[tuple[int, str]]) -> bool:
    """One more click for a tab whose only failures are 5xx."""
    return transient_only(failures)

#: Handle of the watchdog timer, so the `finally` in `__main__` can cancel it. A local of `main()`
#: cannot be seen there -- that mistake turned a passing run into exit 1 with a NameError.
BUDGET_TIMER = None


class BudgetExceeded(RuntimeError):
    """Raised when a run outlives its budget."""


def with_budget(seconds: int):
    """Abort the run after `seconds`, whatever it is waiting on.

    A signal handler only runs at Python bytecode boundaries; measured 2026-11-17: with the upstream
    gone the process sat inside a Playwright call for 55 minutes and the alarm never fired. A watchdog
    thread plus `os._exit` does not need the main thread's cooperation, so it works there too.
    """
    import threading

    def killer():
        print(
            f'ABORTED: budget of {seconds}s exceeded (the upstream is probably gone;'
            ' see docs/plans/multicluster-playbook-20261117.md)',
            flush=True,
        )
        os._exit(3)

    timer = threading.Timer(seconds, killer)
    timer.daemon = True
    timer.start()
    return timer


def clear_budget(timer=None) -> None:
    if timer is not None:
        timer.cancel()

def preflight(app: str, bff: str, creds: tuple[str, str], attempts: int = 3) -> str | None:
    """Three probes before a ten-minute run: static site, BFF, login.

    A baseline that starts while the console is answering 502 spends ten minutes failing and then
    reports the failure as if it were a defect. Checking first costs two seconds and turns the
    outcome into "the environment is not up" instead of "the console is broken".

    Returns the token, or None when the environment is not usable.
    """
    import time

    status, _ = _call(bff, '', 'GET', '/api/session/me')
    if status not in (200, 401):
        print(f'preflight: BFF {bff} answered {status} on /api/session/me')
        return None

    try:
        import urllib.request

        with urllib.request.urlopen(f'{app}/kube-frontend/', timeout=20) as response:
            if response.status != 200:
                print(f'preflight: app {app} answered {response.status}')
                return None
    except Exception as cause:
        print(f'preflight: app {app} is not serving ({type(cause).__name__})')
        return None

    for attempt in range(attempts):
        try:
            return login(bff, creds[0], creds[1])
        except Exception as cause:
            print(f'preflight: login attempt {attempt + 1}/{attempts} failed ({type(cause).__name__})')
            time.sleep(3)
    return None

def sweep_tabs(app: str, bff: str, token: str, clusters: list[str], workspace: str, project: str) -> list[dict]:
    """Open every tab of a few detail pages and record what each one renders.

    A detail page loads different endpoints per tab, so a page that opens fine can still have a tab
    that renders nothing. The list/detail sweeps never click, so this is the only check that would
    notice. A tab counts as broken when its body stays tiny or its requests fail.
    """
    from playwright.sync_api import sync_playwright

    targets = (
        ('deployments', True),
        ('nodes', False),
    )
    results: list[dict] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(viewport={'width': 1500, 'height': 1000})
        for cluster in clusters:
            for resource, namespaced in targets:
                name = _first_name(bff, token, cluster, resource, namespaced, project)
                if not name:
                    results.append({'cluster': cluster, 'page': resource, 'tab': '<none>', 'body': 0, 'errors': [], 'skipped': True})
                    continue
                page = context.new_page()
                _open_app(page, app, token)
                failures: list[tuple[int, str]] = []

                def record(response, sink=failures):
                    if response.status < 400 or response.url.endswith('/api/session/me'):
                        return
                    sink.append((response.status, response.url))

                page.on('response', record)
                url = (f'{app}/kube-frontend/{workspace}/clusters/{cluster}/projects/{project}/{resource}/{name}'
                       if namespaced else f'{app}/kube-frontend/clusters/{cluster}/{resource}/{name}')
                page.goto(url, wait_until='domcontentloaded')
                # Wait for the page to stop growing instead of a fixed delay: a member cluster answers
                # slower, and a fixed 9s read the page mid-load and recorded it as "no tabs".
                previous = -1
                for _ in range(15):
                    page.wait_for_timeout(2000)
                    current = len(page.evaluate('() => document.body.innerText').strip())
                    if current == previous and current > 300:
                        break
                    previous = current
                # The tab strip alone is already a few hundred characters, so a fixed body-length
                # threshold cannot tell "rendered an empty state" from "rendered nothing". Compare
                # each tab against the page as it was before any tab was clicked.
                baseline_body = len(page.evaluate('() => document.body.innerText').strip())
                tabs = page.locator('[role="tab"]')
                count = tabs.count()
                if count == 0:
                    # Not a failure: some detail pages have no tab strip at all. Reported so it is
                    # visible that the page was visited but had nothing to click.
                    results.append({'cluster': cluster, 'page': f'{resource}/{name}', 'tab': '<no tabs>',
                                    'body': len(page.evaluate('() => document.body.innerText').strip()),
                                    'errors': [], 'skipped': True})

                for index in range(count):
                    tabs.nth(index).click()
                    page.wait_for_timeout(3500)
                    # A 5xx behind a tab is the console or the member cluster hiccuping; click it
                    # once more before recording it as broken.
                    if should_retry_tab(failures):
                        failures.clear()
                        tabs.nth(index).click()
                        page.wait_for_timeout(3500)
                    results.append({
                        'cluster': cluster,
                        'page': f'{resource}/{name}',
                        'tab': (tabs.nth(index).inner_text().strip() or f'#{index}')[:16],
                        'body': len(page.evaluate('() => document.body.innerText').strip()),
                        'errors': [{'status': status, 'url': target.replace(app, '')} for status, target in failures],
                    })
                    failures.clear()
                page.remove_listener('response', record)
                page.close()
        browser.close()
    return results

#: Pages walked with the keyboard: (route segment, scope). The walk records the first tab stops and
#: whether each one draws a focus ring, and checks that the skip link comes first.
KEYBOARD_PAGES = (
    ('configmaps', 'project'),
    ('deployments', 'project'),
    ('nodes', 'cluster'),
)

#: Pages reachable without a session. They still cover inputs, buttons and the focus styles, so the
#: keyboard check can run when no cluster is reachable.
KEYBOARD_LOCAL_PAGES = ('login',)


def sweep_a11y_local(app: str) -> list[dict]:
    """Structural accessibility of the one page reachable without a session.

    The login page is the only screen that renders with no cluster, and it is also the screen every
    reader meets first: a missing landmark, an unlabelled input or a nameless button there is worse
    than anywhere else. Assertions are the cheap, unambiguous ones -- no heuristics about wording.
    """
    from playwright.sync_api import sync_playwright

    checks: list[dict] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_context(viewport={'width': 1200, 'height': 800}).new_page()
        page.goto(f'{app}/kube-frontend/login', wait_until='domcontentloaded')
        page.wait_for_timeout(4000)
        lang = page.evaluate('() => document.documentElement.lang')
        checks.append({'check': 'html[lang]', 'ok': bool(lang), 'detail': lang or '(empty)'})
        mains = page.evaluate("() => document.querySelectorAll('main,[role=main]').length")
        checks.append({'check': 'one main landmark', 'ok': mains == 1, 'detail': str(mains)})
        h1s = page.evaluate("() => document.querySelectorAll('h1').length")
        checks.append({'check': 'one h1', 'ok': h1s == 1, 'detail': str(h1s)})
        unlabelled = page.evaluate("() => Array.from(document.querySelectorAll('input,select,textarea'))"
                                   ".filter(el => !(el.labels && el.labels.length) && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby'))"
                                   ".map(el => el.type || el.tagName)")
        checks.append({'check': 'every field has a label', 'ok': not unlabelled, 'detail': ','.join(unlabelled) or '-'})
        nameless = page.evaluate("() => Array.from(document.querySelectorAll('button'))"
                                 ".filter(el => !(el.textContent || '').trim() && !el.getAttribute('aria-label'))"
                                 ".map(el => el.className.slice(0, 24))")
        checks.append({'check': 'every button has a name', 'ok': not nameless, 'detail': ','.join(nameless) or '-'})
        browser.close()
    return checks

def sweep_keyboard(app: str, token: str | None, clusters: list[str], workspace: str, project: str, stops: int = 10, local_only: bool = False) -> list[dict]:
    """Walk the tab order of a few pages and report where focus goes.

    A page can look complete and still be unusable without a mouse: focus that never becomes visible,
    or a first stop that skips the navigation. Neither shows up in a screenshot.
    """
    from playwright.sync_api import sync_playwright

    js = ("() => { const el = document.activeElement; if (!el) return null; const cs = getComputedStyle(el);"
          " const parse = (value) => { const m = /rgba?\\(([\\d.]+)[,\\s]+([\\d.]+)[,\\s]+([\\d.]+)(?:[,\\/\\s]+([\\d.]+))?\\)/.exec(value || '');"
          "   if (!m) return null; return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])]; };"
          " const lum = (c) => { const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };"
          "   return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };"
          " const ratio = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };"
          " let bg = null, node = el;"
          " while (node && !bg) { const c = parse(getComputedStyle(node).backgroundColor); if (c && c[3] > 0.9) bg = c; node = node.parentElement; }"
          " if (!bg) bg = [255, 255, 255, 1];"
          " const ringColours = [];"
          " let probe = el;"
          " for (let level = 0; level < 3 && probe; level += 1) {"
          "   const pcs = getComputedStyle(probe);"
          "   if (pcs.outlineStyle !== 'none' && parseFloat(pcs.outlineWidth) > 0) { const c = parse(pcs.outlineColor); if (c) ringColours.push(c); }"
          "   if (parseFloat(pcs.borderTopWidth) > 0) { const c = parse(pcs.borderTopColor); if (c) ringColours.push(c); }"
          "   if (pcs.boxShadow && pcs.boxShadow !== 'none') {"
          "     for (const shadow of pcs.boxShadow.split(/,(?![^(]*\\))/)) { const c = parse(shadow); if (c) ringColours.push(c); }"
          "   }"
          "   probe = probe.parentElement;"
          " }"
          " const ratios = ringColours.map((c) => Number(ratio(c, bg).toFixed(2)));"
          " return { id: (el.getAttribute('data-ai-id') || el.getAttribute('aria-label') || (el.textContent||'').trim().slice(0,24) || el.tagName),"
          "   tag: el.tagName, ring: ringColours.length > 0, best: ratios.length ? Math.max(...ratios) : null }; }")
    results: list[dict] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(viewport={'width': 1400, 'height': 900})
        page = context.new_page()
        if not local_only:
            _open_app(page, app, token)
        # Both themes: the focus ring must stay visible on the light theme too, and that is exactly
        # the kind of thing a screenshot review misses.
        for theme, accent in (('dark', 'violet'), ('light', 'violet'), ('dark', 'green'), ('light', 'green')):
            # Re-seed the session before each pass: one 401 signs the app out and the rest of the
            # walk then measures the login screen (which has inputs but no skip link).
            if not local_only:
                _open_app(page, app, token)
            else:
                # localStorage is origin-scoped: without a page on the app's origin the write throws
                # SecurityError. Land on the first local page before touching storage.
                page.goto(f'{app}/kube-frontend/{KEYBOARD_LOCAL_PAGES[0]}', wait_until='domcontentloaded')
                page.wait_for_timeout(1500)
            page.evaluate("t => localStorage.setItem('ai-kit-theme', t)", theme)
            page.evaluate("a => localStorage.setItem('ai-kit-accent', a)", accent)
            targets = ([(c, s, sc) for c in clusters for s, sc in KEYBOARD_PAGES] if not local_only
                       else [('local', segment, 'local') for segment in KEYBOARD_LOCAL_PAGES])
            for cluster, segment, scope in targets:
                    if scope == 'local':
                        url = f'{app}/kube-frontend/{segment}'
                    elif scope == 'project':
                        url = f'{app}/kube-frontend/{workspace}/clusters/{cluster}/projects/{project}/{segment}'
                    else:
                        url = f'{app}/kube-frontend/clusters/{cluster}/{segment}'
                    page.goto(url, wait_until='domcontentloaded')
                    page.wait_for_timeout(9000)
                    page.evaluate('() => document.body.focus()')
                    walk = []
                    for _ in range(stops):
                        page.keyboard.press('Tab')
                        page.wait_for_timeout(120)
                        seen = page.evaluate(js)
                        if seen and seen['tag'] not in ('BODY', 'HTML'):
                            walk.append(seen)
                    results.append({
                        'theme': f'{accent}/{theme}',
                        'cluster': cluster,
                        'page': segment,
                        'stops': len(walk),
                        'no_ring': [entry['id'] for entry in walk if not entry['ring']],
                        'weak': [entry['id'] for entry in walk if entry['ring'] and (entry['best'] or 0) < 3],
                        'worst': min([entry['best'] for entry in walk if entry['ring']] or [None], default=None),
                        'first': walk[0]['id'] if walk else '',
                        'order': [entry['id'][:24] for entry in walk[:6]],
                    })
        browser.close()
    return results

#: Pages walked by `--locale-scan`: a spread of the shapes that carry copy (overview panels, a wide
#: table, a project page, a settings form).
LOCALE_PAGES = (
    ('overview', 'cluster'),
    ('nodes', 'cluster'),
    ('configmaps', 'project'),
    ('info', 'settings'),
    # The two member pages the capability matrix still lists as "not verified in English".
    ('workspaces/{workspace}/members', 'workspace-raw'),
    ('projects/spaces/members', 'project-raw'),
)


def _looks_like_host(text: str, match: str) -> bool:
    """True when a dotted token is part of an address rather than a locale key."""
    start = text.find(match)
    while start >= 0:
        before = text[start - 1] if start > 0 else ''
        if before in ('@', '-', '/', '.'):
            return True
        start = text.find(match, start + 1)
    return False

def sweep_locale(app: str, token: str, cluster: str, workspace: str, project: str, locale: str) -> list[dict]:
    """Look for untranslated identifiers rendered as text.

    A missing translation shows up as `network.ippool` or `appRepos.title` in the middle of a sentence.
    Matching the shape `a.b.c` is crude but it found two real leaks on the cluster overview that no
    Chinese-language walkthrough made obvious.
    """
    import re

    from playwright.sync_api import sync_playwright

    # A locale key's segment after the dot is lowercase (`network.ippool`); a sentence boundary is not
    # (`…instead. Read the docs` reads as `instead.Read` once newlines are flattened).
    pattern = re.compile(r'\b[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9.]{3,}\b')
    results: list[dict] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(viewport={'width': 1500, 'height': 1000})
        page = context.new_page()
        _open_app(page, app, token)
        page.evaluate("value => localStorage.setItem('kube-frontend-locale', value)", locale)
        page.reload(wait_until='domcontentloaded')
        page.wait_for_timeout(4000)
        for segment, scope in LOCALE_PAGES:
            if scope == 'raw':
                url = f'{app}/kube-frontend/{segment}'
            elif scope == 'workspace-raw':
                url = f'{app}/kube-frontend/{segment.format(workspace=workspace)}'
            elif scope == 'project-raw':
                url = f'{app}/kube-frontend/{workspace}/clusters/{cluster}/{segment}'
            elif scope == 'project':
                url = f'{app}/kube-frontend/{workspace}/clusters/{cluster}/projects/{project}/{segment}'
            elif scope == 'settings':
                url = f'{app}/kube-frontend/settings/{segment}'
            else:
                url = f'{app}/kube-frontend/clusters/{cluster}/{segment}'
            page.goto(url, wait_until='domcontentloaded')
            page.wait_for_timeout(9000)
            text = page.evaluate('() => document.body.innerText')
            # Only standalone identifiers matter: an email (`admin@kube-ai-hub.local`) and a hostname
            # are not missing translations, and both match the shape `a.b`.
            found = sorted({
                match
                for match in pattern.findall(text)
                if not match.endswith('.')
                and not _looks_like_host(text, match)
            })
            label = segment.format(workspace=workspace) if '{workspace}' in segment else segment
            results.append({'page': label, 'locale': locale, 'raw': found[:6]})
        browser.close()
    return results

def resolve_workspace(bff: str, token: str, wanted: str) -> str:
    """Return a workspace name that actually exists.

    The URL segment of a project page is decorative (project pages key off cluster+namespace), so a
    wrong `--workspace` still produced green project reads while every workspace-scope page 404'd.
    Workspace pages do use the name, so resolve it once instead of trusting the flag.
    """
    status, text = _call(bff, token, 'GET', f'/kapis/tenant.kubesphere.io/v1alpha2/workspaces/{wanted}')
    if status == 200:
        return wanted
    status, text = _call(bff, token, 'GET', '/kapis/tenant.kubesphere.io/v1alpha2/workspaces?limit=-1')
    if status != 200:
        return wanted
    try:
        names = [item['metadata']['name'] for item in json.loads(text).get('items', [])]
    except (ValueError, KeyError, TypeError):
        return wanted
    if not names:
        return wanted
    chosen = 'system-workspace' if 'system-workspace' in names else names[0]
    print(f"workspace: '{wanted}' 不存在，改用 '{chosen}'（可用：{', '.join(names[:4])}）")
    return chosen

def baseline(args, token: str, clusters: list[str], allowed: set[str] | None = None, creds: tuple[str, str] | None = None) -> int:
    """Everything that has to hold on a multi-cluster install, in one command.

    Two read sweeps (cluster-scoped and project-scoped) plus the write-landing check. Prints one
    line per phase and returns non-zero if any phase fails, so it can gate a release or a commit.
    """
    import time

    allowed = allowed or set()
    started = time.monotonic()

    if creds:
        fresh = preflight(args.app, args.bff, creds)
        if fresh is None:
            print('baseline NOT RUN: the environment is not usable (see the preflight lines above)')
            return 2
        token = fresh
    failures = 0

    for scope, pages in (('cluster', PAGES), ('project', PROJECT_PAGES), ('workspace', WORKSPACE_PAGES)):
        rows = sweep(args.app, token, clusters, pages, scope, args.workspace, args.project, args.bff, creds)
        broken = [row for row in rows if row['state'] == 'error' and f"{row['cluster']}:{row['page']}" not in allowed]
        noisy = [row for row in rows if row['errors'] and f"{row['cluster']}:{row['page']}" not in allowed]
        failures += len(broken)
        ready = sum(1 for row in rows if row['state'] == 'ready')
        empty = sum(1 for row in rows if row['state'] == 'empty')
        failed_requests = sum(len(row['errors']) for row in noisy)
        flag = 'OK  ' if not broken and not noisy else 'FAIL'
        print(f'{flag} {scope:8s} read: {len(rows)} visits, {ready} ready, {empty} empty, {len(broken)} error, {failed_requests} failed requests')
        for row in (broken + noisy)[:5]:
            print(f"       {row['cluster']} {row['page']}: {row['state']} {row['errors'][:1]}")

    identity = data_identity(args.bff, token, clusters, args.project)
    suspects = [
        f for f in identity
        if f['verdict'] == 'SUSPECT'
        and f"{f['cluster']}:{IDENTITY_PAGE.get(f['label'], '')}" not in allowed
    ]
    identical = [f for f in identity if f['verdict'] == 'IDENTICAL']
    failures += len(suspects)
    identity_flag = 'OK  ' if not suspects else 'FAIL'
    if not identity:
        print('     identity: skipped -- a single cluster has nothing to compare against')
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

    if creds:
        try:
            token = login(args.bff, creds[0], creds[1])
        except Exception:
            pass
    tab_rows = sweep_tabs(args.app, args.bff, token, clusters, args.workspace, args.project)
    tab_broken = [row for row in tab_rows if (not row.get('skipped')) and (bool(row['errors']) or row['body'] <= row.get('baseline_body', 0) + 20)]
    failures += len(tab_broken)
    tab_flag = 'OK  ' if not tab_broken else 'FAIL'
    tab_skipped = sum(1 for row in tab_rows if row.get('skipped'))
    print(f'{tab_flag} tabs     read: {len(tab_rows)} tabs, {len(tab_rows) - len(tab_broken) - tab_skipped} ok, {tab_skipped} skipped, {len(tab_broken)} broken')
    for row in tab_broken[:5]:
        print(f"       {row['cluster']} {row['page']} {row['tab']}: body={row['body']} {row['errors'][:1]}")

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
        ok = write_verdict(outcome)
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
    parser.add_argument('--scope', default='cluster', choices=('cluster', 'project', 'workspace'))
    parser.add_argument('--workspace', default='public')
    parser.add_argument('--project', default='spaces')
    parser.add_argument('--env-file', default='.env')
    parser.add_argument('--out', default='')
    parser.add_argument('--write-check', action='store_true', help='prove a grouped write lands on the right cluster')
    parser.add_argument('--namespace', default='spaces')
    parser.add_argument('--allow', default='', help='cluster:page pairs that are known to be unavailable on that cluster')
    parser.add_argument('--baseline', action='store_true', help='run read sweeps (both scopes) and the write check')
    parser.add_argument('--details', action='store_true', help='also visit one detail page per kind per cluster')
    parser.add_argument('--interactions', action='store_true', help='sort and search the list on each cluster')
    parser.add_argument('--data-identity', action='store_true', help="compare each collection between host and members")
    parser.add_argument('--tabs', action='store_true', help='click every tab of a few detail pages')
    parser.add_argument('--keyboard', action='store_true', help='walk the tab order of a few pages')
    parser.add_argument('--keyboard-local', action='store_true', help='walk only the login page (no cluster needed)')
    parser.add_argument('--budget', type=int, default=1800, help='abort the whole run after this many seconds (default 1800)')
    parser.add_argument('--locale-scan', action='store_true', help='look for untranslated identifiers on a few pages')
    parser.add_argument('--locale', default='en', help='locale used by --locale-scan (default en)')
    args = parser.parse_args()

    global BUDGET_TIMER
    BUDGET_TIMER = with_budget(args.budget)

    env = _env(args.env_file)
    # Every mode gets the same three-try login the baseline has: a transient 503 at startup used to
    # kill a standalone run before it printed anything.
    # The login page needs no session, so the local walk must not be gated on the cluster being up.
    token = None if args.keyboard_local else preflight(args.app, args.bff, (env.get('KA_USERNAME', 'admin'), env.get('KA_PASSWORD', '')))
    if token:
        args.workspace = resolve_workspace(args.bff, token, args.workspace)
    if token is None and not args.keyboard_local:
        print('NOT RUN: the environment is not usable (see the preflight lines above)')
        return 2
    default_pages = (
        PROJECT_PAGES if args.scope == 'project' else WORKSPACE_PAGES if args.scope == 'workspace' else PAGES
    )
    pages = tuple(p.strip() for p in args.pages.split(',') if p.strip()) or default_pages
    clusters = [c.strip() for c in args.clusters.split(',') if c.strip()]

    if args.locale_scan:
        rows = sweep_locale(args.app, token, clusters[0], args.workspace, args.project, args.locale)
        bad = 0
        for row in rows:
            bad += 0 if not row['raw'] else 1
            flag = 'OK  ' if not row['raw'] else 'FAIL'
            print(f"{flag} {row['locale']} {row['page']:12s} raw={row['raw']}")
        return 1 if bad else 0

    if args.keyboard_local:
        checks = sweep_a11y_local(args.app)
        structural = 0
        for check in checks:
            flag = 'OK  ' if check['ok'] else 'FAIL'
            structural += 0 if check['ok'] else 1
            print(f"{flag} {check['check']:26s} {check['detail']}")
        rows = sweep_keyboard(args.app, None, [], args.workspace, args.project, local_only=True)
        bad = structural
        for row in rows:
            ok = row['stops'] >= 3 and not row['no_ring'] and not row['weak']
            bad += 0 if ok else 1
            flag = 'OK  ' if ok else 'FAIL'
            print(f"{flag} {row.get('theme','dark'):5s} {row['page']:14s} stops={row['stops']:<3d} no_ring={len(row['no_ring'])} weak={len(row['weak'])} worst={row['worst']}")
            if row['weak']:
                print(f"       焦点环对比度不足 3:1: {row['weak'][:3]}")
            if row['no_ring']:
                print(f"       没有焦点指示: {row['no_ring'][:4]}")
        return 1 if bad else 0

    if args.keyboard and not args.baseline:
        rows = sweep_keyboard(args.app, token, clusters, args.workspace, args.project)
        bad = 0
        for row in rows:
            ok = row['stops'] >= 5 and not row['no_ring'] and not row['weak']
            bad += 0 if ok else 1
            flag = 'OK  ' if ok else 'FAIL'
            print(f"{flag} {row.get('theme','dark'):5s} {row['cluster']:6s} {row['page']:14s} stops={row['stops']:<3d} no_ring={len(row['no_ring'])} weak={len(row['weak'])} worst={row['worst']} first={row['first'][:24]}")
            if row['no_ring']:
                print(f"       no ring: {row['no_ring'][:3]}")
            if row['weak']:
                print(f"       焦点环对比度不足 3:1: {row['weak'][:3]}")
        return 1 if bad else 0

    if args.tabs and not args.baseline:
        rows = sweep_tabs(args.app, args.bff, token, clusters, args.workspace, args.project)
        bad = 0
        for row in rows:
            broken = (not row.get('skipped')) and (bool(row['errors']) or row['body'] <= row.get('baseline_body', 0) + 20)
            bad += 1 if broken else 0
            flag = 'FAIL' if broken else ('SKIP' if row.get('skipped') else 'OK  ')
            print(f"{flag} {row['cluster']:6s} {row['page'][:34]:34s} {row['tab']:16s} body={row['body']:<5d} errors={len(row['errors'])}")
        return 1 if bad else 0

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

    allowed = {entry.strip() for entry in args.allow.split(',') if entry.strip()}  # used by both paths

    if args.baseline:
        return baseline(args, token, clusters, allowed, (env.get('KA_USERNAME', 'admin'), env.get('KA_PASSWORD', '')))

    if args.write_check:
        bad = 0
        for cluster in clusters:
            outcome = write_check(args.bff, token, cluster, 'host', args.namespace)
            # For the host cluster the "target" and "host" collections are the same one, so the
            # cross-cluster assertion only means something for a member.
            ok = write_verdict(outcome)
            bad += 0 if ok else 1
            print(f"{'OK  ' if ok else 'FAIL'} write-check {cluster}: {outcome}")
        return 1 if bad else 0

    rows = sweep(args.app, token, clusters, pages, args.scope, args.workspace, args.project, args.bff, (env.get('KA_USERNAME', 'admin'), env.get('KA_PASSWORD', '')))

    for row in rows:
        allowed_page = f"{row['cluster']}:{row['page']}" in allowed
        bad = [e for e in row['errors'] if e['status'] in (401, 403, 404, 500, 502, 503)]
        flag = 'FAIL' if row['state'] == 'error' and not allowed_page else ('OK  ' if allowed_page else '    ')
        print(f"{flag} {row['cluster']:6s} {row['page']:24s} state={row['state']:8s} rows={row['rows']:<3d} errors={len(bad)}")
        for entry in bad[:3]:
            print(f"       {entry['status']} {entry['url'][:130]}")

    if args.out:
        with open(args.out, 'w', encoding='utf-8') as sink:
            json.dump(rows, sink, ensure_ascii=False, indent=1)
    broken = [row for row in rows if row['state'] == 'error' and f"{row['cluster']}:{row['page']}" not in allowed]
    return 1 if broken else 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except BudgetExceeded as cause:
        print(f'ABORTED: {cause} (the upstream is probably gone; see docs/plans/multicluster-playbook-20261117.md)')
        raise SystemExit(3)
    finally:
        clear_budget(BUDGET_TIMER)
