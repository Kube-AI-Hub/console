from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

PVS = "/api/v1/persistentvolumes"


def _pv(api, name: str) -> tuple[int, dict]:
    status, body = api.request("GET", f"{PVS}/{name}")
    return status, body if isinstance(body, dict) else {}


def _list(api) -> list[dict]:
    status, body = api.request("GET", PVS)
    assert status == 200 and isinstance(body, dict), (status, body)
    return body.get("items") or []


def _create(api, name: str, alias: str) -> None:
    body = {
        "apiVersion": "v1",
        "kind": "PersistentVolume",
        "metadata": {
            "name": name,
            "annotations": {"kubesphere.io/alias-name": alias, "kubesphere.io/description": "e2e 临时卷"},
        },
        "spec": {
            "capacity": {"storage": "1Gi"},
            "accessModes": ["ReadWriteOnce"],
            "persistentVolumeReclaimPolicy": "Retain",
            "storageClassName": "manual",
            "hostPath": {"path": "/tmp/kube-ai-hub-e2e"},
        },
    }
    status, created = api.request("POST", PVS, body)
    assert status in (200, 201), (status, created)


def _delete(api, name: str) -> None:
    api.request("DELETE", f"{PVS}/{name}")


def _wait_annotation(api, name: str, key: str, predicate) -> str:
    value = ""
    for _ in range(30):
        status, body = _pv(api, name)
        if status != 200:
            break
        value = ((body.get("metadata") or {}).get("annotations") or {}).get(key) or ""
        if predicate(value):
            return value
        time.sleep(1)
    return value


