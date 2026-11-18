from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

UNPULLABLE = "tc-e2e.invalid/never-pulled:1.0"
UNSCHEDULABLE = {"tc-e2e-no-such-node": "true"}

#: init 容器 + 两个工作容器各自声明不同的请求与限制。三者之和才是页面该显示的值：
#:   requests: cpu 100m+500m+250m = 850m → 0.85 核；memory 64+128+64 = 256Mi
#:   limits:   cpu 1+500m        = 1.5 核；    memory 256+128     = 384Mi
AGGREGATED = {
    "initContainers": [
    {"name": "init-setup", "image": UNPULLABLE, "resources": {"requests": {"cpu": "100m", "memory": "64Mi"}}},
    ],
    "containers": [
        {
            "name": "main",
            "image": UNPULLABLE,
            "resources": {
                "requests": {"cpu": "500m", "memory": "128Mi"},
                "limits": {"cpu": "1", "memory": "256Mi"},
            },
        },
        {
            "name": "sidecar",
            "image": UNPULLABLE,
            "resources": {
                "requests": {"cpu": "250m", "memory": "64Mi"},
                "limits": {"cpu": "500m", "memory": "128Mi"},
            },
        },
    ],
}


def _create_pod(ui, name: str, spec: dict) -> str:
    body = {
        "apiVersion": "v1",
        "kind": "Pod",
        "metadata": {"name": name, "namespace": "default", "labels": {"app": name}},
        # Never scheduled: cleanup is instant and the resources block does not need a
        # running container — it reads spec.
        "spec": {"terminationGracePeriodSeconds": 0, "nodeSelector": UNSCHEDULABLE, **spec},
    }
    status, payload = ui._request("POST", "/api/v1/namespaces/default/pods", body)
    assert status in (200, 201), f"创建容器组 {name} 失败：{status} {repr(payload)[:200]}"
    return name


def _open_detail(ui, name: str):
    ui.open_detail("pods", name)
    surface = ui.detail_surface("pods")
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
    return surface


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_DETAIL_06(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-06 容器组详情：资源请求与限制的聚合。"""

    ui = app_workloads_page
    assert ui.api is not None

    aggregated = _create_pod(ui, ui.unique("res"), AGGREGATED)
    bare = _create_pod(ui, ui.unique("nores"), {"containers": [{"name": "main", "image": UNPULLABLE}]})
    try:
        # ---- every container's declaration is summed, init container included ----
        _open_detail(ui, aggregated)
        requests = ui.page.locator('[data-ai-id="pods-detail:requests"]')
        limits = ui.page.locator('[data-ai-id="pods-detail:limits"]')
        expect(requests).to_be_visible(timeout=20_000)
        expect(limits).to_be_visible(timeout=20_000)

        assert requests.locator('[data-ai-row="cpu"]').inner_text().strip() == "cpu: 0.85", (
            f"资源请求 cpu 应为 init+两个容器之和 0.85：{requests.inner_text()!r}"
        )
        assert requests.locator('[data-ai-row="memory"]').inner_text().strip() == "memory: 256Mi", (
            f"资源请求 memory 应为 256Mi：{requests.inner_text()!r}"
        )
        assert limits.locator('[data-ai-row="cpu"]').inner_text().strip() == "cpu: 1.5", (
            f"资源限制 cpu 应为 1.5：{limits.inner_text()!r}"
        )
        assert limits.locator('[data-ai-row="memory"]').inner_text().strip() == "memory: 384Mi", (
            f"资源限制 memory 应为 384Mi：{limits.inner_text()!r}"
        )
        # One line per resource, and the two rows are not the same numbers.
        assert requests.locator("[data-ai-row]").count() == 2, requests.inner_text()
        assert limits.locator("[data-ai-row]").count() == 2, limits.inner_text()

        screenshot(ui.page, "pods-detail-resource-lines")

        # ---- no declaration at all: "-" rather than 0 ----
        _open_detail(ui, bare)
        bare_requests = ui.page.locator('[data-ai-id="pods-detail:requests"]')
        bare_limits = ui.page.locator('[data-ai-id="pods-detail:limits"]')
        expect(bare_requests).to_be_visible(timeout=20_000)
        expect(bare_limits).to_be_visible(timeout=20_000)
        assert bare_requests.inner_text().strip() == "-", f"没有资源声明时应显示 -：{bare_requests.inner_text()!r}"
        assert bare_limits.inner_text().strip() == "-", f"没有资源声明时应显示 -：{bare_limits.inner_text()!r}"
        assert bare_requests.locator("[data-ai-row]").count() == 0
    finally:
        ui.delete_pod(aggregated, timeout=120)
        ui.delete_pod(bare, timeout=120)
