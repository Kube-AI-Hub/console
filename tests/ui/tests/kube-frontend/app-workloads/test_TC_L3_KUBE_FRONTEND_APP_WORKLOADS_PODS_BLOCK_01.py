from __future__ import annotations

from collections import Counter

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

DEPLOYMENTS = "/apis/apps/v1/namespaces/default/deployments"
PODS = "/api/v1/namespaces/default/pods"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_PODS_BLOCK_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-PODS_BLOCK-01 负载详情：关联容器组。"""

    ui = app_workloads_page
    assert ui.api is not None
    name = ui.unique("podsblock")
    ui.create_deployment(name, replicas=2, image="nginx:1.27")
    try:
        # Wait for the owner to exist and report the pods it started.
        for _ in range(30):
            status, deployment = ui._request("GET", f"{DEPLOYMENTS}/{name}")
            if status == 200 and ((deployment.get("status") or {}).get("replicas") or 0) >= 1:
                break
            ui.page.wait_for_timeout(2000)

        ui.page.goto(f"{ui.base}/deployments/{name}")
        surface = ui.detail_surface("deployments")
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)

        # The pod list is its own tab since the detail page got a tab system.
        ui.page.locator('[data-ai-id="workload-detail:tab-trigger:pods"]').click()
        block = ui.page.locator('[data-ai-id="deployments-detail:pods"]')
        expect(block).to_be_visible(timeout=30_000)
        headers = [text.strip() for text in block.locator("th").all_inner_texts()]
        assert headers == ["容器组名称", "状态", "所在节点", "重启次数", "创建时间"], headers

        # The block is selected by the workload's own selector; compare against the same
        # query rather than a count guessed from the name.
        label_selector = "&".join(f"{k}={v}" for k, v in ({"app": name}).items())
        status, pods = ui._request("GET", f"{PODS}?labelSelector={label_selector}")
        assert status == 200
        expected = len(pods.get("items") or [])
        assert expected > 0, "the deployment reported replicas but no pod carries the label"
        expect(block.locator("tbody tr")).to_have_count(expected)

        for row in block.locator("tbody tr").all():
            cells = [cell.strip() for cell in row.locator("td").all_inner_texts()]
            assert cells[1] != "", cells[1:2]

        # The pod name links into that pod's own page: "why is this one unhealthy" is
        # answered there, not in this summary.
        pod_link = block.locator('[data-ai-id^="deployments-detail:pod:"]').first
        expect(pod_link).to_be_visible()
        href = pod_link.get_attribute("href") or ""
        assert "/pods/" in href, href
        pod_link.click()
        pod_surface = ui.page.locator('[data-ai-id="pods-detail:surface"]')
        expect(pod_surface).to_be_visible(timeout=30_000)
        expect(pod_surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
        assert "/pods/" in ui.page.url, ui.page.url
        screenshot(ui.page, "workload-pods-block")
    finally:
        ui.delete_deployment(name)
