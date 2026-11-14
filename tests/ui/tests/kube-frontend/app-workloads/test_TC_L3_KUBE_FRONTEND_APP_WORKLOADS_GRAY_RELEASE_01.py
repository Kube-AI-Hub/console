from __future__ import annotations

from uuid import uuid4

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

#: The native CRD endpoint the page reads (verified 200 on this cluster; the kapis
#: proxy answers as well but returns the resource-proxy envelope).
STRATEGIES = "/apis/servicemesh.kubesphere.io/v1alpha2/namespaces/default/strategies"


def _strategy(name: str, target: str) -> dict:
    """A Canary strategy that routes a host to two versions, as the controller expects."""
    return {
        "apiVersion": "servicemesh.kubesphere.io/v1alpha2",
        "kind": "Strategy",
        "metadata": {"name": name, "namespace": "default", "labels": {"app": target}},
        "spec": {
            "type": "Canary",
            "principal": "v1",
            "governor": "v2",
            "strategyPolicy": "WaitForWorkloadReady",
            "selector": {"matchLabels": {"app": target}},
            "template": {
                "metadata": {"labels": {"app": target}},
                "spec": {
                    "hosts": [target],
                    "http": [
                        {
                            "route": [
                                {"destination": {"host": target, "subset": "v1"}},
                                {"destination": {"host": target, "subset": "v2"}},
                            ]
                        }
                    ],
                },
            },
        },
    }


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_GRAY_RELEASE_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01 灰度发布列表：空态可达，有策略时列头与行内容正确。"""

    ui = app_workloads_page
    assert ui.api is not None
    suffix = uuid4().hex[:8]
    name = f"tc-e2e-gray-{suffix}"
    target = f"tc-e2e-gray-svc-{suffix}"
    created = False

    try:
        # ---- empty state (when the project has no strategies yet) ----
        status, body = ui._request("GET", STRATEGIES)
        existing = (body.get("items") or []) if status == 200 else []
        ui.open("grayrelease")
        surface = ui.surface("grayrelease")
        expect(surface).to_be_visible()
        ui.wait_ready(surface)
        if not existing:
            assert ui.state("grayrelease") == "empty"
            expect(surface).to_contain_text("暂无灰度发布任务")

        # ---- one strategy: headers, row and derived fields ----
        status, payload = ui._request("POST", STRATEGIES, _strategy(name, target))
        assert status in (200, 201), (status, payload)
        created = True

        ui.open("grayrelease")
        surface = ui.surface("grayrelease")
        expect(surface).to_be_visible()
        ui.wait_ready(surface)
        expect(surface).to_have_attribute("data-ai-state", "ready")

        headers = [title.strip() for title in surface.locator("thead th:visible").all_inner_texts() if title.strip()]
        for column in ("名称", "类型", "目标服务", "状态"):
            assert column in headers, headers

        row = ui.row("grayrelease", name)
        expect(row).to_be_visible()
        text = row.inner_text()
        # spec.type drives the badge; a Chinese badge is what proves the mapping ran.
        assert "金丝雀发布" in text, text
        # The target service comes from spec.template.spec.hosts[0], not the strategy name.
        assert target in text, text
        # Complete/Failed/absent conditions map to one of four labels; a fresh object may
        # still be 未知 until the controller writes its condition.
        assert any(label in text for label in ("已完成", "进行中", "失败", "未知")), text
        assert "spec.type" not in text

        # Creation now has its own case; the list only has to expose the entry.
        expect(ui.page.locator('[data-ai-id="grayrelease:create"]')).to_be_visible(timeout=20_000)
        screenshot(ui.page, "gray-release")
    finally:
        if created:
            ui._request("DELETE", f"{STRATEGIES}/{name}")
