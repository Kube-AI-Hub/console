from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

DEVOPS_PROJECTS = "/apis/devops.kubesphere.io/v1alpha3/devopsprojects"
TABS = ("members", "roles", "credentials")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_DEVOPS_PROJECTS_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01 DevOps 工程列表与详情骨架。"""

    ui = cluster_management_page
    assert ui.api is not None

    status, body = ui.api.request("GET", DEVOPS_PROJECTS)
    assert status == 200, f"GET {DEVOPS_PROJECTS} -> {status}: {str(body)[:300]}"
    items = (body or {}).get("items") or []
    expected = len(items)

    # The area sits under the cluster menu (registry scope: cluster), so the URL has no
    # workspace segment; the CRD list is what the page reads.
    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/devops")
    surface = ui.page.locator('[data-ai-id="devops:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

    state = surface.get_attribute("data-ai-state")
    if expected == 0:
        assert state == "empty", f"expected empty state, got {state}"
        text = surface.inner_text()
        assert "暂无 DevOps 工程" in text, text
        expect(surface.locator("tbody tr[data-ai-row]")).to_have_count(0)
        name = "tc-e2e-missing-devops"
    else:
        assert state == "ready", f"expected ready state, got {state}"
        expect(surface.locator("tbody tr[data-ai-row]")).to_have_count(expected, timeout=30_000)
        name = ((items[0].get("metadata") or {}).get("name")) or ""
        assert name
        expect(ui.page.locator(f'[data-ai-id="devops:link:{name}"]').last).to_be_visible(timeout=30_000)

    # Detail skeleton: basic information when the project exists, a not-found notice
    # otherwise, and the three tabs switchable in both cases (each one reports its own read).
    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/devops/{name}")
    detail = ui.page.locator('[data-ai-id="devops-detail:surface"]').last
    expect(detail).to_be_visible(timeout=30_000)
    expect(detail).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

    if expected == 0:
        expect(ui.page.locator('[data-ai-id="devops-detail:not-found"]').last).to_be_visible(timeout=60_000)
    else:
        expect(ui.page.locator('[data-ai-id="devops-detail:basic"]').last).to_be_visible(timeout=60_000)

    for tab in TABS:
        trigger = ui.page.locator(f'[data-ai-id="devops-detail:tab:{tab}"]').last
        expect(trigger).to_be_visible(timeout=30_000)
        trigger.click()
        expect(trigger).to_have_attribute("aria-selected", "true")
        panel = ui.page.locator(f'[data-ai-id="devops-detail:{tab}"]').last
        expect(panel).to_be_visible(timeout=20_000)
        # Exactly one of table / empty / failure may describe the collection; a failure must
        # not render as an empty table.
        collected = ui.page.locator(
            f'[data-ai-id="devops-detail:{tab}-table"], [data-ai-id="devops-detail:{tab}-empty"], '
            f'[data-ai-id="devops-detail:{tab}-error"]'
        )
        expect(collected.first).to_be_visible(timeout=60_000)
        handles = [
            ui.page.locator(f'[data-ai-id="devops-detail:{tab}-table"]'),
            ui.page.locator(f'[data-ai-id="devops-detail:{tab}-empty"]'),
            ui.page.locator(f'[data-ai-id="devops-detail:{tab}-error"]'),
        ]
        visible = sum(1 for handle in handles if handle.count() > 0)
        assert visible == 1, f"{tab} panel should render exactly one of table/empty/error, got {visible}"

    screenshot(ui.page, "devops-projects")
