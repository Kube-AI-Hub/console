from __future__ import annotations

import time
from urllib.parse import parse_qs, urlparse

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

#: 集群作用域：没有 namespaces/<ns> 段，跨命名空间返回。
CLUSTER_PODS = "/kapis/resources.kubesphere.io/v1alpha3/pods"
UNSCHEDULABLE = {"tc-e2e-no-such-node": "true"}
STATUS_LABELS = ("等待中", "运行中", "已完成", "错误")


def _pods(ui, query: str = "") -> tuple[int, set[str]]:
    status, body = ui._request("GET", f"{CLUSTER_PODS}?limit=-1{query}")
    assert status == 200 and isinstance(body, dict), f"读取集群容器组失败：HTTP {status} — {repr(body)[:200]}"
    items = body.get("items") or []
    return int(body.get("totalItems") or len(items)), {str((item.get("metadata") or {}).get("name")) for item in items}


def _scheduled(ui) -> tuple[str, str, str]:
    """(pod, node, nodeIP) of a scheduled pod anywhere in the cluster."""
    status, body = ui._request("GET", f"{CLUSTER_PODS}?limit=200")
    assert status == 200 and isinstance(body, dict), f"读取集群容器组失败：HTTP {status}"
    for item in body.get("items") or []:
        spec = item.get("spec") or {}
        st = item.get("status") or {}
        name = str((item.get("metadata") or {}).get("name") or "")
        node = str(spec.get("nodeName") or "")
        node_ip = str(st.get("hostIP") or "")
        if name and node and node_ip:
            return name, node, node_ip
    raise AssertionError("集群里没有已调度的容器组，无法核对节点列")


def _cluster_row(ui, name: str):
    """One row of the cluster-scoped pods list (its surface handle differs from the project page)."""
    return ui.page.locator('[data-ai-id="cluster-pods:surface"]').last.locator(f'[data-ai-row="{name}"]')


def _cluster_row_text(ui, name: str) -> str:
    return _cluster_row(ui, name).inner_text()


def _limit_of(url: str) -> int:
    query = parse_qs(urlparse(url).query)
    return int((query.get("limit") or ["20"])[0])


def _wait_filtered(ui, names: set[str], limit: int, timeout: float = 60) -> list[str]:
    """Rows once the table has caught up with the new response.

    The page keeps the previous page while the filtered request is in flight, so the
    surface stays ready and the rows are still the unfiltered ones.
    """
    deadline = time.time() + timeout
    expected = min(len(names), limit)
    last: list[str] = []
    # The cluster-scoped list has its own surface handle (`cluster-pods:surface`); reading the
    # project page's `pods:surface` here returns no rows at all and would look like an empty
    # filtered table rather than the wrong selector.
    rows = ui.page.locator('[data-ai-id="cluster-pods:surface"]').last.locator("[data-ai-row]")
    while time.time() < deadline:
        last = [name for name in rows.evaluate_all("els => els.map(e => e.getAttribute('data-ai-row'))") if name]
        if len(last) == expected and set(last) <= names:
            return last
        ui.page.wait_for_timeout(500)
    raise AssertionError(
        f"筛选后的行没有收敛到服务端结果：行数 {len(last)}（期望 {expected}），多出的行 {sorted(set(last) - names)}"
    )


