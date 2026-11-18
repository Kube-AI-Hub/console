from __future__ import annotations

import re
import time
from urllib.parse import parse_qs, urlparse

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

PODS = "/kapis/resources.kubesphere.io/v1alpha3/namespaces/default/pods"
#: 一个不存在的节点标签：容器组永远调度不出去，状态停在等待中。
UNSCHEDULABLE = {"tc-e2e-no-such-node": "true"}
#: 一个拉不下来的镜像：容器停在 ContainerCreating，同样是等待中，但带原因。
UNPULLABLE = "tc-e2e.invalid/never-pulled:1.0"

STATUS_LABELS = ("等待中", "运行中", "已完成", "错误")


def _pods(ui, query: str) -> tuple[int, set[str]]:
    """(totalItems, names) for one kapis query; a failed read fails the case.

    A 403/502 here is an environment problem, and turning it into a skip would hide
    it behind a green run (see helpers/reads.py for the same rule elsewhere).
    """
    status, body = ui._request("GET", f"{PODS}?limit=-1{query}")
    assert status == 200 and isinstance(body, dict), f"读取容器组失败：HTTP {status} — {repr(body)[:200]}"
    items = body.get("items") or []
    return int(body.get("totalItems") or len(items)), {str((item.get("metadata") or {}).get("name")) for item in items}


def _create_pod(ui, name: str, image: str, node_selector: dict | None) -> str:
    body = {
        "apiVersion": "v1",
        "kind": "Pod",
        "metadata": {"name": name, "namespace": "default", "labels": {"app": name}},
        "spec": {
            # Cleanup must be instant: these pods never run a real workload.
            "terminationGracePeriodSeconds": 0,
            "containers": [{"name": "main", "image": image}],
            **({"nodeSelector": node_selector} if node_selector else {}),
        },
    }
    status, payload = ui._request("POST", "/api/v1/namespaces/default/pods", body)
    assert status in (200, 201), f"创建容器组 {name} 失败：{status} {repr(payload)[:200]}"
    return name


def _wait_in(ui, query: str, names: set[str], timeout: float = 60) -> None:
    """Wait until the server classifies every created pod under this status filter."""
    deadline = time.time() + timeout
    missing: set[str] = set()
    while time.time() < deadline:
        _, seen = _pods(ui, query)
        missing = names - seen
        if not missing:
            return
        time.sleep(1.0)
    raise AssertionError(f"容器组 {sorted(missing)} 没有出现在 {query or '（无筛选）'} 的结果里")


def _limit_of(url: str) -> int:
    query = parse_qs(urlparse(url).query)
    return int((query.get("limit") or ["10"])[0])


def _page_total(surface) -> int:
    """The total the table reports ("共 N 条") — same response as the rows."""
    match = re.search(r"共\s*(\d+)\s*条", surface.inner_text())
    assert match, "列表没有显示总数（共 N 条），无法核对总数与筛选一致"
    return int(match.group(1))


def _same_total(ui, query: str, page_total: int, timeout: float = 30) -> None:
    """The page's total equals the server's total for the same filter.

    Compared with a retry: other cases run against this shared cluster, so the two reads
    (page response, API probe) can straddle an unrelated pod being created or deleted.
    """
    deadline = time.time() + timeout
    last = 0
    while time.time() < deadline:
        last, _names = _pods(ui, query)
        if last == page_total:
            return
        time.sleep(1.0)
    raise AssertionError(f"列表总数 {page_total} 与服务端 {query or '（无筛选）'} 的 totalItems {last} 不一致")


def _oracle(ui, query: str, limit: int, timeout: float = 60) -> tuple[int, list[str]]:
    """Rows of the filtered page, with the server's current answer as the oracle.

    The server side is re-read on every poll: other cases share this cluster, so a set
    captured before the filter was applied can already be stale by the time the table
    renders it.
    """
    deadline = time.time() + timeout
    last = ""
    while time.time() < deadline:
        total, names = _pods(ui, query)
        rows = ui.row_names("pods")
        if len(rows) == min(total, limit) and set(rows) <= names:
            return total, rows
        last = f"页面 {len(rows)} 行 / 服务端 {total} 条，多出的行 {sorted(set(rows) - names)}"
        ui.page.wait_for_timeout(1000)
    raise AssertionError(f"筛选后的行没有收敛到服务端结果：{last}")


