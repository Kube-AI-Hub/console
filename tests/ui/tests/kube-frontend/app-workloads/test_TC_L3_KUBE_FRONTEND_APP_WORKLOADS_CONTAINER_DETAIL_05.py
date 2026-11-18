from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

SYSTEM_NAMESPACE = "kubesphere-system"
UNPULLABLE = "tc-e2e.invalid/never-pulled:1.0"
UNSCHEDULABLE = {"tc-e2e-no-such-node": "true"}


def _pods(ui, namespace: str) -> list[dict]:
    status, body = ui._request("GET", f"/api/v1/namespaces/{namespace}/pods?limit=200")
    assert status == 200 and isinstance(body, dict), f"读取 {namespace} 容器组失败：HTTP {status} — {repr(body)[:200]}"
    return list(body.get("items") or [])


def _started_container(ui) -> tuple[str, str, str, str]:
    """(namespace, pod, container, imageID) of a container that actually started."""
    for namespace in ("default", SYSTEM_NAMESPACE):
        for item in _pods(ui, namespace):
            name = str((item.get("metadata") or {}).get("name") or "")
            for container in (item.get("status") or {}).get("containerStatuses") or []:
                image_id = str((container or {}).get("imageID") or "")
                container_name = str((container or {}).get("name") or "")
                if name and container_name and image_id:
                    return namespace, name, container_name, image_id
    raise AssertionError("集群里没有已启动（带 imageID）的容器，无法核对镜像 ID 的正分支")


def _url(ui, namespace: str, pod: str, container: str) -> str:
    origin = ui.base.split("/kube-frontend/")[0]
    return f"{origin}/kube-frontend/{ui.workspace}/clusters/{ui.cluster}/projects/{namespace}/pods/{pod}/containers/{container}"


def _open(ui, url: str):
    ui.page.goto(url)
    surface = ui.page.locator('[data-ai-id="container-detail:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
    return surface


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_CONTAINER_DETAIL_05(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-05 容器详情：镜像 ID。"""

    ui = app_workloads_page
    assert ui.api is not None

    namespace, pod, container, image_id = _started_container(ui)

    not_started = ui.unique("nostart")
    body = {
        "apiVersion": "v1",
        "kind": "Pod",
        "metadata": {"name": not_started, "namespace": "default", "labels": {"app": not_started}},
        "spec": {
            "terminationGracePeriodSeconds": 0,
            "containers": [{"name": "main", "image": UNPULLABLE}],
            "nodeSelector": UNSCHEDULABLE,
        },
    }
    status, payload = ui._request("POST", "/api/v1/namespaces/default/pods", body)
    assert status in (200, 201), f"创建未启动容器组失败：{status} {repr(payload)[:200]}"
    try:
        # ---- started: the property equals the container's imageID, verbatim ----
        _open(ui, _url(ui, namespace, pod, container))
        image_cell = ui.page.locator('[data-ai-id="container-detail:image-id"]')
        expect(image_cell).to_be_visible(timeout=20_000)
        shown = image_cell.inner_text().strip()
        assert shown == image_id, f"镜像 ID 应等于 containerStatuses 的 imageID：页面 {shown!r} / 对象 {image_id!r}"
        screenshot(ui.page, "container-detail-image-id")

        # ---- never started: "-", not an empty string ----
        _open(ui, _url(ui, "default", not_started, "main"))
        not_started_cell = ui.page.locator('[data-ai-id="container-detail:image-id"]')
        expect(not_started_cell).to_be_visible(timeout=20_000)
        assert not_started_cell.inner_text().strip() == "-", (
            f"容器未启动时镜像 ID 应为 -：{not_started_cell.inner_text()!r}"
        )
    finally:
        ui.delete_pod(not_started, timeout=120)
