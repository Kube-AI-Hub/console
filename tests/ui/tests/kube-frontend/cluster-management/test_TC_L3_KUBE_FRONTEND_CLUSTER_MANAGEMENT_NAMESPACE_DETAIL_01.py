from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

NAMESPACES = "/kapis/resources.kubesphere.io/v1alpha3/namespaces?limit=-1"


def _read(ui, path: str) -> dict:
    status, body = ui.api.request("GET", path)
    assert status == 200, f"GET {path} -> {status}: {str(body)[:300]}"
    return body if isinstance(body, dict) else {}


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_NAMESPACE_DETAIL_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NAMESPACE_DETAIL-01 集群项目详情。"""

    ui = cluster_management_page
    assert ui.api is not None

    projects = []
    for item in _read(ui, NAMESPACES).get("items") or []:
        metadata = item.get("metadata") or {}
        labels = metadata.get("labels") or {}
        if metadata.get("name") and labels.get("kubesphere.io/workspace"):
            projects.append(str(metadata["name"]))
    if not projects:
        pytest.skip("集群里没有可用的项目命名空间")
    name = "default" if "default" in projects else projects[0]

    # Expected quota rows: every `spec.hard` key of every ResourceQuota object.
    expected_quota = 0
    for quota in _read(ui, f"/api/v1/namespaces/{name}/resourcequotas").get("items") or []:
        expected_quota += len(((quota.get("spec") or {}).get("hard") or {}))
    # Expected limit rows: one per (type, resource) the LimitRange constrains.
    expected_limits = 0
    for limit_range in _read(ui, f"/api/v1/namespaces/{name}/limitranges").get("items") or []:
        for entry in ((limit_range.get("spec") or {}).get("limits") or []):
            resources = set()
            for bucket in ("min", "max", "default", "defaultRequest"):
                resources.update((entry.get(bucket) or {}).keys())
            expected_limits += len(resources)

    # The cluster-wide list is slow under shared load, and it is server-paged. Fill the
    # search box with the project name first: the filtered query is small and fast, and the
    # row link is what this case needs from the list. No full-page wait.
    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/namespaces")
    search = ui.page.locator('[data-ai-id="namespaces:search"]').last
    expect(search).to_be_visible(timeout=60_000)
    search.fill(name)
    link = ui.page.locator(f'[data-ai-id="projects:link:{name}"]').last
    expect(link).to_be_visible(timeout=120_000)
    link.click()

    surface = ui.page.locator('[data-ai-id="namespace-detail:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
    assert surface.get_attribute("data-ai-state") == "ready"

    expect(ui.page.locator('[data-ai-id="namespace-detail:name"]').last).to_have_text(name)
    expect(ui.page.locator('[data-ai-id="namespace-detail:status"]').last).to_be_visible()
    expect(ui.page.locator('[data-ai-id="namespace-detail:labels"]').last).to_be_visible()
    expect(ui.page.locator('[data-ai-id="namespace-detail:created-at"]').last).to_be_visible()

    quota_block = ui.page.locator('[data-ai-id="namespace-detail:quota"]').last
    expect(quota_block).to_be_visible()
    if expected_quota:
        rows = ui.page.locator('[data-ai-id="namespace-detail:quota-table"] tbody tr[data-ai-row]')
        expect(rows).to_have_count(expected_quota, timeout=30_000)
    else:
        expect(ui.page.locator('[data-ai-id="namespace-detail:quota-empty"]').last).to_be_visible(timeout=20_000)

    limits_block = ui.page.locator('[data-ai-id="namespace-detail:limits"]').last
    expect(limits_block).to_be_visible()
    if expected_limits:
        rows = ui.page.locator('[data-ai-id="namespace-detail:limits-table"] tbody tr[data-ai-row]')
        expect(rows).to_have_count(expected_limits, timeout=30_000)
    else:
        expect(ui.page.locator('[data-ai-id="namespace-detail:limits-empty"]').last).to_be_visible(timeout=20_000)

    screenshot(ui.page, "namespace-detail")

    # Back to the list: the detail must not be a dead end.
    ui.page.locator('[data-ai-id="namespace-detail:back"]').last.click()
    expect(ui.surface("namespaces")).to_be_visible(timeout=60_000)
    assert "/namespaces" in ui.page.url, ui.page.url

    # A project that no longer exists: the resources proxy answers 500 + not found, and the
    # page must say so instead of offering a retry loop that cannot succeed.
    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/namespaces/tc-e2e-no-such-namespace")
    not_found = ui.page.locator('[data-ai-id="namespace-detail:not-found"]').last
    expect(not_found).to_be_visible(timeout=60_000)
    expect(ui.page.locator('[data-ai-id="namespace-detail:retry"]')).to_have_count(0)