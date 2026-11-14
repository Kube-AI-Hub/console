from __future__ import annotations

import uuid
from urllib.parse import parse_qs, urlparse

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_WORKLOADS_02(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-02 七类列表档位与刷新。"""
    ui = cluster_management_page
    keyword = f"tc-e2e-absent-{uuid.uuid4().hex}"
    for kind in ("deployments", "statefulsets", "daemonsets", "jobs", "cronjobs", "services", "ingresses"):
        ui.page.goto(ui.url(kind))
        surface = ui.workload_surface(kind)
        expect(surface).to_have_attribute("aria-busy", "false", timeout=60_000)
        expect(surface).not_to_have_attribute("data-ai-state", "error")

        def matches(response):
            parsed = urlparse(response.url)
            params = parse_qs(parsed.query)
            return parsed.path.endswith(f"/{kind}") and params.get("limit") == ["10"] and params.get("page") == ["1"]

        with ui.page.expect_response(matches, timeout=60_000) as changed:
            ui.workload_page_size(kind).click()
            ui.page.get_by_role("option", name="10", exact=True).click()
        assert changed.value.ok
        search = ui.workload_search(kind)
        search.fill(keyword)
        expect(surface).to_have_attribute("data-ai-state", "empty", timeout=60_000)
        expect(surface).to_have_attribute("aria-busy", "false", timeout=60_000)
        with ui.page.expect_response(
            lambda response: matches(response) and parse_qs(urlparse(response.url).query).get("name") == [keyword],
            timeout=60_000,
        ) as refreshed:
            ui.workload_refresh(kind).click()
        assert refreshed.value.ok
        expect(surface).to_have_attribute("aria-busy", "false", timeout=60_000)
        expect(search).to_have_value(keyword)
        expect(ui.workload_page_size(kind)).to_contain_text("10")
        expect(surface).to_have_attribute("data-ai-state", "empty")
    screenshot(ui.page, "cluster-workloads-empty-refresh")
