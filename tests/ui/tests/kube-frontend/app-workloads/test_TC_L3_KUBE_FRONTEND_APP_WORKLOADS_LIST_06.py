from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

PODS = "/kapis/resources.kubesphere.io/v1alpha3/namespaces/default/pods"
SYSTEM_NAMESPACE = "kubesphere-system"
UNSCHEDULABLE = {"tc-e2e-no-such-node": "true"}


def _rows(ui, path: str) -> list[dict]:
    status, body = ui._request("GET", path)
    assert status == 200 and isinstance(body, dict), f"读取容器组失败：HTTP {status} — {repr(body)[:200]}"
    return list(body.get("items") or [])


def _scheduled_pod(ui) -> tuple[str, str, str, str]:
    """(namespace, pod, node, nodeIP) of a pod that is on a node, default first."""
    for namespace in ("default", SYSTEM_NAMESPACE):
        for item in _rows(ui, f"/api/v1/namespaces/{namespace}/pods?limit=200"):
            spec = item.get("spec") or {}
            status = item.get("status") or {}
            node = str(spec.get("nodeName") or "")
            node_ip = str(status.get("hostIP") or "")
            name = str((item.get("metadata") or {}).get("name") or "")
            if node and node_ip and name:
                return namespace, name, node, node_ip
    raise AssertionError("集群里没有已调度（同时有 nodeName 与 hostIP）的容器组，无法核对节点列")


def _cell_by_header(row, header: str):
    """The td under the th whose visible label is `header`.

    Counting cells by index would be wrong: the selection column renders a th with no
    text, so the visible-label index is not the cell index. Reading the whole header
    row (including the empty label) keeps the two aligned.
    """
    table = row.locator("xpath=ancestor::table[1]")
    labels = [text.strip() for text in table.locator("thead th").all_inner_texts()]
    assert header in labels, f"表头里没有「{header}」：{labels}"
    return row.locator("td").nth(labels.index(header))


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_LIST_06(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-06 容器组列表：节点列是节点详情链接。"""

    ui = app_workloads_page
    assert ui.api is not None

    namespace, pod, node, node_ip = _scheduled_pod(ui)
    pending = ui.unique("node-dash")
    body = {
        "apiVersion": "v1",
        "kind": "Pod",
        "metadata": {"name": pending, "namespace": "default", "labels": {"app": pending}},
        "spec": {
            "terminationGracePeriodSeconds": 0,
            "containers": [{"name": "main", "image": "tc-e2e.invalid/never-pulled:1.0"}],
            "nodeSelector": UNSCHEDULABLE,
        },
    }
    status, payload = ui._request("POST", "/api/v1/namespaces/default/pods", body)
    assert status in (200, 201), f"创建未调度容器组失败：{status} {repr(payload)[:200]}"
    try:
        if namespace == "default":
            ui.open("pods")
        else:
            # The pod list is project-scoped; a system namespace needs its own URL.
            origin = ui.base.split("/kube-frontend/")[0]
            ui.page.goto(f"{origin}/kube-frontend/{ui.workspace}/clusters/{ui.cluster}/projects/{namespace}/pods")
        surface = ui.surface("pods")
        expect(surface).to_be_visible(timeout=30_000)
        ui.wait_ready(surface)

        headers = ui.headers("pods")
        assert "所在节点" in headers, headers

        # ---- a scheduled pod: node name + node IP, and a link into that node ----
        ui.ensure_row("pods", pod)
        row = ui.row("pods", pod)
        node_link = row.locator(f'[data-ai-id="pods:node:{pod}"]')
        expect(node_link).to_be_visible(timeout=20_000)
        link_text = node_link.inner_text()
        assert node in link_text, f"节点列应含节点名 {node}：{link_text!r}"
        assert node_ip in link_text, f"节点列应含节点 IP {node_ip}：{link_text!r}"
        href = node_link.get_attribute("href") or ""
        assert href.endswith(f"/clusters/{ui.cluster}/nodes/{node}"), f"节点链接应指向该集群的节点详情：{href}"
        assert "/projects/" not in href, f"节点是集群作用域，链接不该带项目段：{href}"

        # ---- an unscheduled pod: plain "-", no link ----
        if namespace != "default":
            pytest.fail("未调度容器组建在 default，但页面开在系统命名空间，无法同时核对两分支")
        ui.ensure_row("pods", pending)
        pending_row = ui.row("pods", pending)
        node_cell = _cell_by_header(pending_row, "所在节点")
        assert node_cell.inner_text().strip() == "-", f"未调度的容器组节点列应为 -：{node_cell.inner_text()!r}"
        assert pending_row.locator(f'[data-ai-id="pods:node:{pending}"]').count() == 0, "未调度行不该有节点链接"
        assert node_cell.locator("a[href]").count() == 0, "未调度的节点格不该是链接"

        screenshot(ui.page, "pods-list-node-column")
    finally:
        ui.delete_pod(pending, timeout=120)