def _unique(prefix: str) -> str:
    return f"{prefix}-{int(time.time() * 1000) % 1_000_000}"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_PERSISTENT_VOLUMES_03(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-03 持久卷写能力。"""

    ui = access_control_page
    assert ui.api is not None
    cluster = "host"
    stamp = int(time.time() * 1000) % 1_000_000
    name_a = f"tc-e2e-pv-{stamp}-a"
    name_b = f"tc-e2e-pv-{stamp}-b"
    name_c = f"tc-e2e-pv-{stamp}-c"
    # Alias validation rejects spaces (old console's PATTERN_ALIAS_NAME); keep it hyphenated.
    alias = f"e2e-pv-{stamp}"
    created = [name_a, name_b, name_c]

    try:
        for name in created:
            _create(ui.api, name, alias)

        bound = next((item for item in _list(ui.api) if ((item.get("status") or {}).get("phase") == "Bound")), None)
        assert bound, "本集群没有 Bound 持久卷，无法验证删除保护分支"
        bound_name = str((bound.get("metadata") or {}).get("name") or "")

        # ---- 编辑信息（merge-patch，未改注解保留、清空键以 null 移除） ----
        ui.page.goto(f'{ui.base_url}/kube-frontend/clusters/{cluster}/persistentvolumes/{name_a}', wait_until="domcontentloaded")
        expect(ui.page.locator('[data-ai-id="pv-detail:surface"]')).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
        expect(ui.page.locator('[data-ai-id="pv-detail:delete"]')).to_be_enabled(timeout=20_000)
        ui.page.locator('[data-ai-id="pv-detail:edit-info"]').click()
        edited_alias = f"{alias}-info"
        ui.page.locator('[data-ai-id="pv-detail:edit-alias"]').fill(edited_alias)
        ui.page.locator('[data-ai-id="pv-detail:edit-description"]').fill("e2e 编辑后的描述")
        ui.page.locator('[data-ai-id="pv-detail:edit-info-submit"]').click()
        expect(ui.page.locator('[data-ai-id="pv-detail:edit-info-submit"]')).to_have_count(0, timeout=30_000)
        saved_alias = _wait_annotation(ui.api, name_a, "kubesphere.io/alias-name", lambda value: value == edited_alias)
        assert saved_alias == edited_alias, saved_alias
        saved_desc = _wait_annotation(ui.api, name_a, "kubesphere.io/description", lambda value: value == "e2e 编辑后的描述")
        assert saved_desc == "e2e 编辑后的描述", saved_desc

        # ---- 编辑 YAML（整对象 PUT） ----
        ui.page.locator('[data-ai-id="pv-detail:edit-yaml"]').click()
        editor = ui.page.locator(".cm-content")
        expect(editor).to_be_visible(timeout=30_000)
        alias_line = ui.page.locator(".cm-line", has_text="kubesphere.io/alias-name").first
        expect(alias_line).to_be_visible(timeout=20_000)
        box = alias_line.bounding_box()
        ui.page.mouse.click(box["x"] + box["width"] - 4, box["y"] + box["height"] / 2)
        ui.page.keyboard.press("End")
        ui.page.keyboard.type("-yaml", delay=30)
        ui.page.locator('[data-ai-id="yaml:submit"]').click()
        expect(ui.page.locator('[data-ai-id="yaml:submit"]')).to_have_count(0, timeout=30_000)
        yaml_alias = _wait_annotation(ui.api, name_a, "kubesphere.io/alias-name", lambda value: value.endswith("-yaml"))
        assert yaml_alias == f"{edited_alias}-yaml", yaml_alias

        # ---- Bound 卷：删除入口置灰 + 原因可见 ----
        ui.page.goto(f'{ui.base_url}/kube-frontend/clusters/{cluster}/persistentvolumes/{bound_name}', wait_until="domcontentloaded")
        expect(ui.page.locator('[data-ai-id="pv-detail:surface"]')).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
        expect(ui.page.locator('[data-ai-id="pv-detail:delete"]')).to_be_disabled(timeout=20_000)
        expect(ui.page.locator('[data-ai-id="pv-detail:delete-protected"]')).to_be_visible(timeout=20_000)
        screenshot(ui.page, "pv-detail-delete-protected")

        # ---- 批量删除：选中 A、B 与 Bound，只删可删的，结果汇总跳过 1 ----
        ui.page.goto(f'{ui.base_url}/kube-frontend/clusters/{cluster}/persistentvolumes', wait_until="domcontentloaded")
        surface = ui.page.locator('[data-ai-id="persistentvolumes:surface"]')
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
        for name in (name_a, name_b, bound_name):
            checkbox = ui.page.locator(f'[data-ai-id="persistentvolumes:select:{name}"]')
            expect(checkbox).to_be_visible(timeout=30_000)
            checkbox.click()
        ui.page.locator('[data-ai-id="persistentvolumes:bulk-delete"]').click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible(timeout=20_000)
        ui.page.locator('[data-ai-id="persistentvolumes:delete-input"]').fill("2")
        ui.page.locator('[data-ai-id="persistentvolumes:delete-confirm"]').click()
        expect(ui.page.locator('[data-ai-id="persistentvolumes:delete-confirm"]')).to_have_count(0, timeout=60_000)
        result = ui.page.locator('[data-ai-id="persistentvolumes:batch-result"]')
        expect(result).to_be_visible(timeout=30_000)
        assert result.get_attribute("data-ai-deleted") == "2", result.inner_text()
        assert result.get_attribute("data-ai-skipped") == "1", result.inner_text()
        assert result.get_attribute("data-ai-failed") == "0", result.inner_text()
        for name in (name_a, name_b):
            status, _ = _pv(ui.api, name)
            assert status == 404, (name, status)
        status, _ = _pv(ui.api, bound_name)
        assert status == 200, (bound_name, status)
        screenshot(ui.page, "persistentvolumes-batch-result")

        # ---- 单条删除：输入名称确认后回到列表 ----
        ui.page.goto(f'{ui.base_url}/kube-frontend/clusters/{cluster}/persistentvolumes/{name_c}', wait_until="domcontentloaded")
        expect(ui.page.locator('[data-ai-id="pv-detail:delete"]')).to_be_enabled(timeout=60_000)
        ui.page.locator('[data-ai-id="pv-detail:delete"]').click()
        expect(ui.page.get_by_role("dialog")).to_be_visible(timeout=20_000)
        ui.page.locator('[data-ai-id="pv-detail:delete-input"]').fill(name_c)
        ui.page.locator('[data-ai-id="pv-detail:delete-confirm"]').click()
        expect(ui.page).to_have_url(f'{ui.base_url}/kube-frontend/clusters/{cluster}/persistentvolumes', timeout=60_000)
        status, _ = _pv(ui.api, name_c)
        assert status == 404, status
    finally:
        for name in created:
            try:
                _delete(ui.api, name)
            except Exception:  # noqa: BLE001 - 清理尽力而为
                pass
