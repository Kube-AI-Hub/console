from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

DISCOVERY = "/apis/snapshot.storage.k8s.io/v1"
SNAPSHOTS = "/kapis/resources.kubesphere.io/v1alpha3/volumesnapshots"
CLASSES = "/kapis/resources.kubesphere.io/v1alpha3/volumesnapshotclasses"
SNAPSHOT_CLASSES_WRITE = "/apis/snapshot.storage.k8s.io/v1/volumesnapshotclasses"

SNAPSHOT_HEADERS = ("名称", "项目", "状态", "容量", "快照类型", "创建时间")
CLASS_HEADERS = ("名称", "驱动", "删除策略", "参数个数", "创建时间")


def _visible_headers(surface) -> list[str]:
    return [text.strip() for text in surface.locator("thead th:visible").all_inner_texts() if text.strip()]


def _total(ui, path: str) -> int | None:
    """Total objects the kapis proxy reports for one collection, or None on failure."""
    status, body = ui.api.request("GET", path + "?page=1&limit=20")
    if status != 200 or not isinstance(body, dict):
        return None
    items = body.get("items") or []
    return int(body.get("totalItems") or body.get("total_count") or len(items))


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_STORAGE_SNAPSHOTS_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOTS-01 集群级卷快照与快照类型。"""

    ui = cluster_management_page
    assert ui.api is not None

    status, _ = ui.api.request("GET", DISCOVERY)
    installed = status == 200

    created_class = None
    try:
        if installed:
            # Create one class so the data path (columns, row count, row content) is
            # exercised even on a cluster that has never snapshotted anything. Retain
            # keeps the driver out of the question: nothing will ever be deleted.
            created_class = "tc-e2e-snapclass-" + str(int(time.time() * 1000) % 1_000_000)
            status, _ = ui.api.request(
                "POST",
                SNAPSHOT_CLASSES_WRITE,
                {
                    "apiVersion": "snapshot.storage.k8s.io/v1",
                    "kind": "VolumeSnapshotClass",
                    "metadata": {"name": created_class},
                    "driver": "tc-e2e.invalid/no-such-driver",
                    "deletionPolicy": "Retain",
                    "parameters": {"probe": "true"},
                },
            )
            if status not in (200, 201):
                created_class = None

        snapshots_total = _total(ui, SNAPSHOTS) if installed else None
        classes_total = _total(ui, CLASSES) if installed else None

        # ---- cluster-wide volume snapshots -------------------------------------
        ui.page.goto(ui.url("volume-snapshots"))
        surface = ui.page.locator('[data-ai-id="cluster-volume-snapshots:surface"]')
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
        state = surface.get_attribute("data-ai-state")

        if not installed:
            assert state == "empty", state
            expect(ui.page.locator('[data-ai-id="cluster-volume-snapshots:crd-missing"]')).to_be_visible()
            expect(surface).to_contain_text("本集群未安装快照 CRD")
        elif snapshots_total:
            assert state == "ready", state
            headers = _visible_headers(surface)
            for expected in SNAPSHOT_HEADERS:
                assert expected in headers, (expected, headers)
            rows = surface.locator("tbody tr[data-ai-row]")
            expect(rows).to_have_count(min(20, snapshots_total), timeout=30_000)
            for index in range(rows.count()):
                row = rows.nth(index)
                handle = row.get_attribute("data-ai-row") or ""
                namespace, _, name = handle.partition("/")
                assert namespace and name, f"行句柄应为 项目/名称: {handle!r}"
                project_cell = row.locator("td").nth(1).inner_text().strip()
                assert project_cell == namespace, f"项目列应为 {namespace}: {project_cell!r}"
                href = row.locator("a").first.get_attribute("href") or ""
                assert f"/projects/{namespace}/volumesnapshots/{name}" in href, href
        else:
            assert state == "empty", state
            expect(surface).to_contain_text("暂无存储卷快照")

        # ---- cluster snapshot classes ------------------------------------------
        ui.page.goto(ui.url("volume-snapshot-classes"))
        surface = ui.page.locator('[data-ai-id="cluster-snapshot-classes:surface"]')
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
        state = surface.get_attribute("data-ai-state")

        if not installed:
            assert state == "empty", state
            expect(ui.page.locator('[data-ai-id="cluster-snapshot-classes:crd-missing"]')).to_be_visible()
            expect(surface).to_contain_text("本集群未安装快照 CRD")
        elif classes_total:
            assert state == "ready", state
            headers = _visible_headers(surface)
            for expected in CLASS_HEADERS:
                assert expected in headers, (expected, headers)
            rows = surface.locator("tbody tr[data-ai-row]")
            expect(rows).to_have_count(min(20, classes_total), timeout=30_000)
            if created_class:
                row = surface.locator(f'[data-ai-row="{created_class}"]')
                expect(row).to_be_visible()
                text = row.inner_text()
                assert "tc-e2e.invalid/no-such-driver" in text, text
                assert "Retain" in text, text
        else:
            assert state == "empty", state
            expect(surface).to_contain_text("暂无快照类型")

        screenshot(ui.page, "cluster-volume-snapshots")
    finally:
        if created_class:
            ui.api.request("DELETE", SNAPSHOT_CLASSES_WRITE + "/" + created_class)