def _wait_filtered(ui, names: set[str], limit: int, timeout: float = 45) -> list[str]:
    """Rows of the filtered page, once the table has caught up with the new response.

    `wait_ready` is not enough on its own: React Query keeps the previous page while the
    filtered request is in flight, so the surface stays "ready" and the rows are still the
    unfiltered ones. Waiting for the rows to match the server's own answer is the only
    deterministic signal.
    """
    deadline = time.time() + timeout
    expected_count = min(len(names), limit)
    last: list[str] = []
    while time.time() < deadline:
        last = ui.row_names("pods")
        if len(last) == expected_count and set(last) <= names:
            return last
        ui.page.wait_for_timeout(500)
    raise AssertionError(
        f"筛选后的行没有收敛到服务端结果：行数 {len(last)}（期望 {expected_count}），"
        f"多出的行 {sorted(set(last) - names)}"
    )


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_LIST_05(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-05 容器组列表：状态筛选（status=）。"""

    ui = app_workloads_page
    assert ui.api is not None

    # Both samples are unschedulable: such a pod stays in Waiting for good, while a
    # scheduled-but-unpullable one can still start (and then leave the Waiting set in the
    # middle of the case).
    unschedulable = _create_pod(ui, ui.unique("wait-nonode"), UNPULLABLE, UNSCHEDULABLE)
    creating = _create_pod(ui, ui.unique("wait-nonode2"), UNPULLABLE, UNSCHEDULABLE)
    try:
        # The server's own classification is the oracle: never assume a pod is
        # Waiting just because we built it that way.
        _wait_in(ui, "&status=Waiting", {unschedulable, creating})
        total_all, all_names = _pods(ui, "")
        total_running, running_names = _pods(ui, "&status=Running")
        total_waiting, waiting_names = _pods(ui, "&status=Waiting")
        assert total_waiting >= 2, f"等待中应至少包含本用例创建的两个容器组，实际 {total_waiting}"

        ui.open("pods")
        surface = ui.surface("pods")
        expect(surface).to_be_visible(timeout=30_000)
        ui.wait_ready(surface)

        # ---- the control offers exactly the four states, in the old order ----
        filter_control = ui.page.locator('[data-ai-id="pods:filter:status"]')
        expect(filter_control).to_be_visible(timeout=20_000)
        filter_control.click()
        options = [text.strip() for text in ui.page.get_by_role("option").all_inner_texts() if text.strip()]
        for label in STATUS_LABELS:
            assert label in options, f"筛选项缺「{label}」：{options}"
        assert [label for label in options if label in STATUS_LABELS] == list(STATUS_LABELS), options

        # ---- 运行中: the request carries status=Running and the rows agree ----
        # Pick the option straight from the dropdown opened above: closing it first and
        # reopening through the trigger made the second click land on a closing popup.
        with ui.page.expect_response(
            lambda response: "/namespaces/default/pods?" in response.url
            and "limit=" in response.url
            and "status=Running" in response.url,
            timeout=60_000,
        ) as captured:
            ui.page.get_by_role("option", name="运行中", exact=True).click()
        ui.wait_ready(surface)
        limit = _limit_of(captured.value.url)
        total_running, rows = _oracle(ui, "&status=Running", limit)
        page_total = _page_total(surface)
        assert len(rows) == min(page_total, limit), f"行数 {len(rows)} 与列表总数 {page_total} 不一致"
        for name in rows:
            assert "运行中" in ui.row_text("pods", name), f"{name} 的状态列不是运行中"
        _same_total(ui, "&status=Running", page_total)

        # ---- 等待中: our two pods are reachable, and the count matches the server ----
        with ui.page.expect_response(
            lambda response: "/namespaces/default/pods?" in response.url
            and "limit=" in response.url
            and "status=Waiting" in response.url,
            timeout=60_000,
        ) as waiting_response:
            ui.choose_select("pods:filter:status", "等待中")
        ui.wait_ready(surface)
        waiting_limit = _limit_of(waiting_response.value.url)
        total_waiting, waiting_rows = _oracle(ui, "&status=Waiting", waiting_limit)
        waiting_total = _page_total(surface)
        assert len(waiting_rows) == min(waiting_total, waiting_limit), (
            f"行数 {len(waiting_rows)} 与列表总数 {waiting_total} 不一致"
        )
        _same_total(ui, "&status=Waiting", waiting_total)
        # The created pods are what makes this branch non-empty. They fit on page 1
        # whenever the whole waiting set does; beyond a page the API assertion above
        # already proves the server classifies them as Waiting.
        if total_waiting <= waiting_limit:
            assert {unschedulable, creating} <= set(waiting_rows), (
                f"本用例创建的两个等待中容器组应出现在列表里：{sorted(set(waiting_rows))}"
            )
            for name in (unschedulable, creating):
                assert "等待中" in ui.row_text("pods", name), f"{name} 的状态列不是等待中"

        # ---- clearing the filter restores the whole set ----
        # Asserted on the effect, not on a request: clearing returns the query key to the one
        # the page started with, and React Query may answer that from cache — demanding a
        # network round trip here would fail a correct page (measured, 2026-11-18).
        ui.choose_select("pods:filter:status", "全部状态")
        ui.wait_ready(surface)
        deadline = time.time() + 30
        cleared_total = _page_total(surface)
        while time.time() < deadline and cleared_total != total_all:
            ui.page.wait_for_timeout(500)
            cleared_total = _page_total(surface)
        assert cleared_total == total_all, f"清空后总数应回到全集 {total_all}，实际 {cleared_total}"
        # The pods list opens at 10 rows per page; the assertion is about the *set*, not the page.
        clear_limit = 10
        _, cleared_rows = _oracle(ui, "", clear_limit)
        assert len(cleared_rows) == min(cleared_total, clear_limit), (
            f"清空后行数 {len(cleared_rows)} 与全集 {cleared_total} 不一致"
        )

        screenshot(ui.page, "pods-list-status-filter")
    finally:
        ui.delete_pod(unschedulable, timeout=120)
        ui.delete_pod(creating, timeout=120)