def _cell_by_header(row, header: str):
    table = row.locator("xpath=ancestor::table[1]")
    labels = [text.strip() for text in table.locator("thead th").all_inner_texts()]
    assert header in labels, f"表头里没有「{header}」：{labels}"
    return row.locator("td").nth(labels.index(header))


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_LIST_08(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-08 集群作用域容器组：状态筛选与节点下钻。"""

    ui = app_workloads_page
    assert ui.api is not None

    pending = ui.unique("cluster-wait")
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
        scheduled_pod, node, node_ip = _scheduled(ui)
        total_all, all_names = _pods(ui)
        total_running, running_names = _pods(ui, "&status=Running")
        assert total_all > 0, "集群里没有容器组，无法验证集群作用域列表"

        origin = ui.base.split("/kube-frontend/")[0]
        ui.page.goto(f"{origin}/kube-frontend/clusters/{ui.cluster}/pods")
        surface = ui.page.locator('[data-ai-id="cluster-pods:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)

        # ---- the four states, same labels and order as the project-scoped list ----
        filter_control = ui.page.locator('[data-ai-id="cluster-pods:filter:status"]')
        expect(filter_control).to_be_visible(timeout=20_000)
        filter_control.click()
        options = [text.strip() for text in ui.page.get_by_role("option").all_inner_texts() if text.strip()]
        assert [label for label in options if label in STATUS_LABELS] == list(STATUS_LABELS), options
        ui.page.get_by_role("option", name="全部状态", exact=True).click()
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)

        # ---- 运行中: server-side status= across every namespace ----
        with ui.page.expect_response(
            lambda response: "/kapis/resources.kubesphere.io/v1alpha3/pods?" in response.url
            and "limit=" in response.url
            and "status=Running" in response.url,
            timeout=90_000,
        ) as captured:
            ui.choose_select("cluster-pods:filter:status", "运行中")
        url = captured.value.url
        assert "/namespaces/" not in url, f"集群作用域请求不该带命名空间段：{url}"
        limit = _limit_of(url)
        rows = _wait_filtered(ui, running_names, limit)
        assert len(rows) == min(total_running, limit), (
            f"行数 {len(rows)} 与服务端 status=Running 总数 {total_running} 不一致"
        )
        for name in rows:
            assert "运行中" in _cluster_row_text(ui, name), f"{name} 的状态列不是运行中"

        # ---- node drill-down: name + node IP, link into the cluster's node page ----
        if scheduled_pod in rows:
            node_link = ui.page.locator(f'[data-ai-id="cluster-pods:node:{scheduled_pod}"]')
            expect(node_link).to_be_visible(timeout=20_000)
            link_text = node_link.inner_text()
            assert node in link_text and node_ip in link_text, f"节点列应含节点名与节点 IP：{link_text!r}"
            href = node_link.get_attribute("href") or ""
            assert href.endswith(f"/clusters/{ui.cluster}/nodes/{node}"), f"节点链接应指向该集群的节点详情：{href}"
            assert "/projects/" not in href, f"节点是集群作用域，链接不该带项目段：{href}"

        screenshot(ui.page, "cluster-pods-status-filter")

        # ---- clearing the filter restores the whole cluster ----
        with ui.page.expect_response(
            lambda response: "/kapis/resources.kubesphere.io/v1alpha3/pods?" in response.url and "limit=" in response.url,
            timeout=90_000,
        ) as cleared:
            ui.choose_select("cluster-pods:filter:status", "全部状态")
        assert "status=" not in cleared.value.url, f"清空筛选后请求仍带 status：{cleared.value.url}"
        clear_limit = _limit_of(cleared.value.url)
        cleared_rows = _wait_filtered(ui, all_names, clear_limit)
        assert len(cleared_rows) == min(total_all, clear_limit), (
            f"清空后行数 {len(cleared_rows)} 与全集 {total_all} 不一致"
        )

        # ---- the unscheduled pod shows "-" and is not a link ----
        # Sorted by create time, so the pod created above is on the first page.
        pending_row = _cluster_row(ui, pending)
        pending_row.wait_for(state="visible", timeout=30_000)
        node_cell = _cell_by_header(pending_row, "所在节点")
        assert node_cell.inner_text().strip() == "-", f"未调度的容器组节点列应为 -：{node_cell.inner_text()!r}"
        assert pending_row.locator(f'[data-ai-id="cluster-pods:node:{pending}"]').count() == 0, (
            "未调度行不该有节点链接"
        )
        assert node_cell.locator("a[href]").count() == 0, "未调度的节点格不该是链接"
        screenshot(ui.page, "cluster-pods-node-column")
    finally:
        ui.delete_pod(pending, timeout=120)
